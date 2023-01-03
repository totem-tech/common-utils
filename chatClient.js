import { BehaviorSubject } from 'rxjs'
import ioClient from 'socket.io-client'
import storage from '../utils/storageHelper'
import { isArr, isFn, isObj, isStr, objWithoutKeys } from './utils'
import { translated } from './languageHelper'
import { subjectAsPromise } from './reactHelper'

const textsCap = translated({
    invalidRequest: 'invalid request',
}, true)[1]

// chat server port
// use 3003 for dev.totem.live otherwise 3001
const port = window.location.hostname === 'dev.totem.live' ? 3003 : 3001
let instance, socket;
const MODULE_KEY = 'messaging'
const PREFIX = 'totem_'
// include any ChatClient property that is not a function or event that does not have a callback
const nonCbs = ['isConnected', 'disconnect']
// read or write to messaging settings storage
const rw = value => storage.settings.module(MODULE_KEY, value) || {}
export const rxIsConnected = new BehaviorSubject(false)
export const rxIsLoggedIn = new BehaviorSubject(null)
export const rxIsRegistered = new BehaviorSubject(!!(rw().user || {}).id)
export const rxIsInMaintenanceMode = new BehaviorSubject(false)
export const rxUserIdentity = new BehaviorSubject((getUser() || {}).address)
const eventMaintenanceMode = 'maintenance-mode'

//- migrate existing user data
const deprecatedKey = PREFIX + 'chat-user'
try {
    const oldData = localStorage[deprecatedKey]
    if (oldData) {
        localStorage.removeItem(deprecatedKey)
        rw({ user: JSON.parse(oldData) })
    }
} catch (e) { }
// remove trollbox chat history items
if (rw().history) rw({ history: null })
//- migrate end

// retrieves user credentails from local storage
export function getUser() { return rw().user }
export const setUser = (user = {}) => rw({ user })
/**
 * @name    referralCode
 * @summary get/set referral code to LocalStorage
 * 
 * @param   {String|null} code referral code. Use `null` to remove from storage
 * 
 * @returns {String} referral code
 */
export const referralCode = code => {
    const override = code === null
    const value = isStr(code)
        ? { referralCode: code }
        : override
            // completely remove referral code property from storage
            ? objWithoutKeys(rw(), ['referralCode'])
            : undefined

    return (storage.settings.module(MODULE_KEY, value, override) || {})
        .referralCode
}

/**
 * @name    getClient
 * @summary Returns a singleton instance of the websocket client.
 * Instantiates the client if not already done.
 * 
 * @returns {ChatClient}
 */
export const getClient = () => {
    if (instance) return instance

    instance = new ChatClient()
    // attach a promise() functions to all event related methods. 
    // promise() will take the exactly the same arguments as the orginal event method.
    // however the callback is optional here as promise() will add an interceptor callback anyway.
    //
    // Example: use of client.message
    //     without promise:
    //          client.messate('hello universe!', (err, arg0, arg1) => console.log({err, arg0, arg1}))
    //     with promise:
    //          try {
    //              const result = await client.message.promise('hello universe!')
    //          } catch(errMsg) { 
    //              console.log(errMsg)
    //          }
    //
    Object.keys(instance)
        .forEach(key => {
            const func = instance[key]
            if (!isFn(func) || nonCbs.includes(key)) return
            func.promise = function () {
                const args = [...arguments]
                return new Promise(async (resolve, reject) => {
                    try {
                        // last argument must be a callback
                        let callbackIndex = args.length - 1
                        const originalCallback = args[callbackIndex]
                        // if last argument is not a callback increment index to add a new callback
                        // on page reload callbacks stored by queue service will become null, due to JSON spec
                        if (!isFn(originalCallback) && originalCallback !== null) callbackIndex++
                        args[callbackIndex] = (...cbArgs) => {
                            // first argument indicates whether there is an error.
                            const err = translateError(cbArgs[0])
                            isFn(originalCallback) && originalCallback.apply({}, cbArgs)
                            if (!!err) return reject(err)
                            const result = cbArgs.slice(1)
                            // resolver only takes a single argument
                            // if callback is invoked with more than one value (excluding error message),
                            // then resolve with an array of value arguments, otherwise, resolve with only the result value.
                            resolve(result.length > 1 ? result : result[0])
                        }

                        // functions allowed during maintenace mode
                        const maintenanceModeKeys = [
                            'maintenanceMode',
                            'login'
                        ]
                        const doWait = rxIsInMaintenanceMode.value && !maintenanceModeKeys.includes(key)
                        if (doWait) {
                            console.info('Waiting for maintenance mode to be deactivated')
                            await subjectAsPromise(rxIsInMaintenanceMode, false)[0]
                            console.info('Maintenance mode is now deactivated')
                        }
                        const emitted = func.apply(instance, args)
                        // reject if one or more requests 
                        if (!emitted) reject(textsCap.invalidRequest)
                    } catch (err) {
                        reject(err)
                    }
                })
            }
        })

    instance.onConnect(async () => {
        const active = await instance.maintenanceMode.promise(null, null)
        rxIsInMaintenanceMode.next(active)
        rxIsConnected.next(true)
        if (!rxIsRegistered.value) return

        // auto login on connect to messaging service
        const { id, secret } = getUser() || {}
        instance.login
            .promise(id, secret)
            .then(() => console.log(new Date().toISOString(), 'Logged into messaging service'))
            .catch(console.error)
    })
    instance.onConnectError(() => {
        rxIsConnected.next(false)
        rxIsLoggedIn.next(false)
    })
    socket.on('disconnect', () => {
        rxIsConnected.next(false)
        rxIsLoggedIn.next(false)
    })
    instance.onMaintenanceMode(active => {
        console.log('onMaintenanceMode', active)
        rxIsInMaintenanceMode.next(active)
    })
    return instance
}

