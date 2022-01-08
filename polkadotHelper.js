import { ApiPromise, ApiRx, WsProvider } from '@polkadot/api'
import Keyring, { createPair } from '@polkadot/keyring'
import { bytesToHex } from './convert'
import {
    isFn,
    isArr,
    isDefined,
    isObj,
    isStr,
    isValidNumber,
    isArr2D,
    isNodeJS,
    isUint8Arr,
    objHasKeys,
    deferred,
} from './utils'

// Indicates if run on a Browser or console using NodeJS
const isBrowser = !isNodeJS()
const texts = {
    connected: 'connected',
    connecting: 'connecting',
    connectionFailed: 'connection failed',
    disconnected: 'disconnected',
    invalidApiFunc: 'Invalid query API function',
    invalidTxFunc: 'Invalid transaction API function',
    invalidMutliArgsMsg: 'Failed to process arguments for multi-query',
    reconnecting: 'attempting to reconnect...',
    reconnected: 'reconnected',

    txInitiating: 'initiating transation',
    txFailed: 'transaction failed',
    txStatus: 'transaction status',
    txCompletedAtBlock: 'transaction completed at block hash',
}

/**
 * @name    KeyringHelper
 * @summary A helper class with most commonly used functions for managing identities using the PolkadotJS Keyring.
 * 
 * @param   {String} type 
 * @param   {Keyring} keyring
 */
export class KeyringHelper {
    constructor(type = 'sr25519', keyring) {
        //Instantiate a new keyring instance if not provided
        this.keyring = keyring || new Keyring({ type })
        this.type = type
    }
    /**
     * @name    add
     * @summary add identities to the keyring
     * 
     * @param   {Array} seeds   array of uri/seeds or objects with properties: secretKey & publicKey
     * 
     * @returns {Array} array of keypairs
     */
    add = (seeds = []) => seeds.map(seed => {
        try {
            if (isUint8Arr(seed)) {
                seed = bytesToHex(seed)
            } else if (isObj(seed) && objHasKeys(seed, ['secretKey', 'publicKey'])) {
                const { secretKey, publicKey } = seed
                const pair = createPair(this.type, { secretKey, publicKey })
                return this.keyring.addPair(pair)
            }
            return this.keyring.addFromUri(seed)
        } catch (error) {
            console.log('Failed to add seed to keyring', error)
        }
    })

    /**
     * @name    contains
     * @summary contains checks if identity exists in the keyring
     *
     * @param   {String|Uint8Array} address 
     *
     * @returns {Boolean}
     */
    contains = address => !!this.getPair(address)

    /**
     * @name    getPair
     * @summary get keypair from address without throwing error if not found
     * 
     * @param   {String} address 
     * 
     * @returns {Object}
     */
    getPair = address => {
        try {
            // test if @secretKey is an address already added to the keyring
            return this.keyring.getPair(address)
        } catch (_) { }
    }

    /**
     * @name    remove
     * @summary remove a pair from the keyring
     * 
     * @param   {String} address 
     * 
     * @returns {Boolean}   indicates success/failure
     */
    remove = address => this.contains(address) && !this.keyring.removePair(address)
}

// get rid of jargon
export const sanitise = x => JSON.parse(JSON.stringify(x))

/**
 * @name    signAndSend
 * @summary sign and send an already instantiated transaction
 * 
 * @param   {ApiRx}   api       API instance created using PolkadotJS or @connect()
 * @param   {String}  address   Account holder identity
 * @param   {TxRx}    tx        An already instantiated transaction created using the @api
 * @param   {Number}  nonce     Next unused nonce to be used for the transaction
 * @param   {Subject} rxStatus  RxJS Subject to update the UI on status changes, if required
 * 
 * @returns {Array}   [blockHash, eventsArr]
 */
export const signAndSend = async (api, address, tx, nonce, rxStatus) => {
}

export default {
    // query,
    // sanitise,
    // setDefaultConfig,
    // signAndSend,
}

/**
 * @name PolkadotHelper
 * 
 * @param   {Array}     nodeUrls        blockchain node URLs.
 *                                      Default: `['wss://rpc.polkadot.io']`
 * @param   {String}    title           name of the blockchain for use with logging.
 *                                      Default: `"Polkadot Blockchain Network"`
 * @param   {Number}    disconnectDelay Delay in number of milliseconds to wait before automatically disconnecting
 *                                      from the network after making query. If falsy or <=0, will not auto-disconnect.
 *                                      Default: `0`
 * @param   {Object}    textOverrides   Error or warning message overrides. Eg: useful when using a different language.
 */
