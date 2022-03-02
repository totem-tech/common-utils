import { formatNumber, shorten } from '../number'
import {
    isFn,
    isArr,
    isDefined,
    isObj,
    isStr,
    isArr2D,
    isNodeJS,
    deferred,
    hasValue,
    isSubjectLike,
    isValidNumber,
    isAsyncFn,
} from '../utils'
import PromisE from '../PromisE'
import getKeyringHelper, { KeyringHelper } from './keyringHelper'

// Indicates if run on a Browser or console using NodeJS
const isBrowser = !isNodeJS()
export const texts = {
    // error messages
    errAddress404: 'address not found in the keyring',
    errConnectionFailed: 'connection failed',
    errInvalidApiFunc: 'invalid query API function',
    errInvalidMutliArgsMsg: 'failed to process arguments for multi-query',
    errInvalidTxFunc: 'invalid transaction API function',
    errBlockNumber: 'unexpected error while fetching block number',
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
 * @param   {Object}        unit        (optional) token unit display settings.
 * @param   {Number}        unit.amount (optional) number of tokens per unit.
 *                                      Default: 1e10
 * @param   {Number}        unit.decimals (optional) number of decimal places.
 *                                      Default: 4
 * @param   {String}        unit.name   (optional) ticker/unit name.
 *                                      Default: 'DOT'
 *                                      
 */
export default class BlockchainHelper {
    constructor(
        nodeUrls,
        title,
        disconnectDelay = 300000,
        keyringHelper1 = getKeyringHelper(),
        textOverrides,
        unit = {},
    ) {
        const {
            amount = 1e10,
            decimals = 4,
            name = 'DOT',
        } = unit
        this.autoDisconnect = disconnectDelay > 0
        this.connection = {}
        this.disconnectDelay = this.autoDisconnect && disconnectDelay
        this.keyringHelper = keyringHelper1
        this.nodeUrls = hasValue(nodeUrls)
            ? nodeUrls
            : ['wss://rpc.polkadot.io']
        this.texts = {
            ...texts,
            ...textOverrides,
        }
        this.title = title || 'Polkadot Blockchain Network'
        this.unit = { amount, decimals, name }
    }

    /**
     * @name        calculateFees
     * @summary     estimate transaction fee for a specific transaction 
     * @description `feeBase` and `feePerbyte` should already be set using `setDefaultConfig()`. 
     *              Otherwise, value `1` will be used for both.
     * 
     * @param   {String}    txFunc        path to API function. Should start with "api.tx."
     * @param   {Array}     funcArgs    arguments to be supplied to the API function
     * @param   {String}    address     (optional) sender address.
     * 
     * @returns {Number}    estimated transaction fee plus existential deposit
     */
    calculateFees = async (txFunc, funcArgs, address, asString = true, decimals = 10) => {
        const tx = await this.tx(txFunc, funcArgs)
        const result = this.sanitise(
            tx && await tx.paymentInfo([address])
        )
        const { partialFee } = result || {}
        return this.formatAmount(partialFee, asString, decimals)
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
        this.log(this.texts.disconnected)
    }, this.disconnectDelay)

    /**
     * @name    formatAmount
     * 
     * @param   {Number}            value  
     * @param   {Boolean|String}    asString  (optional) whether to format as string. Accepts: true/false/'shorten'
     * @param   {Number}            decimals  (optional) number of decimal places to be formatted.
     *                                        Default: `this.unit.decimals`
     * 
     * @returns {String|Number}
     */
    formatAmount = (value, asString = false, decimals) => {
        const { amount, decimals: _decimals, name } = this.unit
        value = amount > 1
            ? value / amount
            : value

        if (!asString) return value

        if (!isValidNumber(decimals)) decimals = _decimals

        const formatter = asString === 'shorten'
            ? shorten
            : formatNumber
        return `${formatter(value, decimals)} ${name}`
    }

    /**
     * @name    getBalance
     * @summary get free balance of one or more identities
     * 
     * @param   {String|Array}  addresses
     * @param   {Function}      callback    (optional) to subscribe to the balance changes
     * @param   {String}        apiFunc     (optional) only required if default balance storage is not used.
     *                                      Default: `'api.query.system.account'`
     * 
     * @returns {Number|Array|Function}
     */
    getBalance = async (addresses, callback, apiFunc = 'api.query.system.account') => {
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
        const result = await this.query(apiFunc, addresses, isMulti)
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
        if (this.connectPromise?.pending) return await this.connectPromise

        let { api, provider } = this.connection || {}
        const connectWithoutRetry = () => new PromisE((resolve, reject) =>
            (async () => {
                try {
                    const { ApiPromise } = require('@polkadot/api')
                    const { WsProvider } = require('@polkadot/rpc-provider')
                    provider ??= new WsProvider(this.nodeUrls, false)
                    if (!provider.isConnected) {
                        this.log(this.texts.connecting, this.nodeUrls)
                        const unsubscribe = provider.on('error', () => {
                            this.log(this.texts.errConnectionFailed)
                            unsubscribe()
                            reject(`${this.title}: ${this.texts.errConnectionFailed}`)
                        })
                        await provider.connect()
                        unsubscribe()
                    }
                    api ??= await ApiPromise.create({ provider })
                    await api.ready
                    this.connection.api = api
                    this.connection.provider = provider
                    resolve(this.connection)
                } catch (err) {
                    reject(err)
                }
            })()
        )

        this.connectPromise = connectWithoutRetry()
        return await this.connectPromise
    }

    /**
     * @name    getCurrentBlock
     * @summary get the current block number
     * 
     * @param   {Function}  callback (optional) supply a callback function to subscribe to block nubmer changes
     * 
     * @returns {Number|Function} result or unsubscribe function
     */
    getCurrentBlock = async (callback) => {
        if (!isFn(callback)) {
            const res = await this.query('api.rpc.chain.getBlock')
            try {
                return res.block.header.number
            } catch (err) {
                this.log(this.texts.errBlockNumber, err)
                return 0
            }
        }
        return await this.query('api.rpc.chain.subscribeNewHeads', [res => callback(res.number)])
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
                print && this.log(func, sanitised)
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
        !isSubscribe && print && this.log(this.sanitise(result))

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
            return value.toJSON()
        }
        return JSON.parse(JSON.stringify(value))
    }

    /**
     * @name    signAndSend
     * @summary initiate a transaction on the blockchain
     * 
     * @param   {String} address    Identity address to send the transaction with.
     * @param   {String} txFunc     Prepared transactin or path to unprepared transactin API function to be prepared 
     *                              before execution. If path, it must start with "api.tx.".
     * @param   {Array}  txArgs     For unprepared transction, arguments to be suppiled to the transaction function.
     * @param   {*}      rxUpdater  (optional) RxJS subject to keep track of transaction progress.
     * @param   {*}      signer     (optional) to sign a transaction using an external signer (eg: PolkadotJS Extension)
     * 
     * @returns {Array}  [blockHash, eventErrors]
     */
    signAndSend = (address, txFunc, txArgs = [], rxUpdater, signer) => {
        return new Promise(async (resolve, reject) => {
            try {
                const sender = !!signer
                    ? address
                    : this.keyringHelper.getPair(address)
                this.log(this.texts.txInitiating)

                const isASubject = isSubjectLike(rxUpdater) && isFn(rxUpdater.complete)
                if (!sender) throw new Error('Sender identity not found in the keyring')

                const { api } = await this.getConnection() // DO NOT REMOVE
                const tx = await this.tx(txFunc, txArgs)
                const handleResult = result => {
                    const { events, status } = result
                    const isFuture = status.type !== 'Future'
                    let blockHash = ''
                    this.log(this.texts.txStatus, status.type)

                    // notify
                    isASubject && rxUpdater.next(result)

                    // status.type = 'Future' means transaction will be executed in the future. 
                    // there is a transaction in the pool that hasn't finished execution. 
                    if (!status.isFinalized && isFuture) return
                    try {
                        // if status is "Future" block hash is not assigned yet!
                        blockHash = status.asFinalized.toHex()
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

                    const success = eventErrors.length === 0

                    this.log(
                        success
                            ? this.texts.txCompletedAtBlock
                            : this.texts.txFailed,
                        blockHash,
                        isBrowser && { eventErrors } || '',
                    )

                    // mark updater subject as completed
                    isASubject && rxUpdater.complete()

                    success
                        ? resolve([blockHash, eventErrors])
                        : reject(eventErrors.join(' | '))
                }
                const args = [
                    sender,
                    signer && { signer },
                    handleResult,
                ].filter(Boolean)
                return await tx.signAndSend(...args)
            } catch (err) {
                reject(err)
            }
        })
    }

    /**
     * @name    tx
     * @summary connects to blcokchain and prepares a transction to be executed
     * 
     * @param   {String}    txFunc  API function to execute. Must start with "api.tx."
     * @param   {Array}     txArgs  Arguments to be supplied to the `apiFunc`
     * 
     * @returns {*} signed transaction
     */
    tx = async (txFunc, txArgs) => {
        if (hasValue(txFunc) && !isStr(txFunc)) {
            return txFunc
        }

        const { api } = await this.getConnection()
        // DO NOT REMOVE. If txFunc is string this is used to extract the function from API instance
        eval(api)

        txFunc = isStr(txFunc) && txFunc.startsWith('api.tx.')
            ? eval(txFunc)
            : txFunc
        if (!isFn(txFunc)) throw new Error(this.texts.errInvalidTxFunc)

        const tx = await txFunc(...txArgs)
        return tx
    }
}