/**
 * @name    translateInterceptor
 * @summary translate error messages returned from messaging
 * 
 * @param {Function} cb 
 */
export const translateError = err => {
    // if no error return as is
    if (!err) return err

    if (isObj(err)) {
        const keys = Object.keys(err)
        // no errors
        if (keys.length === 0) return null
        return keys.forEach(key => err[key] = translateError(err[key]))
    }

    // translate if there is any error message
    const inputNameSeperator = ' => '
    const infoSeperator = ': '
    let inputName = ''
    let message = err
    let suffix = ''
    let arr = err.split(inputNameSeperator)
    if (arr.length > 1) {
        inputName = arr[0]
        message = arr[1]
    }
    arr = message.split(infoSeperator)
    if (arr.length > 1) {
        message = arr[0]
        suffix = arr[1]
    }
    const texts = translated({
        inputName,
        message,
        suffix,
    }, true)[1]

    return [
        texts.inputName,
        texts.inputName && inputNameSeperator,
        texts.message,
        texts.suffix && infoSeperator,
        texts.suffix
    ]
        .filter(Boolean)
        .join('')
}

// Make sure to always keep the callback as the last argument
export class ChatClient {
    constructor(url) {
        this.url = url || `${window.location.hostname}:${port}`
        socket = ioClient(this.url, {
            transports: ['websocket'],
            // secure: true,
            // rejectUnauthorized: false,
        })

        this.isConnected = () => socket.connected
        this.onConnect = cb => socket.on('connect', cb)
        this.onReconnect = cb => socket.on('reconnect', cb)
        // this.onConnectTimeout = cb => socket.on('connect_timeout', cb);
        this.onConnectError = cb => socket.on('connect_error', cb);
        // this.onDisconnect = cb => socket.on('disonnect', cb)  // doesn't work
        this.disconnect = () => socket.disconnect()
        this.onError = cb => socket.on('error', cb)

        // add/get company by wallet address
        //
        // Params:
        // @hash       string
        // @company    object  : if not supplied will return existing company by @identity 
        //                 required keys:
        //                       'countryCode',          // 2 letter country code
        //                       'identity',
        //                       'name',                 // name of the company
        //                       'registrationNumber',   // company registration number for the above country
        // @cb         function: params =>
        //                 @err    string/null/object : error message or null if success or existing company if @company not supplied
        this.company = (hash, company, cb) => isFn(cb) && socket.emit('company', hash, company, cb)
        // search companies
        //
        // Params:
        // @query                   string
        // @searchParentIdentity    boolean: if false will search for both identity and parentIdentity
        // @cb                      function: params =>
        //                              @err    string/null : error message or null if success
        //                              @result Map         : Map of companies with identity as key
        this.companySearch = (query, searchParentIdentity, cb) => isFn(cb) && socket.emit('company-search',
            query,
            searchParentIdentity,
            (err, result) => cb(
                err,
                new Map(
                    isArr(result)
                        ? result
                        : []
                ),
            ),
        )

        // Get list of all countries
        //
        // Params:
        // @hash    string: hash generated by the Map of existing countries to compare with the ones stored on the server
        // @cb      function
        this.countries = (hash, cb) => isFn(cb) && socket.emit('countries',
            hash,
            (err, countries) => cb(err, new Map(countries)),
        )

        // Currency conversion
        //
        // Params:
        // @from    string: source currency ID
        // @to      string: target currency ID
        // @amount  number: amount in source currency
        // @cb      function: args:
        //              @err                string: message in case of error. Otherwise, null.
        //              @convertedAmount    number: amount in target currency
        this.currencyConvert = (from, to, amount, cb) => isFn(cb) && socket.emit('currency-convert',
            from,
            to,
            amount,
            cb,
        )

        // Get a list of all supported currencies
        // 
        // Params:
        // @tickersHash string: (optional) hash generated using the sorted array of currency tickers
        // @calblack    function: args =>
        //                  @err    string: message in case of error. Otherwise, null.
        //                  @list   map: list of all currenies (objects)
        this.currencyList = (hash, cb) => isFn(cb) && socket.emit('currency-list', hash, cb)

        this.currencyPricesByDate = (date, currencyIds, cb) => isFn(cb) && socket.emit('currency-prices-by-date',
            date,
            currencyIds,
            cb,
        )

        // Request funds
        this.faucetRequest = (address, cb) => isFn(cb) && socket.emit('faucet-request', address, cb)

        // Check if User ID Exists
        this.idExists = (userId, cb) => isFn(cb) && socket.emit('id-exists', userId, cb)

        // Check if User ID Exists
        this.isUserOnline = (userId, cb) => isFn(cb) && socket.emit('is-user-online', userId, cb)

        this.glAccounts = (accountNumbers, cb) => isFn(cb) && socket.emit('gl-accounts', accountNumbers, cb)

        // FOR BUILD MODE ONLY
        // Retrieve a list of error messages used in the messaging service
        //
        // Params:
        // @cb      function: args => 
        //                  @err        string: error message if request fails
        //                  @messages   array
        this.languageErrorMessages = cb => isFn(cb) && socket.emit('language-error-messages', cb)

        // retrieve a list of translated application texts for a specific language
        //
        // Params: 
        // @langCode    string: 2 digit language code
        // @hash        string: (optional) hash of client's existing translated texts' array to compare whether update is required.
        // @cb          function: arguments =>
        //              @error  string/null: error message, if any. Null indicates no error.
        //              @list   array/null: list of translated texts. Null indicates no update required.
        this.languageTranslations = (langCode, hash, cb) => isFn(cb) && socket.emit('language-translations',
            langCode,
            hash,
            cb,
        )

        /**
         * @name    maintenanceMode
         * @summary check/enable/disable maintenance mode. Only admin users will be able change mode.
         * 
         * @param   {Boolean}     active
         * @param   {Function}    cb 
         */
        this.maintenanceMode = (active, cb) => isFn(cb) && socket.emit(eventMaintenanceMode, active, cb)
        /**
         * @name    onMaintenanceMode
         * @summary event received whenever messaging service is in/out of maintenance mode
         * 
         * @param   {Function} cb args: @active Boolean
         */
        this.onMaintenanceMode = cb => socket.on(eventMaintenanceMode, cb)

        // Send chat messages
        //
        // Params:
        // @userIds    array: User IDs without '@' sign
        // @message    string: encrypted or plain text message
        // @encrypted  bool: determines whether @message requires decryption
        this.message = (receiverIds, msg, encrypted, cb) => isFn(cb) && socket.emit('message',
            receiverIds,
            msg,
            encrypted,
            cb,
        )
        // receive chat messages
        //
        // 
        // Params:
        // @cb  function: callback arguments => 
        //          @senderId       string: 
        //          @receiverIds    array: User IDs without '@' sign
        //          @message        string: encrypted or plain text message
        //          @encrypted      bool: determines whether @message requires decryption
        this.onMessage = cb => isFn(cb) && socket.on('message', cb)

        // Send chat messages
        //
        // Params:
        // @lastMsgTs   string: timestamp of most recent message sent/received
        // @cb          function: args =>
        //                  @err        string: error message, if any
        //                  @messages   array: most recent messages
        this.messageGetRecent = (lastMsgTs, cb) => isFn(cb) && socket.emit('message-get-recent', lastMsgTs, cb)

        // Set group name
        this.messageGroupName = (receiverIds, name, cb) => isFn(cb) && socket.emit('message-group-name',
            receiverIds,
            name,
            cb,
        )

        /**
         * @name    newsletterSignup
         * @summary sign up to newsletter and updates
         * 
         * @param   {Object}    values required fields: name and email
         * @param   {Function}  cb
         */
        this.newsletterSignup = (values, cb) => isFn(cb) && socket.emit('newsletter-signup', values, cb)

        // Send notification
        //
        // Params:
        // @toUserIds   array    : receiver User ID(s)
        // @type        string   : parent notification type. Eg: timeKeeping
        // @childType   string   : child notification type. Eg: invitation
        // @message     string   : message to be displayed (unless custom message required). can be encrypted later on
        // @data        object   : information specific to the type of notification
        // @cb          function : callback function
        //                         Params:
        //                         @err string: error message if failed or rejected
        this.notify = (toUserIds, type, childType, message, data, cb) => isFn(cb) && socket.emit('notification',
            toUserIds,
            type,
            childType,
            message,
            data,
            cb,
        )
        // Receive notification. 
        //
        // Params:
        // @cb function: callback function
        //          Arguments:
        //          @id         string: notification ID
        //          @senderId   string: sender user ID
        //          @type       string: parent notification type
        //          @childType  string: child notification type
        //          @message    string: notification message
        //          @data       object: information specific to the notification @type and @childType
        //          @tsCreated  date: notification creation timestamp
        //          @cbConfirm  function: a function to confirm receipt
        this.onNotify = cb => isFn(cb) && socket.on('notification', cb)
        this.notificationGetRecent = (ts, cb) => isFn(cb) && socket.emit(
            'notification-get-recent',
            ts,
            (err, result) => cb(err, new Map(result))
        )
        // Mark notification as read or deleted
        //
        // Params:
        // @id      string: Notification ID
        // @read    boolean: marks as read or unread
        // @deleted boolean: marks as deleted or undeleted
        // @cb      function: callback args =>
        //              @err    string: error message, if any
        //              @
        this.notificationSetStatus = (id, read, deleted, cb) => isFn(cb) && socket.emit(
            'notification-set-status',
            id,
            read,
            deleted,
            cb
        )

        /**
         * @name    project
         * @summary add/get/update project
         *
         * 
         * @param {String}   projectId   Project ID
         * @param {Object}   project
         * @param {Boolean}  create      whether to create or update project
         * @param {Function} cb          
         */
        this.project = (projectId, project, create, cb) => socket.emit('project',
            projectId,
            project,
            create,
            cb,
        )
        // retrieve projects by an array of hashes
        this.projectsByHashes = (projectIds, cb) => isFn(cb) && socket.emit(
            'projects-by-hashes',
            projectIds,
            (err, res, notFoundHashes) => cb(err, new Map(res), notFoundHashes),
        )

        /**
         * @name    rewardsClaim
         * @summary submits social rewards claim
         * 
         * @param   {String}    platform    social media platform name. Eg: twitter
         * @param   {String}    handle      user's social media handle/username
         * @param   {String}    postId      social media post ID
         * @param   {Function}  cb          Callback function expected arguments:
         *                                  @err    String: error message if query failed
         *                                  @code   String: hex string
         */
        this.rewardsClaim = (platform, handle, postId, cb) => isFn(cb) && socket.emit(
            'rewards-claim',
            platform,
            handle,
            postId,
            cb
        )

        /**
         * @name    handleClaimKapex
         * @summary Handle claim requests to migrate Meccano testnet reward tokens to Kapex chain.
         * This is to simply mark that the user has completed the required tasks.
         * At the end of the claim period, all requests will be validated and checked for fradulent claims.
         * 
         * @param   {Boolea|Object} data.checkEligible  To check if user is eligible to migrate rewards.
         * @param   {Boolea|Object} data.checkSubmitted To check if user already submitted their claim.
         * @param   {String}        data.identity       Identity that completed the tasks and to distribute $KAPEX.
         * @param   {Function}      callback            callback function expected arguments:
         *                                              @err    String: error message if query failed
         */
        this.rewardsClaimKAPEX = (identity, cb) => isFn(cb) && socket.emit('rewards-claim-kapex', identity, cb)

        /**
         * @name    rewardsGetData
         * @summary retrieves all received rewards by the user
         *
         * @param   {Function}  cb  Callback function expected arguments:
         *                          @err     String: error message if query failed
         *                          @rewards Object:
         */
        this.rewardsGetData = cb => isFn(cb) && socket.emit('rewards-get-data', cb)

        /**
         * @name    task
         * @summary saves off-chain task details to the database.
         * Requires pre-authentication using BONSAI with the blockchain identity that owns the task.
         * Login is required simply for the purpose of logging the User ID who saved the data.
         * 
         * @description 'task-market-created' event will be broadcasted whenever a new marketplace task is created.
         * @param {String}   taskId          task ID
         * @param {Object}   task
         * @param {String}   ownerAddress    task owner identity
         * @param {Function} callback        callback args:
         *                                      @err    string: error message, if unsuccessful
         */
        this.task = (id, task, ownerAddress, cb) => isFn(cb) && socket.emit('task', id, task, ownerAddress, cb)

        /**
         * @name    taskGetById
         * @summary retrieve a list of tasks details by Task IDs
         * 
         * @param   {String|Array}  ids single or array of Task IDs
         * @param   {Function}      cb Callback function expected arguments:
         *                      @err    String: error message if query failed
         *                      @result Map: list of tasks with details
         */
        this.taskGetById = (ids, cb) => isFn(cb) && socket.emit(
            'task-get-by-id',
            ids,
            (err, result) => cb(err, new Map(result)),
        )

        /**
         * @name    taskGetByParentId
         * @summary search for tasks by parent ID
         * 
         * @param   {String}    parentId 
         * @param   {Function}  callback Callback function expected arguments:
         *                               @err    String: error message if query failed
         *                               @result Map: list of tasks with details
         */
        this.taskGetByParentId = (parentId, cb) => isFn(cb) && socket.emit(
            'task-get-by-parent-id',
            parentId,
            (err, result) => cb(err, new Map(result))
        )

        /**
         * @name    taskMarketApply
         * @summary apply for an open marketplace task
         * 
         * @param   {Object}    application
         * @param   {Array}     application.links
         * @param   {String}    application.proposal
         * @param   {String}    application.taskId
         * @param   {String}    application.workerAddress
         * @param   {Function}  cb  Callback function expected arguments:
         *                          @err    String: error message if request failed
         */
        this.taskMarketApply = (application, cb) => isFn(cb) && socket.emit(
            'task-market-apply',
            application,
            (err, result) => cb(err, new Map(result)),
        )

        /**
         * @name    onTaskMarketCreated
         * @summary subscribe to new marketplace task creation event
         * 
         * @param   {Function} cb   args: @taskId string
         */
        this.onTaskMarketCreated = cb => isFn(cb) && socket.on('task-market-created', cb)

        /**
         * @name    taskMarketApplyResponse
         * @summary task owner/publisher accept/rejects application(s)
         * 
         * @param   {Object}    data 
         * @param   {Boolean}   data.rejectOthers   (optional) if true applications other than accepted will be rejected
         * @param   {Boolean}   data.silent         (optional) whether to skip notification for rejected applications
         * @param   {Boolean}   data.status         set accepted/rejected status for a specific applicant
         * @param   {String}    data.taskId
         * @param   {String}    data.workerAddress
         * @param   {Function}  callback            Args: [error String, updateCount Number]
         */
        this.taskMarketApplyResponse = (data, cb) => isFn(cb) && socket.emit(
            'task-market-apply-response',
            data,
            cb,
        )

        /**
         * @name    taskGetById
         * @summary retrieve a list of tasks details by Task IDs
         * 
         * @param   {Object}    filter  single or array of Task IDs
         * @param   {Function}  cb      Callback function expected arguments:
         *                              @err    String: error message if query failed
         *                              @result Map: list of tasks with details
         */
        this.taskMarketSearch = (filter = {}, cb) => isFn(cb) && socket.emit(
            'task-market-search',
            filter,
            (err, result) => cb(err, new Map(result)),
        )

        /**
         * @name    crowdsaleCheckDeposits
         * @summary check and retrieve user's crowdsale deposits
         * 
         * @param {Function}    cb  callback function arguments:
         *                          @err        string: if request failed
         *                          @result     object: 
         *                              @result.deposits    object: deposit amounts for each allocated addresses
         *                              @result.lastChecked string: timestamp of last checked
         * 
         */
        this.crowdsaleCheckDeposits = (cached = true, cb) => isFn(cb) && socket.emit(
            'crowdsale-check-deposits',
            cached,
            cb,
        )

        /**
         * @name    crowdsaleConstants
         * @summary retrieve crowdsale related constants for use with calcuation of allocation and multiplier levels
         * 
         * @param {Function}    cb  callback function arguments:
         *                          @err        string: if request failed
         *                          @result     object:
         *                              @result.Level_NEGOTIATE_Entry_USD   Number: amount in USD for negotiation
         *                              @result.LEVEL_MULTIPLIERS   Array: multipliers for each level
         *                              @result.LEVEL_ENTRY_USD     Array: minimum deposit amount in USD for each level 
         */
        this.crowdsaleConstants = cb => isFn(cb) && socket.emit(
            'crowdsale-constants',
            cb,
        )
        /**
         * @name    crowdsaleDAA
         * @summary request new or retrieve exisitng deposit address
         * 
         * @param   {String}    blockchain  ticker of the Blockchain to request/retrieve address of
         * @param   {String}    ethAddress  use `0x0` to retrieve existing address.
         *                                  If the @blockchain is `ETH`, user's Ethereum address for whitelisting.
         *                                  Otherwise, leave an empty string.
         * @param   {Function}  cb          callback function arguments:
         *                                  @err     string: if request failed
         *                                  @address string: deposit address
         */
        this.crowdsaleDAA = (blockchain, ethAddress, cb) => isFn(cb) && socket.emit(
            'crowdsale-daa',
            blockchain,
            ethAddress,
            cb,
        )

        /**
         * @name    crowdsaleKYC
         * @summary register for crowdsale or check if already registered
         * 
         * @param   {Object|Boolean}    kycData use `true` to check if user already registered.
         *                                      Required object properties:
         *                                      @email      string
         *                                      @familyName string
         *                                      @givenName  string
         *                                      @identity   string
         *                                      @location   object
         * @param   {Function}          cb      arguments:
         *                                      @err        string
         *                                      @publicKey  string
         */
        this.crowdsaleKYC = (kycData, cb) => isFn(cb) && socket.emit(
            'crowdsale-kyc',
            kycData,
            cb,
        )

        /**
         * @name    crowdsaleKYCPublicKey
         * @summary get Totem Live Association's encryption public key
         * 
         * @param   {Function}          cb      arguments:
         *                                      @err        string
         *                                      @publicKey  string
         */
        this.crowdsaleKYCPublicKey = cb => isFn(cb) && socket.emit(
            'crowdsale-kyc-publicKey',
            cb,
        )
    }

