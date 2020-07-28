import { ApiPromise, WsProvider } from '@polkadot/api'
import Keyring from '@polkadot/keyring/'
import createPair from '@polkadot/keyring/pair'
import { isFn, isArr, isDefined, isObj, isStr, isValidNumber } from '../utils/utils'

const TYPE = 'sr25519'
const _keyring = new Keyring({ type: TYPE })
const config = {
    nodes: [],
    timeout: 30000,
    types: {},
    // minimum required amount in XTX to create a transation.
    // This is a temporary solution until upgraded to PolkadotJS V2.
    // 140 XTX for a simple transaction.
    // 1 XTX for existential balance. 
    txFeeMin: 141,
}
const nonces = {}

// connect initiates a connection to the blockchain using PolkadotJS
//
// Params:
// @nodeUrl     string
// @types       object: custom type definitions
// @autoConnect boolean: whether to auto reconnect or create an once-off connection
//
// returns promise: 
//                  - will resolve to an object: { api, provider}
//                  - will reject to either a @err: string or object (if object use @message property for error message)
//                  - will reject if connection fails as well as times out
export const connect = (
    nodeUrl = config.nodes[0],
    types = config.types,
    autoConnect = true,
    timeout = config.timeout
) => new Promise((resolve, reject) => {
    const provider = new WsProvider(nodeUrl, autoConnect)
    if (!autoConnect) provider.connect()
    // auto reject if doesn't connect within specified duration
    const tId = setTimeout(() => !provider.isConnected() && reject('Connection timeout'), timeout)
    // reject if connection fails
    provider.websocket.addEventListener('error', () => reject('Connection failed') | clearTimeout(tId))
    // instantiate the Polkadot API using the provider and supplied types
    ApiPromise.create({ provider, types }).then(api =>
        resolve({ api, keyring: _keyring, provider }) | clearTimeout(tId),
        reject
    )
})

// setDefaultConfig sets default config (node URL, type definitions etc) for use connections, 
// unless explicitly provided in the @connect function.
//
// Params:
// @nodes   array: array of node URLs
// @types   object
//
// Returns object: @config
export const setDefaultConfig = (nodes, types, timeout) => {
    config.nodes = isArr(nodes) ? nodes : config.nodes
    config.types = isObj(types) ? types : config.types
    config.timeout = isValidNumber(timeout) && tiemout > 0 ? timeout : config.timeout
    return config
}

export const keyring = {
    // add pair(s) to keyring 
    //
    // Params:
    // @seeds   array: uri/seed
    add: (seeds = []) => seeds.forEach(s => {
        try {
            _keyring.addFromUri(s)
        } catch (error) { console.log('Failed to add seed to keyring', error) }
    }),

    // contains checks if identity exists in the keyring
    //
    // Params:
    // @address string/Uint8Array
    //
    // Returns boolean
    contains: address => {
        try {
            // test if @secretKey is an address already added to the keyring
            _keyring.getPair(address)
            return true
        } catch (_) {
            return false
        }
    },

    // reference to the keyring
    keyring: _keyring,

    // remove a pair from the keyring
    //
    // Params:
    // @address     string/Uint8Array
    // 
    // returns boolean: indicates success/failure
    remove: address => keyring.contains(address) && !_keyring.removePair(address),

}

