import { ApiPromise, WsProvider } from '@polkadot/api'
import Keyring from '@polkadot/keyring/'
import createPair from '@polkadot/keyring/pair'
import { isArr, isObj, isValidNumber } from './utils'

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
// transfer funds between accounts
//
// Params:
// @toAddress   string: destination identity/address
// @secretKey   string: address (must have already been added to keyring) or secretKey or seed (type: 'sr25519')
// @publicKey   string: if falsy, @secretkey will be assumed to be a seed or an address 
// @api         object: PolkadkRingot API from `ApiPromise`
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
    const balance = await api.query.balances.freeBalance(sender.address)

    if (balance <= (amount + config.txFeeMin)) throw 'Insufficient balance'
    console.log('Polkadot: transfer from ', { address: sender.address, balance: balance.toString() })
    console.log('Polkadot: transfer to ', { address: toAddress, amount })
    const tx = api.tx.balances.transfer(toAddress, amount)
    return await signAndSend(api, sender.address, tx)
}

export const signAndSend = async (api, address, tx) => {
    const account = _keyring.getPair(address)
    let nonce = await api.query.system.accountNonce(address)
    nonce = parseInt(nonce)
    if (nonces[address] && nonces[address] >= nonce) {
        nonce = nonces[address] + 1
    }
    nonces[address] = nonce
    console.log('Polkadot: initiating transation', { nonce })

    return await new Promise(async (resolve, reject) => {
        try {
            const signed = await tx.sign(account, { nonce })
            await signed.send(result => {
                const { events, status } = result
                console.log('Polkadot: Transaction status', status.type)
                // status.type = 'Future' means transaction will be executed in the future. 
                // there is a nonce gap that need to be filled. 
                if (!status.isFinalized && status.type !== 'Future') return
                const hash = status.asFinalized.toHex()
                const eventsArr = JSON.parse(JSON.stringify(events)).map(x => x.event) // get rid of all the jargon
                const { data: eventData } = eventsArr
                    .find(event => event.data && event.data.length) || {} // ignore the empty data array
                console.log(`Polkadot: Completed at block hash: ${hash}`, { eventData })
                resolve([hash, eventData])
            })
        } catch (err) {
            reject(err)
        }
    })
}

export default {
    keyring,
    connect,
    setDefaultConfig,
    transfer,
    signAndSend
}