export class PolkadotHelper {
    constructor(nodeUrls, title, disconnectDelay, textOverrides, keyringHelper) {
        this.autoDisconnect = disconnectDelay > 0
        this.connection = {}
        this.disconnectDelay = this.autoDisconnect && disconnectDelay || 0
        this.texts = {
            ...texts,
            ...textOverrides,
        }
        this.nodeUrls = nodeUrls || ['wss://rpc.polkadot.io']
        this.title = title || 'Polkadot Blockchain Network'
        this.keyringHelper = keyringHelper || new KeyringHelper()
        // store a list of recently used nonces for each identity
        this.nonces = {}
    }

    /**
     * @name        calculateFees
     * @summary     estimate transaction fee for a specific transaction 
     * @description `feeBase` and `feePerbyte` should already be set using `setDefaultConfig()`. 
     *              Otherwise, value `1` will be used for both.
     * 
     * @param   {String}    func        path to API function. Should start with "api.tx."
     * @param   {Array}     funcArgs    arguments to be supplied to the API function
     * @param   {String}    address     (optional) identity address to be used to construct the transaction.
     *                                  Address needs to be already in the keyring. If not, will use default.
     *                                  Default: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
     * 
     * @returns {Number}    estimated transaction fee plus existential deposit
     */
    calculateFees = async (func, args, address) => {
        const { api } = await this.getConnection()
        if (!this.keyringHelper.contains(address)) {
            // if keyring doesn't already contain the address supplied use Alice
            this.keyringHelper.add(['//Alice'])
            address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
        }
        const account = this.keyringHelper.getPair(address)
        const [
            nonce,
            creationFee,
            baseFee,
            byteFee,
            existentialDeposit,
        ] = await query(api, api.queryMulti, [[
            [api.query.system.accountNonce, address],
            [api.query.balances.creationFee],
            [api.query.balances.transactionBaseFee],
            [api.query.balances.transactionByteFee],
            [api.query.balances.existentialDeposit],
        ]])
        func = isStr(func) && func.startsWith('api.tx.')
            ? eval(func)
            : func
        const tx = func(...args)
        const signedHex = sanitise(await tx.sign(account, { nonce }))
        const numBytes = signedHex.length / 2 - 1

        return existentialDeposit
            + creationFee
            + baseFee
            + byteFee * numBytes
    }

    /**
     * @name    disconnect
     * @summary deferred disconnect from blockchain
     * 
     * @param   {Boolean}   force   set `true` if auto-disconnect is disabled and attempting to manually disconnect
     */
    deferredDisconnect = deferred(force => {
        const { provider } = this.connection
        if (!provider || !this.autoDisconnect && !force) return

        provider.disconnect()
        console.log(`${this.title}: ${this.texts.disconnected}`)
    }, this.disconnectDelay)

    /**
     * @name    getBalance
     * @summary get free balance of an identity
     * 
     * @param   {String} address
     * 
     * @returns {Number}
     */
    getBalance = async (address, func = 'api.query.system.account') => {
        const { data } = await this.query(func, [address])
        if (isStr(data.free)) {
            data.free = eval(data.free)
        }
        return data
    }

    /**
     * @name            getConnection
     * @summary         initiate a new or get exisiting connection to the Blockchain node
     * 
     * @param {String}  nodeUrls
     * 
     * @returns {Object} an object with the following properties: api, provider
     */
    getConnection = async () => {
        let { provider } = this.connection || {}
        if (!!provider) {
            if (!provider.isConnected) {
                this.log(this.texts.reconnecting)
                // Provider was disconnected. Attempt to reconnect
                provider.connect()

                // Wait 2 seconds for reconnection and provider to be updated accordingly
                await PromisE.delay(2000)

                // wait another 3 seconds if still not connected
                if (!provider.isConnected) await PromisE.delay(3000)
                this.log(this.texts.reconnected, provider.isConnected)
            }
            return this.connection
        }
        if (this.connectPromise) {
            await this.connectPromise
            return this.connection
        }

        this.log(this.texts.connecting, this.nodeUrls)
        provider = new WsProvider(this.nodeUrls, 100)
        this.connectPromise = ApiPromise.create({ provider })

        const api = await this.connectPromise
        this.connection.api = api
        this.connection.provider = provider
        this.log(this.texts.connected, isBrowser && this.connection)
        return this.connection
    }

    /**
     * @name    log
     * @param   {String} message 
     * @returns 
     */
    log = (...args) => console.log(`${this.title}:`, ...args)