// query makes storage API calls using PolkadotJS. All values returned will be sanitised.
//
// Params:
// @api     ApiRx: API instance created using PolkadotJS or @connect()
// @func    string: path to the PolkadotJS API function as a string. Eg: 'api.rpc.system.health'
// @args    array: arguments to be supplied when invoking the API function.
//              To subscribe to the API supply a callback function as the last item in the array.
// @print   boolean: if true, will print the result of the query
//
// Returns  function/any: If callback is supplied in @args, will return the unsubscribe function.
//              Otherwise, value of the query will be returned
export const query = async (api, func, args = [], multi = false, print = false, invalidApiMsg, invalidMutliArgsMsg) => {
    if (!isObj(api)) return
    // **** keep { api } **** It is expected to be used with eval()
    if (!func || func === 'api') return api
    // add .multi if required
    if (isStr(func) && multi && !func.endsWith('.multi')) func += '.multi'

    const fn = eval(func)
    if (!fn) throw new Error(invalidApiMsg || 'Invalid API function', func)

    args = isArr(args) || !isDefined(args) ? args : [args]
    multi = isFn(fn) && !!multi
    const sanitise = x => JSON.parse(JSON.stringify(x)) // get rid of jargon
    const cb = args[args.length - 1]
    const isSubscribe = isFn(cb) && isFn(fn)

    if (isSubscribe) {
        // only add interceptor to process result
        args[args.length - 1] = result => {
            result = sanitise(result)
            print && console.log(func, result)
            cb.call(null, result)
        }
    }

    // For multi query arguments needs to be constructs as 2D Array.
    // If only one argument in @args is supplied, assume that it is a 2D array.
    // Otherwise, construct a 2D array as required by 
    const len = isSubscribe ? 2 : 1
    if (multi && !isFn(args[0]) && args.length > len) {
        try {
            // remove subscription callback before processing arguments
            let interceptor
            if (isSubscribe) {
                interceptor = args.slice(-1)[0]
                args = args.slice(0, -1)
            }
            // construct a 2D array
            args = [
                args[0].map((_, i) =>
                    args.map(ar => ar[i])
                )
            ]
            // re-add subscription callback
            if (isSubscribe) args.push(interceptor)

        } catch (err) {
            throw `${invalidMutliArgsMsg || 'Failed to process arguments for multi-query'} ${err}`
        }
    }
    const result = isFn(fn) ? await fn.apply(null, args) : fn
    !isSubscribe && print && console.log(JSON.stringify(result, null, 4))
    return isSubscribe ? result : sanitise(result)
}

// sign and send an already instantiated transaction
//
// Params:
// @api         ApiRx: API instance created using PolkadotJS or @connect()
// @address     string: account holder identity
// @tx          TxRx: an already instantiated transaction created using the @api
//
// Returns      promise 
export const signAndSend = async (api, address, tx) => {
    const account = _keyring.getPair(address)
    let nonce = await api.query.system.accountNonce(address)
    nonce = parseInt(nonce)
    if (nonces[address] && nonces[address] >= nonce) {
        nonce = nonces[address] + 1
    }
    nonces[address] = nonce
    console.log('Polkadot: initiating transation', { nonce })
    // let includedInBlock = false
    return await new Promise(async (resolve, reject) => {
        try {
            const signed = await tx.sign(account, { nonce })
            await signed.send(result => {
                const { events, status } = result
                console.log('Polkadot: Transaction status', status.type)

                // transaction was included in the block
                // if (status.isInBlock) includedInBlock = true

                // status.type = 'Future' means transaction will be executed in the future. 
                // there is a nonce gap that need to be filled. 
                if (!status.isFinalized && status.type !== 'Future') return
                const hash = status.asFinalized.toHex()
                const eventsArr = JSON.parse(JSON.stringify(events)).map(x => x.event) // get rid of all the jargon
                // find the event that has data
                const { data: eventData } = eventsArr.find(event => event.data && event.data.length) || {}
                console.log(`Polkadot: Completed at block hash: ${hash}`, { eventData })
                // transaction finalized, but not included in a block => runtime rejected the TX
                // if (!includedInBlock) return reject('Transaction was rejected by runtime')
                resolve([hash, eventData])
            })
        } catch (err) {
            reject(err)
        }
    })
}

// transfer funds between accounts
//
// Params:
// @toAddress       string: destination identity/address
// @secretKey       string: address (must have already been added to keyring) or secretKey or seed (type: 'sr25519')
// @publicKey       string: if falsy, @secretkey will be assumed to be a seed or an address 
// @api             object: PolkadkRingot API from `ApiPromise`
//
// Returns promise: will resolve to transaction hash
export const transfer = async (toAddress, amount, secretKey, publicKey, api) => {
    if (!api) {
        // config.nodes wasn't set => return empty promise that rejects immediately
        if (config.nodes.length === 0) throw new Error('Unable to connect: node URL not set')
        const res = await connect(config.nodes[0], config.types, false)
        api = res.api
        console.log('Polkadot connected', res)
    }

    let pair
    if (!!publicKey) {
        // public and private key supplied
        pair = createPair(TYPE, { secretKey, publicKey })
        _keyring.addPair(pair)
    } else {
        try {
            // test if @secretKey is an address already added to the keyring
            pair = _keyring.getPair(secretKey)
        } catch (_) {
            // assumes @secretKey is a seed/uri
            pair = _keyring.addFromUri(secretKey)
        }
    }
    const sender = _keyring.getPair(pair.address)
    console.log('Polkadot: transfer to ', { address: toAddress, amount })
    const tx = api.tx.balances.transfer(toAddress, amount)
    return await signAndSend(api, sender.address, tx)
}

export default {
    keyring,
    connect,
    setDefaultConfig,
    transfer,
    signAndSend
}