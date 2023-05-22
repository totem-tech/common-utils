import ioClient from 'socket.io-client'
import { BehaviorSubject } from 'rxjs'
import { translated } from './languageHelper'
import PromisE from './PromisE'
import { subjectAsPromise } from './reactHelper'
import storage from './storageHelper'
import {
    deferred,
    isAsyncFn,
    isBool,
    isFn,
    isNodeJS,
    isObj,
    isStr,
    objWithoutKeys,
} from './utils'

let instance, socket
const DISCONNECT_DELAY_MS = parseInt(process.env.MESSAGING_SERVER_DISCONNECT_DELAY_MS || 300000)
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
// remove legacy trollbox chat history items
if (rw().history) rw({ history: null })
//- migrate end

const log = (...args) => console.log(new Date().toLocaleTimeString(), 'Totem Messaging Service:', ...args)

// retrieves user credentails from local storage
/** @name    setUser
 * @summary retrieves user credentails from local storage
 * 
 * @returns {Object} user
 */
export function getUser() { return rw().user }
/**
 * @name    setUser
 * @summary saves user credentails from local storage
 * 
 * @param   {Object}    user
 * 
 * @returns {Object} user
 */
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
 * @description when in dev mode with self-signed certificate, if socket connection fails with "ERR_CERT_AUTHORITY_INVALID", simply open the socket url in the browser by replacing "wss" with "https" and click "proceed" to add the certificate.
 * 
 * @param   {String|Boolean} url    if Boolean, true => use staging & falsy => use prod
 * @param   {Number}         disconnectDelayMs (optional) duration in milliseconds to auto-disconnect from 
 *                                             webwsocket after period of inactivity.
 *              
 *                                             Default: `300000` (or `process.env.MESSAGING_SERVER_DISCONNECT_DELAY_MS`)
 *
 * @returns {ChatClient}
 */
