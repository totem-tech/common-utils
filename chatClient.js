import { BehaviorSubject } from 'rxjs'
import ioClient from 'socket.io-client'
import { translated } from './languageHelper'
import storage from './storageHelper'
import { subjectAsPromise } from './reactHelper'
import { isAsyncFn, isFn, isInteger, isObj, isStr, isValidNumber, objWithoutKeys } from './utils'
import PromisE from './PromisE'

let instance, socket, hostname
let port = 3001
const TOTEM_LIVE = 'totem.live'
try {
    hostname = window.location.hostname
    if (hostname !== 'localhost' && !hostname.endsWith(TOTEM_LIVE)) throw 'use prod'
    // use 3003 for dev.totem.live otherwise 3001 for production
    port = hostname === 'dev.totem.live'
        ? 3003
        : port
} catch (err) {
    // use production URL as default where `window` is not available
    // or if not accessed from totem.live
    hostname = TOTEM_LIVE
}
const defaultServerURL = `${hostname}:${port}`
const MODULE_KEY = 'messaging'
const PREFIX = 'totem_'
// read or write to messaging settings storage
const rw = value => storage.settings.module(MODULE_KEY, value) || {}
export const rxIsConnected = new BehaviorSubject(false)
export const rxIsLoggedIn = new BehaviorSubject(null)
export const rxIsRegistered = new BehaviorSubject(!!(rw().user || {}).id)
export const rxIsInMaintenanceMode = new BehaviorSubject(false)
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
// remove legacy trollbox chat history items
if (rw().history) rw({ history: null })
//- migrate end


// Returns a singleton instance of the websocket client
// Instantiates the client if not already done
export const getClient = (...args) => {
    if (instance) return instance
    // automatically login to messaging service
    const { id, secret } = getUser() || {}

    // create a new instance
    instance = new ChatClient(...args)

    // on successful conenction login using user credentials and check if messaging server is in maintenance mode
    instance.onConnect(async () => {
        try {
            const active = await instance.maintenanceMode()
            rxIsInMaintenanceMode.next(active)
            rxIsConnected.next(true)
            // auto login on connect to messaging service
            !!id && instance.login(id, secret)
                .then(() => console.log(new Date().toISOString(), 'Logged into Totem Messaging Service'))
        } catch (err) {
            console.error(err)
        }
    })
    instance.onConnectError(() => {
        rxIsConnected.next(false)
        !!id && rxIsLoggedIn.next(false)
    })
    instance.onMaintenanceMode(active => {
        console.log('onMaintenanceMode', active)
        rxIsInMaintenanceMode.next(active)
    })
    return instance
}

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
 * @name    setUser
 * @summary retrieves user credentails from local storage
 * 
 * @returns {Object} user
 */
export const getUser = () => rw().user
/**
 * @name    setUser
 * @summary saves user credentails from local storage
 * 
 * @param   {Object}    user
 * 
 * @returns {Object} user
 */
export const setUser = (user = {}) => rw({ user })

const emitAsPromise = (event, args = [], resultModifier, onError) =>
    new Promise((resolve, reject) => {
        try {
            const interceptor = async (err, ...result) => {
                if (!!err) {
                    err = translateError(err)
                    if (isFn(onError)) onError(err)
                    return reject(err)
                }

                result = result.length > 1
                    ? result // if multiple values returned from the backend resolve with an array
                    : result[0] // otherwise resolve with single value
                if (isFn(resultModifier)) result = await resultModifier(result)
                resolve(result)
            }
            args = [...args, interceptor]
            socket.emit(event, ...args)
        } catch (err) {
            console.log(`Unexpected error occurd on chatClient.${event}()`, err)
            err = translateError(`${err}`.replace('Error: ', ''))
            isFn(onError) && onError(err)
            reject(err)
        }
    })

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

    // translate if there is any labeled error message
    const separator = ' => '
    if (!err.includes(separator)) return translated({ err })[0].err

    const [prefix, msg] = err.split(separator)
    const [texts] = translated({ prefix, msg })
    return `${texts.prefix}${separator}${texts.msg}`
}

