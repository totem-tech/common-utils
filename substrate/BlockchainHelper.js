import { ApiPromise, WsProvider } from '@polkadot/api'
import {
    isFn,
    isArr,
    isDefined,
    isObj,
    isStr,
    isArr2D,
    isNodeJS,
    deferred,
} from '../utils'
import keyringHelper, { KeyringHelper } from './keyringHelper'

// Indicates if run on a Browser or console using NodeJS
const isBrowser = !isNodeJS()
export const texts = {
    // error messages
    errAddress404: 'Address not found in the keyring',
    errConnectionFailed: 'connection failed',
    errInvalidApiFunc: 'Invalid query API function',
    errInvalidMutliArgsMsg: 'Failed to process arguments for multi-query',
    errInvalidTxFunc: 'Invalid transaction API function',
    // Log messages
    connected: 'connected',
    connecting: 'connecting',
    disconnected: 'disconnected',
    reconnecting: 'attempting to reconnect...',
    reconnected: 'reconnected',
    txInitiating: 'initiating transation',
    txFailed: 'transaction failed',
    txStatus: 'transaction status',
    txCompletedAtBlock: 'transaction completed at block hash',
}

/**
 * @name PolkadotHelper
 * 
 * @param   {Array}     nodeUrls        blockchain node URLs.
 *                                      Default: `['wss://rpc.polkadot.io']`
 * @param   {String}    title           name of the blockchain for use with logging.
 *                                      Default: `"Polkadot Blockchain Network"`
 * @param   {Number}    disconnectDelay Delay in number of milliseconds to wait before automatically disconnecting
 *                                      from the network after making a query. If not a positive integer,
 *                                      will not auto-disconnect.
 *                                      Default: `300000`
 * @param   {KeyringHelper} keyringHelper1 (optional) if undefined, will use global keyring
 * @param   {Object}        textOverrides   Internal message overrides. Eg: useful when using a different language.
 */
export default class BlockchainHelper {
    constructor(nodeUrls, title, disconnectDelay = 300000, keyringHelper1 = keyringHelper, textOverrides) {
        this.autoDisconnect = disconnectDelay > 0
        this.connection = {}
        this.disconnectDelay = this.autoDisconnect && disconnectDelay
        this.texts = {
            ...texts,
            ...textOverrides,
        }
        this.nodeUrls = nodeUrls || ['wss://rpc.polkadot.io']
        this.title = title || 'Polkadot Blockchain Network'
        this.keyringHelper = keyringHelper1
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
        const signedHex = this.sanitise(await tx.sign(account, { nonce }))
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
     * @summary get free balance of one or more identities
     * 
     * @param   {String|Array}  addresses
     * @param   {Function}      callback
     * 
     * @returns {Number|Array|Function}
     */
    getBalance = async (addresses, callback) => {
        addresses = isArr(addresses)
            ? addresses
            : [addresses]
        const doSubscribe = isFn(callback)

        const handleResult = (result) => {
            if (isArr(result)) return result.map(handleResult)

            const { data } = result
            data.free = isStr(data.free)
                ? eval(data.free)
                : data.free
            doSubscribe && callback(data)
            return data
        }

        const isMulti = addresses.length > 1
        if (doSubscribe) addresses.push(handleResult)
        const result = await this.query('api.query.system.account', addresses, isMulti)
        return doSubscribe
            ? result
            : handleResult(result)
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
        if (!api || !provider?.isConnected) throw new Error(this.texts.errConnectionFailed)

        // if function is not supplied, simply return the api instance
        if (!func) return api
        // add .multi if required
        if (isStr(func) && multi && !func.endsWith('.multi')) func += '.multi'

        const fn = eval(func)
        if (!fn) throw new Error(this.texts.errInvalidApiFunc)

        args = isArr(args) || !isDefined(args) ? args : [args]
        multi = isFn(fn) && !!multi
        const cb = args[args.length - 1]
        const isSubscribe = isFn(cb) && isFn(fn)

        if (isSubscribe) {
            // only add interceptor to process result
            args[args.length - 1] = result => {
                const sanitised = this.sanitise(result)
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
                throw `${this.texts.errInvalidMutliArgsMsg}: ${err.message}`
            }
        }
        const result = isFn(fn)
            ? await fn.apply(null, args)
            : fn
        !isSubscribe && print && console.log(this.sanitise(result))

        // auto disconnect, only if delay duration is specified
        this.deferredDisconnect()

        return isSubscribe
            ? result
            : this.sanitise(result)
    }

    /**
     * @name    sanitise
     * @summary get rid of jargon from PolkadotJS results
     * 
     * @param   {*} value 
     * 
     * @returns {*}
     */
    sanitise = value => {
        if (isObj(value) && isFn(value.toJSON)) {
            // console.log('Got .toJSON()', value)
            return value.toJSON()
        }
        return JSON.parse(JSON.stringify(value))
    }

    /**
     * @name    sign
     * @summary sign a transaction
     * 
     * @param   {String}    address  Identity address from which to initiate the transaction
     * 
     * @returns {*} signed transaction
     */
    send = async (address, signedTx, rxStatus) => {
        const sender = this.keyringHelper.getPair(address)
        if (!sender) throw new Error(this.texts.errAddress404)
        const { api } = await this.getConnection()


    }

    /**
     * @name    sign
     * @summary sign a transaction
     * 
     * @param   {String}    txFunc   API function to execute. Must start with "api.tx."
     * @param   {Array}     funcArgs Arguments to be supplied to the `apiFunc`
     * 
     * @returns {*} signed transaction
     */
    sign = async (txFunc, funcArgs) => {
        // DO NOT REMOVE. If txFunc is string this is used to extract the function from API instance
        const { api } = await this.getConnection()
        eval(api)

        txFunc = isStr(txFunc) && txFunc.startsWith('api.tx.')
            ? eval(txFunc)
            : txFunc
        if (!isFn(txFunc)) throw new Error(this.texts.errInvalidTxFunc)
        const tx = txFunc(...funcArgs)
        return tx
    }

    /**
     * @name    signAndSend
     * @summary initiate a transaction on the blockchain
     * 
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
                if (!isFn(txFn)) return reject(this.texts.errInvalidTxFunc)
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
                    const eventErrors = events
                        .filter(e => api.events.system.ExtrinsicFailed.is(e.event))
                        .map(({ event: { data: [error] } }) => {
                            if (error.isModule) {
                                // for module errors, we have the section indexed, lookup
                                const decoded = api.registry.findMetaError(error.asModule);
                                const { docs, method, section } = decoded;

                                return `${section} (${method}): ${docs.join(' ')}`
                            }
                            // Other, CannotLookup, BadOrigin, no extra info
                            return error.toString()
                        }).filter(Boolean)

                    if (eventErrors.length > 0) {
                        this.log(this.texts.txFailed, { blockHash: hash, eventErrors })
                        return reject(eventErrors.join(' | '))
                    }

                    this.log(this.texts.txCompletedAtBlock, hash, isBrowser && { eventErrors } || '')
                    rxStatus && rxStatus.complete()
                    resolve([hash, eventErrors])
                })
            } catch (err) {
                reject(err)
            }
        })
    }
}