    /**
     * @name    register
     * @summary register new user
     * 
     * @param   {String}    id          new user ID
     * @param   {String}    secret
     * @param   {String}    address     Blockchain identity
     * @param   {String}    referredBy  (optional) referrer user ID
     * @param   {Function}  cb 
     */
    register = (id, secret, address, referredBy, cb) => isFn(cb) && socket.emit('register',
        id,
        secret,
        address,
        referredBy,
        err => {
            if (!err) {
                setUser({ address, id, secret })
                rxIsLoggedIn.next(true)
                rxIsRegistered.next(true)
                rxUserIdentity.next(address)
            }
            cb(err)
        },
    )

    login = (id, secret, cb) => isFn(cb) && socket.emit('login',
        id,
        secret,
        async (err, data) => {
            const { address } = data || {}
            const isLoggedIn = !err
            // store user roles etc data sent from server
            isLoggedIn && setUser({ ...getUser(), ...data })
            rxUserIdentity.next(address)

            // wait until maintenance mode is turned off
            rxIsInMaintenanceMode.value && await subjectAsPromise(rxIsInMaintenanceMode, false)

            if (isLoggedIn !== rxIsLoggedIn.value) rxIsLoggedIn.next(isLoggedIn)
            err && console.log('Login failed', err)
            cb(err, data)
        })
}
export default getClient()