export const getClient = (url, disconnectDelayMs) => {
    if (instance) return instance

    instance = new ChatClient(url, disconnectDelayMs)

    instance.onConnect(async () => {
        rxIsConnected.next(true)
        const active = await instance.maintenanceMode.promise(null, null)
        rxIsInMaintenanceMode.next(active)
        if (!rxIsRegistered.value) return

        // auto login on connect to messaging service
        const { id, secret } = getUser() || {}
        instance
            .login(id, secret)
            .then(() => console.log(new Date().toISOString(), 'Logged into messaging service'))
            .catch(console.error)
    })
    instance.onConnectError(error => {
        log('connectError', error)
        rxIsConnected.next(false)
        rxIsLoggedIn.next(false)
    })
    instance.socket.on('disconnect', () => {
        log('disconnected')
        rxIsConnected.next(false)
        rxIsLoggedIn.next(false)
    })
    instance.onMaintenanceMode(active => {
        console.log('Maintenance mode', active ? 'active' : 'inactive')
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

export class ChatClient {
    constructor(url, disconnectDelayMs = DISCONNECT_DELAY_MS) {
        if (!isStr(url)) {
            const hostProd = 'totem.live'
            const hostStaging = 'dev.totem.live'
            const isNode = isNodeJS()
            const staging = isBool(url)
                ? url
                : !isNode && window.location.hostname === hostStaging
            const hostname = !isNode
                ? window.location.hostname // if frontend the use the URL
                : staging
                    ? hostStaging
                    : hostProd
            const port = staging
                ? 3003
                : 3001
            url = `wss://${hostname}:${port}`
        }
        this.url = url
        socket = ioClient(this.url, {
            transports: ['websocket'],
            secure: true,
            rejectUnauthorized: false,
        })
        this.socket = socket
        // add support for legacy `.promise`
        Object
            .keys(this)
            .forEach(key => {
                const func = this[key]
                if (key.startsWith('on') || !isFn(func)) return

                func.promise = async (...args) => await func(...args)
            })

        this.connect = () => this.socket.connect()
        this.disconnect = () => this.socket.disconnect()
        this.disconnectDeferred = deferred(() => {
            log('Disconnecting due to inactivity')
            this.disconnect()
            rxIsLoggedIn.next(false)
        }, disconnectDelayMs)
        this.isConnected = () => this.socket.connected
        this.onConnect = cb => this.socket.on('connect', cb)
        // this.onConnectTimeout = cb => this.socket.on('connect_timeout', cb);
        this.onConnectError = cb => this.socket.on('connect_error', cb);
        this.onError = cb => this.socket.on('error', cb)
        this.onReconnect = cb => this.socket.on('reconnect', cb)
        this.rxIsConnected = rxIsConnected
        this.rxIsInMaintenanceMode = rxIsInMaintenanceMode
        this.rxIsLoggedIn = rxIsLoggedIn
        this.rxIsRegistered = rxIsRegistered


        // converts callback based emission to promise. With 30 seconds timeout.
        const _emitter = PromisE.getSocketEmitter(socket, 30000, 0, null)
        /**
         * @name    emit
         * 
         * @param   {String}    event           name of the Websocket message event
         * @param   {Array}     args            (optional) arguments/data to supplied during event emission
         * @param   {Function}  resultModifier  (optional) modify result before being resolved
         * @param   {Function}  onError         (optional)
         * @param   {Number}    timeoutLocal    (optional) timeout in milliseconds
         * 
         * @returns {Promise}
         */
        this.emit = (event, args = [], resultModifier, onError, timeoutLocal) => {
            let delayPromise
            // functions allowed during maintenace mode
            const maintenanceModeKeys = [
                eventMaintenanceMode,
                'login',
                'rewards-get-kapex-payouts',
            ]
            if (!this.isConnected()) {
                this.connect()
                // if user is registered, on reconnect wait until login before making a new request
                delayPromise = rxIsRegistered.value
                    && maintenanceModeKeys.includes(event)
                    && subjectAsPromise(rxIsLoggedIn, true, timeoutLocal)[0]
            }
            const doWait = rxIsInMaintenanceMode.value && !maintenanceModeKeys.includes(event)
            if (doWait) {
                console.info('Waiting for maintenance mode to be deactivated...')
                const maintenanceModePromise = subjectAsPromise(rxIsInMaintenanceMode, false)[0]
                delayPromise = maintenanceModePromise.then(() => maintenanceModePromise)
            }
            const promise = _emitter(
                event,
                args,
                resultModifier,
                err => {
                    const translatedErr = translateError(err)
                    isFn(onError) && onError(translatedErr, err)
                    return translatedErr
                },
                timeoutLocal,
                delayPromise, // makes sure user is logged in
            )
            // auto disconnect after pre-configured period of inactivity
            promise.promise.finally(() => this.disconnectDeferred())
            return promise
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
    company = async (hash, company) => await this.emit('company', [hash, company])

    /**
     * @name    companySearch
     * @summary search companies
     *
     * @param   {String}    query
     * @param   {Boolean}   searchParentIdentity if false will search for both identity and parentIdentity
     *  
     * @returns {Map}
     */
    companySearch = async (query, searchParentIdentity) => await this.emit(
        'company-search',
        [query, searchParentIdentity],
        // convert 2D array back to Map
        ([result, limit]) => new Map(result),
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
    countries = async (hash) => await this.emit(
        'countries',
        [hash],
        countries => new Map(countries),
    )

    /**
     * @name    crowdloan
     * @summary fetch or update user contribution
     * 
     * @param   {String|Object} contribution identity or contribution data
     * @param   {Nubmer}        contribution.amountContributed
     * @param   {Nubmer}        contribution.amountPledged
     * @param   {String}        contribution.identity
     * @param   {String}        contribution.signature
     * 
     * @returns {Object}    contribution entry
     */
    crowdloan = async (contribution) => await this.emit(
        'crowdloan',
        [contribution],
    )

    /**
     * @name    onCrowdloanPledgeTotal
     * @summary listen for changes on total pledged amount
     * 
     * @param   {Function} cb   Args: plegedTotal (number)
     */
    onCrowdloanPledgeTotal = cb => isFn(cb) && this.socket.on('crowdloan-pledged-total', cb)

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
    currencyConvert = async (from, to, amount) => await this.emit(
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
    currencyList = async (hash) => await this.emit('currency-list', [hash])

    /**
     * @name    currencyPricesByDate
     * @summary fetch price of currencies on a specific date
     * 
     * @param   {String}    date
     * @param   {Array}     currencyIds 
     * 
     * @returns {Array}
     */
    currencyPricesByDate = async (date, currencyIds) => await this.emit(
        'currency-prices-by-date',
        [date, currencyIds]
    )

    /**
     * @name    idExists
     * @summary Check if User ID Exists
     * 
     * @returns {Boolean}
     */
    idExists = async (userId) => await this.emit('id-exists', [userId])

    /**
     * @name    isUserOnline
     * @summary Check if User is online
     * 
     * @returns {Boolean}
     */
    isUserOnline = async (userId) => await this.emit('is-user-online', [userId])

    /**
     * @name    glAccounts
     * @summary fetch global ledger accounts by account number
     * 
     * @param   {Array} accountNumbers
     * 
     * @returns {*}
     */
    glAccounts = async (accountNumbers) => await this.emit('gl-accounts', [accountNumbers])

    /**
     * @name    languageErrorMessages
     * @summary Retrieve a list of error messages used in the messaging service. 
     * FOR BUILD MODE ONLY.
     * 
     * @returns {Array}
     */
    languageErrorMessages = async () => await this.emit('language-error-messages', [])

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
    languageTranslations = async (langCode, hash) => await this.emit(
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
    login = async (id, secret) => await this.emit(
        'login',
        [id, secret],
        async (data) => {
            const { address } = data || {}
            rxUserIdentity.next(address)
            // store user roles etc data sent from server
            setUser({ ...getUser(), ...data })
            rxIsLoggedIn.next(true)
            return data
        },
        err => {
            rxIsLoggedIn.next(false)
            console.log('Login failed', err)
        }
    )

    /**
     * @name    maintenanceMode
     * @summary check/enable/disable maintenance mode. Only admin users will be able change mode.
     * 
     * @param   {Boolean}     active
     * @param   {Function}    cb 
     */
    maintenanceMode = async (active) => await this.emit(eventMaintenanceMode, [active])

    /**
     * @name    onMaintenanceMode
     * @summary listen for server maintenance status changes
     * 
     * @param   {Function} cb args: @active Boolean
     */
    onMaintenanceMode = cb => isFn(cb) && this.socket.on(eventMaintenanceMode, cb)

    /**
     * @name   message
     * @summary send a chat message to one or more users.
     *
     * @param  {Array}     toUserIds    Recipient user IDs (without '@' sign)
     * @param  {String}    message      encrypted or plain text message
     * @param  {Bool}      encrypted    determines whether `message` requires decryption. 
     *                                  (Encryption to be implemented)
     * 
     * @returns {*}
     */
    message = async (toUserIds, msg, encrypted) => await this.emit(
        'message',
        [toUserIds, msg, encrypted],
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
    onMessage = cb => isFn(cb) && this.socket.on('message', cb)

    /**
     * @name    messageGetRecent
     * @summary fetch recent chat messages
     * 
     * @param   {String}    lastMsgTs   most recent previous message's timestamp
     * 
     * @returns {Array} messages
     */
    messageGetRecent = async (lastMsgTs) => await this.emit(
        'message-get-recent',
        [lastMsgTs],
    )

    /**
     * @name    messageGroupName
     * @summary set name of a group chat
     * 
     * @param   {Array}     userIds list of all user IDs belonging to the group
     * @param   {String}    name    new group name
     * 
     * @returns {*}
     */
    messageGroupName = async (userIds, name) => await this.emit(
        'message-group-name',
        [userIds, name],
    )

    /**
     * @name    newsletterSignup
     * @summary sign up to newsletter and updates
     * 
     * @param   {Object}    values
     * @param   {String}    values.email
     * @param   {String}    values.name     subscriber's full name
     * 
     * @returns {*}
     */
    newsletterSignup = async (values) => await this.emit('newsletter-signup', [values])

    /**
     * @name    notify
     * @summary Send notification
     * 
     * @param   {Array}   toUserIds   recipient user ID(s)
     * @param   {String}  type        parent notification type. Eg: timeKeeping
     * @param   {String}  childType   child notification type. Eg: invitation
     * @param   {String}  message     message to be displayed
     * @param   {Object}  data        information specific to the type of notification
     * 
     * @returns {*}
     */
    notify = async (toUserIds, type, childType, message, data) => await this.emit(
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
    onNotify = cb => isFn(cb) && this.socket.on('notification', cb)

    /**
     * @name    notificationGetRecent
     * @summary retrieve a list of recent notification
     * 
     * @param   {String}    tsLast  (optional) timestamp of the most recent previously received notification
     * 
     * @returns {Map}
     */
    notificationGetRecent = async (tsLast) => await this.emit(
        'notification-get-recent',
        [tsLast],
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
    notificationSetStatus = async (id, read, deleted) => await this.emit(
        'notification-set-status',
        [id, read, deleted],
    )

    /**
     * @name    project
     * @summary add/get/update project (Activity)
     * 
     * @param {String}   projectId   Project ID
     * @param {Object}   project
     * @param {Boolean}  create      whether to create or update project
     */
    project = async (projectId, project, create) => await this.emit(
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
    projectsByHashes = async (projectIds) => await this.emit(
        'projects-by-hashes',
        [projectIds],
        ([projects, notFoundIds = []]) => [new Map(projects), notFoundIds],
    )

    /**
     * @name    register
     * @summary register new user
     * 
     * @param   {String}    id          new user ID
     * @param   {String}    secret
     * @param   {String}    address     Blockchain identity
     * @param   {String}    referredBy  (optional) referrer user ID
     */
    register = async (id, secret, address, referredBy) => await this.emit(
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
            rxUserIdentity.next(address)
        },
    )

    /**
     * @name    rewardsClaim
     * @summary retrieves a verificaiton
     * 
     * @param   {String}    platform    social media platform name. Eg: twitter
     * @param   {String}    handle      user's social media handle/username
     * @param   {String}    postId      social media post ID
     * 
     * @returns {String}
     */
    rewardsClaim = async (platform, handle, postId) => await this.emit(
        'rewards-claim',
        [platform, handle, postId],
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
    rewardsClaimKAPEX = async (identity) => await this.emit('rewards-claim-kapex', [identity])

    /**
     * @name    rewardsGetData
     * @summary retrieves all received rewards by the user
     * 
     * @returns {Object}    rewards data
     */
    rewardsGetData = async () => await this.emit('rewards-get-data')

    /**
     * @name    task
     * @summary saves off-chain task details to the database.
     * Requires pre-authentication using BONSAI with the blockchain identity that owns the task.
     * Login is required simply for the purpose of logging the User ID who saved the data.
     * @description 'task-market-created' event will be broadcasted whenever a new marketplace task is created.
     * 
     * @param {String}   taskId          task ID
     * @param {Object}   task
     * @param {String}   ownerAddress    task owner identity
     */
    task = async (id, task, ownerAddress) => await this.emit(
        'task',
        [id, task, ownerAddress],
    )

    /**
     * @name    taskGetById
     * @summary retrieve a list of tasks details' (off-chain data) by Task IDs
     * 
     * @param   {String|Array}  ids single or array of Task IDs
     * 
     * @returns {Map} list of objects with task details
     */
    taskGetById = async (ids) => await this.emit(
        'task-get-by-id',
        [ids],
        result => new Map(result),
    )

    /**
     * @name    taskGetByParentId
     * @summary search for tasks by parent ID
     *
     * @param   {String}    parentId
     * 
     * @returns {Map}   list of tasks with details
     */
    taskGetByParentId = async (parentId) => await this.emit(
        'task-get-by-parent-id',
        [parentId],
        result => new Map(result)
    )

    /**
     * @name    taskMarketApply
     * @summary apply for an open marketplace task
     *
     * @param   {Object}    application
     * @param   {Array}     application.links    (optional) only used if published task requires proposal
     * @param   {String}    application.proposal (optional) required only if published task requires proposal
     * @param   {String}    application.taskId
     * @param   {String}    application.workerAddress
     */
    taskMarketApply = async (application) => await this.emit(
        'task-market-apply',
        [application],
        result => new Map(result),
    )

    /**
     * @name    onTaskMarketCreated
     * @summary subscribe to new marketplace task creation event
     *
     * @param   {Function} cb   args: @taskId string
     */
    onTaskMarketCreated = cb => isFn(cb) && this.socket.on('task-market-created', cb)

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
    taskMarketApplyResponse = async (data) => await this.emit(
        'task-market-apply-response',
        [data],
    )

    /**
     * @name    taskMarketSearch
     * @summary search marketplace orders
     * 
     * @param   {Object}    filter          (optional)  if not supplied will return latest 100 entries
     * @param   {String}    filter.keywords (optional)
     * @param   {Number}    filter.pageNo   (optional)
     * 
     * @returns {Map}
     */
    taskMarketSearch = async (filter) => await this.emit(
        'task-market-search',
        [filter],
        result => new Map(result)
    )
}
export default getClient()