// Make sure to always keep the callback as the last argument
class ChatClient {
    constructor(url) {
        this.url = url || defaultServerURL
        socket = ioClient(this.url, {
            transports: ['websocket'],
            secure: true,
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

        // Request funds : deprecated
        // this.faucetRequest = (address, cb) => isFn(cb) && socket.emit('faucet-request', address, cb)

        // /**
        //  * @name    crowdsaleCheckDeposits
        //  * @summary check and retrieve user's crowdsale deposits
        //  *
        //  * @param {Function}    cb  callback function arguments:
        //  *                          @err        string: if request failed
        //  *                          @result     object:
        //  *                              @result.deposits    object: deposit amounts for each allocated addresses
        //  *                              @result.lastChecked string: timestamp of last checked
        //  *
        //  */
        // this.crowdsaleCheckDeposits = (cached = true, cb) => isFn(cb) && socket.emit(
        //     'crowdsale-check-deposits',
        //     cached,
        //     cb,
        // )

        // /**
        //  * @name    crowdsaleConstants
        //  * @summary retrieve crowdsale related constants for use with calcuation of allocation and multiplier levels
        //  *
        //  * @param {Function}    cb  callback function arguments:
        //  *                          @err        string: if request failed
        //  *                          @result     object:
        //  *                              @result.Level_NEGOTIATE_Entry_USD   Number: amount in USD for negotiation
        //  *                              @result.LEVEL_MULTIPLIERS   Array: multipliers for each level
        //  *                              @result.LEVEL_ENTRY_USD     Array: minimum deposit amount in USD for each level
        //  */
        // this.crowdsaleConstants = cb => isFn(cb) && socket.emit(
        //     'crowdsale-constants',
        //     cb,
        // )
        // /**
        //  * @name    crowdsaleDAA
        //  * @summary request new or retrieve exisitng deposit address
        //  *
        //  * @param   {String}    blockchain  ticker of the Blockchain to request/retrieve address of
        //  * @param   {String}    ethAddress  use `0x0` to retrieve existing address.
        //  *                                  If the @blockchain is `ETH`, user's Ethereum address for whitelisting.
        //  *                                  Otherwise, leave an empty string.
        //  * @param   {Function}  cb          callback function arguments:
        //  *                                  @err     string: if request failed
        //  *                                  @address string: deposit address
        //  */
        // this.crowdsaleDAA = (blockchain, ethAddress, cb) => isFn(cb) && socket.emit(
        //     'crowdsale-daa',
        //     blockchain,
        //     ethAddress,
        //     cb,
        // )

        // /**
        //  * @name    crowdsaleKYC
        //  * @summary register for crowdsale or check if already registered
        //  *
        //  * @param   {Object|Boolean}    kycData use `true` to check if user already registered.
        //  *                                      Required object properties:
        //  *                                      @email      string
        //  *                                      @familyName string
        //  *                                      @givenName  string
        //  *                                      @identity   string
        //  *                                      @location   object
        //  * @param   {Function}          cb      arguments:
        //  *                                      @err        string
        //  *                                      @publicKey  string
        //  */
        // this.crowdsaleKYC = (kycData, cb) => isFn(cb) && socket.emit(
        //     'crowdsale-kyc',
        //     kycData,
        //     cb,
        // )

        // /**
        //  * @name    crowdsaleKYCPublicKey
        //  * @summary get Totem Live Association's encryption public key
        //  *
        //  * @param   {Function}          cb      arguments:
        //  *                                      @err        string
        //  *                                      @publicKey  string
        //  */
        // this.crowdsaleKYCPublicKey = cb => isFn(cb) && socket.emit(
        //     'crowdsale-kyc-publicKey',
        //     cb,
        // )

        // add support for legacy `.promise`
        Object
            .keys(this)
            .forEach(key => {
                const func = this[key]

                if (!isAsyncFn(func)) return
            })

        // converts callback based emits to promise. With 30 seconds timeout
        this._emitter = PromisE.getSocketEmitter(socket, 30000, 0, null)
        // add an interceptor to translate all error messages from the server to the selected language (if any)
        this.emitter = (event, args = [], resultModifier, onError, timeoutLocal) => {
            return this._emitter(
                event,
                args,
                resultModifier,
                err => {
                    const translatedErr = translateError(err)
                    isFn(onError) && onError(translatedErr, err)
                    return translatedErr
                },
                timeoutLocal,
            )
        }
    }

    /**
     * @name    company
     * @summary fetch or create a company
     * 
     * @param   {String} id                         ID (AKA hash) of the company entry
     * @param   {Object} company                    if falsy, will retrieve company by id 
     * @param   {String} company.countryCode        2 letter country code
     * @param   {String} company.identity           blockchain identity of the company
     * @param   {String} company.name               name of the company
     * @param   {String} company.registrationNumber company registration number for the above countryntry
     * 
     * @returns {Object} company
     */
    company = async (hash, company) => await this.emitter('company', [hash, company])

    /**
     * @name    companySearch
     * @summary search companies
     *
     * @param   {String}    query
     * @param   {Boolean}   searchParentIdentity if false will search for both identity and parentIdentity
     *  
     * @returns {Map}
     */
    companySearch = (query, searchParentIdentity) => this.emitter(
        'company-search',
        [query, searchParentIdentity],
        // convert 2D array back to Map
        result => new Map(result),
    )

    /**
     * @name    countries
     * @summary fetch/update a list of all countries
     * 
     * @param   {String}    hash    hash of the cached list (sorted) of countries. 
     *                              If supplied hash matches the server's latest list hash, result will be empty.
     * 
     * @returns {Map}
     */
    countries = hash => this.emitter(
        'countries',
        [hash],
        countries => new Map(countries),
    )

    /**
     * @name    currencyConvert
     * @summary convert an amount from one currency to another
     * 
     * @param   {String}    from    source currency ID
     * @param   {String}    to      target currency ID
     * @param   {Number}    amount  amount to convert
     * 
     * @returns {Number}
     */
    currencyConvert = async (from, to, amount) => await this.emitter(
        'currency-convert',
        [from, to, amount]
    )

    /**
     * @name    currencyList
     * @summary fetch/update a list of all countries
     * 
     * @param   {String} hash   hash of the local cached list of countries.
     *                          If server's version of the hash mathes this, 
     *                          it indicates local cache is uppdated and
     *                          an empty result will be returned.
     * @returns {Map}
     */
    currencyList = async (hash) => await this.emitter('currency-list', [hash])

    /**
     * @name    currencyPricesByDate
     * @summary fetch price of currencies on a specific date
     * 
     * @param   {String}    date
     * @param   {Array}     currencyIds 
     * 
     * @returns {Array}
     */
    currencyPricesByDate = async (date, currencyIds) => await this.emitter(
        'currency-prices-by-date',
        [date, currencyIds]
    )

    /**
     * @name    idExists
     * @summary Check if User ID Exists
     * 
     * @returns {Boolean}
     */
    idExists = async (userId) => await this.emitter('id-exists', [userId])

    /**
     * @name    isUserOnline
     * @summary Check if User is online
     * 
     * @returns {Boolean}
     */
    isUserOnline = async (userId) => await this.emitter('is-user-online', [userId])

    /**
     * @name    glAccounts
     * @summary fetch global ledger accounts by account number
     * 
     * @param   {Array} accountNumbers
     * 
     * @returns {*}
     */
    glAccounts = async (accountNumbers) => await this.emitter('gl-accounts', [accountNumbers])

    /**
     * @name    languageErrorMessages
     * @summary Retrieve a list of error messages used in the messaging service. FOR BUILD MODE ONLY.
     * @returns 
     */
    languageErrorMessages = async () => await this.emitter('language-error-messages', [])

    /**
     * @name    languageTranslations
     * @summary retrieve a list of translated application texts for a specific language
     * 
     * @param   {String} langCode   2 digit language code
     * @param   {String} hash       (optional) hash cached translated texts' array.
     *                              If matches with servers hash, will return empty result.
     * 
     * @returns {Array}
     */
    languageTranslations = async (langCode, hash) => await this.emitter(
        'language-translations',
        [langCode, hash],
    )

    /**
     * @name    login
     * @summary user login
     * 
     * @param   {String} id 
     * @param   {String} secret
     *  
     * @returns {Object} data. Eg: roles etc.
     */
    login = (id, secret) => this.emitter(
        'login',
        [id, secret],
        async (data) => {
            // store user roles etc data sent from server
            setUser({ ...getUser(), ...data })
            // wait until maintenance mode is turned off
            rxIsInMaintenanceMode.value && await subjectAsPromise(rxIsInMaintenanceMode, false)
            rxIsLoggedIn.next(true)
        },
        err => console.log('Login failed', err)
    )

    /**
     * @name    maintenanceMode
     * @summary check/enable/disable maintenance mode. Only admin users will be able change mode.
     * 
     * @param   {Boolean}     active
     * @param   {Function}    cb 
     */
    maintenanceMode = async (active) => await this.emitter(eventMaintenanceMode, [active])

    /**
     * @name    onMaintenanceMode
     * @summary listen for server maintenance status changes
     * 
     * @param   {Function} cb args: @active Boolean
     */
    onMaintenanceMode = cb => isFn(cb) && socket.on(eventMaintenanceMode, cb)

    /**
     * @name   message
     * @summary Send chat messages
     *
     * @param  {Array}     userIds    User IDs without '@' sign
     * @param  {String}    message    encrypted or plain text message
     * @param  {Bool}      encrypted  determines whether `message` requires decryption. 
     *                                (Encryption to be implemented)
     * 
     * @returns {*}
     */
    message = async (receiverIds, msg, encrypted) => await this.emitter(
        'message',
        [receiverIds, msg, encrypted],
    )

    /**
     * @name    onMessage
     * @summary listen for new chat messages
     * 
     * @param   {Function} cb callback arguments => 
     *                          senderId    {String}  : curent user's ID
     *                          receiverIds {Array}   : User IDs without '@' sign
     *                          message     {String}  : encrypted or plain text message
     *                          encrypted   {Bool}    : determines whether @message requires decryption
     */
    onMessage = cb => isFn(cb) && socket.on('message', cb)

    /**
     * @name    messageGetRecent
     * @summary fetch recent chat messages
     * 
     * @param   {String}    lastMsgTs   most recent previous message's timestamp
     * 
     * @returns {Array} messages
     */
    messageGetRecent = async (lastMsgTs) => await this.emitter(
        'message-get-recent',
        [lastMsgTs],
    )

    /**
     * @name    messageGroupName
     * @summary set name of a group chat
     * 
     * @param   {Array}     receiverIds list of all user IDs belonging to the group
     * @param   {String}    name        new group name
     * 
     * @returns {*}
     */
    messageGroupName = async (receiverIds, name) => await this.emitter(
        'message-group-name',
        [receiverIds, name],
    )

    /**
     * @name    newsletterSignup
     * @summary sign up to newsletter and updates
     * 
     * @param   {Object}    values required fields: name and email
     * @param   {Function}  cb
     */
    newsletterSignup = async (values) => await this.emitter('newsletter-signup', [values])

    /**
     * @name    notify
     * @summary Send notification
     * 
     * @param   {Array}   toUserIds   receiver User ID(s)
     * @param   {String}  type        parent notification type. Eg: timeKeeping
     * @param   {String}  childType   child notification type. Eg: invitation
     * @param   {String}  message     message to be displayed
     * @param   {Object}  data        information specific to the type of notification
     * 
     * @returns {*}
     */
    notify = async (toUserIds, type, childType, message, data) => await this.emitter(
        'notification',
        [
            toUserIds,
            type,
            childType,
            message,
            data,
        ],
    )
    /**
     * @name    onNotify
     * @summary listen for new notification
     * 
     * @param   {Function} cb   callback arguments:
     *                          - id         string     : notification ID
     *                          - senderId   string     : sender user ID
     *                          - type       string     : parent notification type
     *                          - childType  string     : child notification type
     *                          - message    string     : notification message
     *                          - data       object     : extra info specific to `type` and `childType`
     *                          - tsCreated  date       : notification creation timestamp
     *                          - cbConfirm  function   : a function to confirm receipt
     */
    onNotify = cb => isFn(cb) && socket.on('notification', cb)

    /**
     * @name    notificationGetRecent
     * @summary retrieve a list of recent notification
     * 
     * @param   {String}    tsLast  (optional) timestamp of the most recent previously received notification
     * 
     * @returns {Map}
     */
    notificationGetRecent = async (ts) => await this.emitter(
        'notification-get-recent',
        [ts],
        result => new Map(result),
    )

    /**
     * @name    notificationSetStatus
     * @summary Mark notification as read or deleted
     * 
     * @param   {String}    id      Notification ID
     * @param   {Boolean}   read    marks as read or unread. Optional if `deleted = true`
     * @param   {Boolean}   deleted (optional) marks as deleted or undeleted
     */
    notificationSetStatus = async (id, read, deleted) => await this.emitter(
        'notification-set-status',
        [id, read, deleted],
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
    project = async (projectId, project, create) => await this.emitter(
        'project',
        [projectId, project, create],
    )

    /**
     * @name    projectsByHashes
     * @summary retrieve projects by an IDs (AKA hashes)
     * 
     * @param   {Array} projectIds
     * 
     * @returns {Array} [projects, notFoundIds]
     */
    projectsByHashes = async (projectIds) => await this.emitter(
        'projects-by-hashes',
        [projectIds],
        ([projects, notFoundIds]) => [new Map(projects), notFoundIds],
    )

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
    register = (id, secret, address, referredBy) => this.emitter(
        'register',
        [
            id,
            secret,
            address,
            referredBy,
        ],
        () => {
            setUser({ id, secret })
            rxIsLoggedIn.next(true)
            rxIsRegistered.next(true)
        },
    )

    /**
     * @name    rewardsClaim
     * @summary retrieves a verificaiton
     * 
     * @param   {String}    platform    social media platform name. Eg: twitter
     * @param   {String}    handle      user's social media handle/username
     * @param   {String}    postId      social media post ID
     * @param   {Function}  cb          Callback function expected arguments:
     *                                  @err    String: error message if query failed
     *                                  @code   String: hex string
     */
    rewardsClaim = async (platform, handle, postId) => await this.emitter(
        'rewards-claim',
        [platform, handle, postId],
    )

    /**
     * @name    rewardsGetData
     * @summary retrieves all received rewards by the user
     * 
     * @returns {Object}    rewards data
     */
    rewardsGetData = async () => await this.emitter('rewards-get-data')

    /**
     * @name task
     * @summary add/update task details to messaging service
     * 
     * @param {String}      id              ID of the task
     * @param {Object}      task            
     * @param {String}      ownerAddress    identity that created the task
     */
    task = async (id, task, ownerAddress) => await this.emitter(
        'task',
        [id, task, ownerAddress],
    )

    /**
     * @name    taskGetById
     * @summary retrieve a list of tasks details' (off-chain data) by Task IDs
     * 
     * @param   {String|Array}  ids single or array of Task IDs
     * @param   {Function}      cb Callback function expected arguments:
     *                      @err    String: error message if query failed
     *                      @result Map: list of tasks with details
     * 
     * @returns {Map} list of task details'
     */
    taskGetById = async (ids) => await this.emitter(
        'task-get-by-id',
        [ids],
        result => new Map(result),
    )
}
// export default {} //getClient()