    /**
     * @name    query
     * @summary Make storage API calls using PolkadotJS. All values returned will be sanitised.
     * 
     * 
     * @summary retrieve data from Blockchain storage using PolkadotJS API. All values returned will be sanitised.
     *
     * @param   {Function}    func    Path to the PolkadotJS API function as a string.
     *                                Eg: 'api.rpc.system.health'
     * @param   {Array}       args    Arguments to be supplied when invoking the API function.
     *                                To subscribe to the query, include a callback function as the last item.
     * @param   {Boolean}     multi   (optional) Whether to construct a multi-query.
     *                                Only used if `func` is a string and does not end with '.multi'.
     * @param   {Boolean}     print   (optional) If true, will print the sanitised result of the query
     *
     * @returns {Function|*}  If function is supplied in as the last item in `args`, will subscribe to the query.
     *                        For a subscription, will return the `unsubscribe` function.
     *                        Otherwise, sanitised value of the query result will be returned.
     */
    query = async (func, args = [], multi, print) => {
        const connection = await this.getConnection()
        const { api, provider } = connection
        if (!api || !provider?.isConnected) throw `${this.title}: ${this.texts.connectionFailed}`

        // if function is not supplied, simply return the api instance
        if (!func) return api
        // add .multi if required
        if (isStr(func) && multi && !func.endsWith('.multi')) func += '.multi'

        const fn = eval(func)
        console.log({ func, fn, api })
        if (!fn) throw new Error(`${this.texts.invalidApiFunc}: ${func}`)

        args = isArr(args) || !isDefined(args) ? args : [args]
        multi = isFn(fn) && !!multi
        const cb = args[args.length - 1]
        const isSubscribe = isFn(cb) && isFn(fn)

        if (isSubscribe) {
            // only add interceptor to process result
            args[args.length - 1] = result => {
                const sanitised = sanitise(result)
                print && console.log(func, sanitised)
                cb(sanitised, result)
            }
        }

        // For multi query arguments needs to be constructs as 2D Array.
        // If only one argument in @args is supplied, assume that it is a 2D array.
        // Otherwise, construct a 2D array as required by 
        const len = isSubscribe
            ? 2
            : 1
        if (multi && !isFn(args[0]) && args.length > len) {
            try {
                // remove subscription callback before processing arguments
                let interceptor
                if (isSubscribe) {
                    interceptor = args.slice(-1)[0]
                    args = args.slice(0, -1)
                }
                // construct a 2D array
                args = !isArr2D(args) ? [args] : [
                    args[0].map((_, i) =>
                        args.map(ar => ar[i])
                    )
                ]
                // re-add subscription callback
                if (isSubscribe) args.push(interceptor)

            } catch (err) {
                throw `${this.texts.invalidMutliArgsMsg} ${err}`
            }
        }
        const result = isFn(fn)
            ? await fn.apply(null, args)
            : fn
        !isSubscribe && print && console.log(JSON.stringify(result, null, 4))

        // auto disconnect, only if delay duration is specified
        this.deferredDisconnect()

        return isSubscribe
            ? result
            : sanitise(result)
    }

    /**
     * @name    transact
     * @summary initiate a transaction on the blockchain
     * 
     * @param   {String}    address  Identity address from which to initiate the transaction
     * @param   {String}    txFn   API function to execute. Must start with "api.tx."
     * @param   {Array}     funcArgs Arguments to be supplied to the `apiFunc`
     */
    signAndSend = async (address, txFn, funcArgs = [], rxStatus) => {
        const sender = this.keyringHelper.getPair(address)
        this.log(this.texts.txInitiating)

        return await new Promise(async (resolve, reject) => {
            try {
                const { api } = await this.getConnection() // DO NOT REMOVE
                txFn = isStr(txFn) && txFn.startsWith('api.tx.')
                    ? eval(txFn)
                    : txFn
                if (!isFn(txFn)) return reject(this.texts.invalidTxFunc)
                const tx = txFn(...funcArgs)
                await tx.signAndSend(sender, result => {
                    const { events, status } = result
                    const isFuture = status.type !== 'Future'
                    let hash = ''
                    this.log(this.texts.txStatus, status.type)

                    // notify
                    rxStatus && rxStatus.next(result)

                    // status.type = 'Future' means transaction will be executed in the future. 
                    // there is a transaction in the pool that hasn't finished execution. 
                    if (!status.isFinalized && isFuture) return
                    try {
                        // if status is "Future" block hash is not assigned yet!
                        hash = status.asFinalized.toHex()
                    } catch (e) { } // ignore error

                    // Extract custom errors from events
                    const eventErrors = events.map(({ event }) => {
                        if (!`${event.method}`.startsWith('Error')) return
                        const msg = (sanitise(event.meta).documentation || []).join(' ')
                        return `${event.method} (${event.section}): ${msg}`
                    }).filter(Boolean)

                    if (eventErrors.length > 0) {
                        this.log(this.texts.txFailed, { blockHash: hash, eventErrors })
                        return reject(eventErrors.join(' | '))
                    }

                    const eventsArr = sanitise(events).map((x, i) => ({
                        ...x.event,
                        method: events[i].event.method,
                        section: events[i].event.section,
                    }))
                        // exclude empty event data
                        .filter(event => event.data && event.data.length) || {}
                    this.log(this.texts.txCompletedAtBlock, hash, isBrowser && { eventsArr } || '')
                    rxStatus && rxStatus.complete()
                    resolve([hash, eventsArr])
                })
            } catch (err) {
                reject(err)
            }
        })
    }
}
