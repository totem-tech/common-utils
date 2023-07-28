import ioClient from 'socket.io-client'
import { BehaviorSubject } from 'rxjs'
import { translated } from './languageHelper'
import PromisE from './PromisE'
import { subjectAsPromise } from './rx'
import storage from './storageHelper'
import {
    arrUnique,
    deferred,
    isArr,
    isArr2D,
    isAsyncFn,
    isBool,
    isFn,
    isNodeJS,
    isObj,
    isPositiveInteger,
    isStr,
    objWithoutKeys,
    textCapitalize,
} from './utils'
import { TYPES, validateObj } from './validator'

let instance, socket
const AUTO_DISCONNECT_MS = parseInt(process.env.REACT_APP_CHAT_AUTO_DISCONNECT_MS || 300000)
const MODULE_KEY = 'messaging'
const PREFIX = 'totem_'
export const ROLE_ADMIN = 'admin'
export const ROLE_SUPPORT = 'support'
// include any ChatClient property that is not a function or event that does not have a callback
const nonCbs = ['isConnected', 'disconnect']
// read or write to messaging settings storage
const rw = value => storage.settings.module(MODULE_KEY, value) || {}
export const rxFaucetEnabled = new BehaviorSubject(false)
export const rxIsAdmin = new BehaviorSubject(false)
export const rxIsSupport = new BehaviorSubject(false)
export const rxIsConnected = new BehaviorSubject(false)
export const rxIsLoggedIn = new BehaviorSubject(null)
export const rxIsRegistered = new BehaviorSubject(!!(rw().user || {}).id)
export const rxIsInMaintenanceMode = new BehaviorSubject(false)
export const rxUserId = new BehaviorSubject((getUser() || {}).id)
export const rxUserIdentity = new BehaviorSubject((getUser() || {}).address)
const eventMaintenanceMode = 'maintenance-mode'
const eventEventsMeta = 'events-meta'
// events allowed during maintenance mode.
const maintenanceModeEvents = [
    eventMaintenanceMode,
    eventEventsMeta,
    'login', // without login admin user won't be able to login and therefore, can't turn off maintenance mode.
    'rewards-get-kapex-payouts', // allow crowdloan rewards data request even when in maintenance mode
]
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


export class ChatClient {
    constructor(url, autoDisconnectMs = AUTO_DISCONNECT_MS) {
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
        this.disconnect = () => {
            log('Manual disconnect')
            this.socket.disconnect()
        }
        this.disconnectDeferred = deferred(() => {
            if (!isPositiveInteger(autoDisconnectMs)) return
            log('Disconnecting due to inactivity')
            this.socket.disconnect()
        }, autoDisconnectMs)
        this.isConnected = () => this.socket.connected
        this.onConnect = cb => this.on('connect', cb)
        // this.onConnectTimeout = (cb, once) => this.on('connect_timeout', cb, once);
        this.onConnectError = (cb, once) => this.on('connect_error', cb, once);
        this.onError = (cb, once) => this.on('error', cb, once)
        this.onReconnect = (cb, once) => this.on('reconnect', cb, once)
        this.rxIsConnected = rxIsConnected
        this.rxIsInMaintenanceMode = rxIsInMaintenanceMode
        this.rxIsLoggedIn = rxIsLoggedIn
        this.rxIsRegistered = rxIsRegistered

        // converts callback based emission to promise. With 30 seconds timeout.
        this._emitter = PromisE.getSocketEmitter(socket, 30000, 0, null)

        /**
         * @name    emit
         * 
         * @param   {String}    eventName       name of the Websocket message event
         * @param   {Array}     args            (optional) arguments/data to supplied during event emission
         * @param   {Function}  resultModifier  (optional) modify result before being resolved
         * @param   {Function}  onError         (optional)
         * @param   {Number}    timeout    (optional) timeout in milliseconds
         * 
         * @returns {Promise}
         */
        this.emit = async (eventName, args = [], resultModifier, onError, timeout) => {
            let callback = isFn(args.slice(-1)[0])
                ? args.splice(-1)[0]
                : undefined
            const eventMeta = await this.eventsMeta(eventName) || {}
            let {
                customMessages,
                params,
                resultType,
            } = eventMeta

            const len = params?.length
            if (len > 0) {
                params = params[len - 1]?.type === TYPES.function
                    ? params.slice(0, -1)
                    : params
                // make sure correct number of arguments are supplied
                args = params.map((param, i) =>
                    args[i] !== undefined
                        ? args[i]
                        : param.defaultValue
                )

                const err = !!len && validateObj(
                    args,
                    params,
                    true,
                    true,
                    customMessages
                )
                err && console.log('Validation error ', { eventName, err })
                if (err) throw new Error(err)
            }

            const promise = this._emitter(
                eventName,
                args,
                async result => {
                    if (resultType === 'Map') result = new Map(result || [])
                    isFn(callback) && callback(null, result)
                    return isFn(resultModifier)
                        ? await resultModifier(result)
                        : result
                },
                err => {
                    const translatedErr = translateError(err)
                    isFn(onError) && onError(translatedErr, err)
                    isFn(callback) && callback(err)
                    return translatedErr
                },
                timeout,
                this.awaitReady(eventName, timeout),
            )
            // auto disconnect after pre-configured period of inactivity
            if (autoDisconnectMs) {
                const wsPromise = promise.promise || promise // if no timeout
                wsPromise
                    .catch(() => { })
                    .finally(() => this.disconnectDeferred())
            }
            return await promise
        }
    }

    awaitReady = async (eventName, timeout, log = false) => {
        let doWait = !rxIsConnected.value
        // wait until chatClient is connected
        doWait && await subjectAsPromise(
            rxIsConnected,
            true,
            timeout
        )[0]
        const eventMeta = eventName !== eventEventsMeta
            ? { maintenanceMode: true }
            : await this.eventsMeta(eventName) || {}

        const { maintenanceMode, requireLogin } = eventMeta
        doWait = requireLogin && !rxIsLoggedIn.value
        // wait until user is logged in
        doWait && await subjectAsPromise(
            rxIsLoggedIn,
            true,
            timeout
        )[0]

        doWait = rxIsInMaintenanceMode.value && !maintenanceMode
        // wait until maintenance mode is deactivated
        if (doWait) {
            log && console.info('Waiting for maintenance mode to be deactivated...')
            await subjectAsPromise(
                rxIsInMaintenanceMode,
                false,
                timeout
            )[0]
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
    company = async (hash, company, ...args) => await this.emit(
        'company',
        [
            hash,
            company,
            ...args
        ])

    /**
     * @name    companySearch
     * @summary search companies
     *
     * @param   {String}    query
     * @param   {Boolean}   searchParentIdentity if false will search for both identity and parentIdentity
     *  
     * @returns {Map}
     */
    companySearch = async (query, searchParentIdentity, ...args) => await this.emit(
        'company-search',
        [
            query,
            searchParentIdentity,
            ...args
        ],
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
    countries = async (hash, ...args) => await this.emit(
        'countries',
        [hash, ...args],
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
    crowdloan = async (contribution, ...args) => await this.emit(
        'crowdloan',
        [contribution, ...args],
    )

    /**
     * @name    onCrowdloanPledgeTotal
     * @summary listen for changes on total pledged amount
     * 
     * @param   {Function} cb   Args: plegedTotal (number)
     */
    onCrowdloanPledgeTotal = (cb, once) => this.on(
        'crowdloan-pledged-total',
        cb,
        once
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
    currencyConvert = async (from, to, amount, ...args) => await this.emit(
        'currency-convert',
        [
            from,
            to,
            amount,
            ...args
        ]
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
    currencyList = async (hash, ...args) => await this.emit(
        'currency-list',
        [hash, ...args]
    )

    /**
     * @name    currencyPricesByDate
     * @summary fetch price of currencies on a specific date
     * 
     * @param   {String}    date
     * @param   {Array}     currencyIds 
     * 
     * @returns {Array}
     */
    currencyPricesByDate = async (date, currencyIds, ...args) => await this.emit(
        'currency-prices-by-date',
        [
            date,
            currencyIds,
            ...args
        ]
    )

    /**
     * @name    eventsMeta
     * @summary fetch and cache messaging service events meta data
     */
    eventsMeta = async (eventName) => {
        if (!this.eventsMetaCache || this.eventsMetaCache?.rejected) {
            console.log('Updating events meta cache')
            // cache result for future use
            this.eventsMetaCache = this._emitter(eventEventsMeta)
        }
        const meta = await this.eventsMetaCache
        return eventName
            ? meta[eventName]
            : meta
    }

    faucetRequest = async (address, ...args) => await this.emit(
        'faucet-request',
        [address, ...args]
    )

    faucetStatus = async (enabled, ...args) => await this.emit(
        'faucet-status',
        [enabled, ...args]
    )

    /**
     * @name    onFaucetStatus
     * @summary listen to faucet status changes
     * 
     * @param   {Function}  cb  args: [active boolean]
     * @param   {Boolean}   once
     * 
     * @returns {Function}  unsubscribe
     */
    onFaucetStatus = (cb, once) => this.on(
        'faucet-status',
        cb,
        once
    )

    /**
     * @name    idExists
     * @summary Check if User ID Exists
     * 
     * @returns {Boolean}
     */
    idExists = async (userId, ...args) => await this.emit(
        'id-exists',
        [userId, ...args]
    )

    /**
     * @name    isUserOnline
     * @summary Check if User is online
     * 
     * @returns {Boolean}
     */
    isUserOnline = async (userId, ...args) => await this.emit(
        'is-user-online',
        [userId, ...args]
    )

    /**
     * @name    glAccounts
     * @summary fetch global ledger accounts by account number
     * 
     * @param   {Array} accountNumbers
     * 
     * @returns {*}
     */
    glAccounts = async (accountNumbers, ...args) => await this.emit(
        'gl-accounts',
        [accountNumbers, ...args]
    )

    /**
     * @name    languageErrorMessages
     * @summary Retrieve a list of error messages used in the messaging service. 
     * FOR BUILD MODE ONLY.
     * 
     * @returns {Array}
     */
    languageErrorMessages = async (...args) => await this.emit(
        'language-error-messages',
        [...args]
    )

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
    languageTranslations = async (langCode, hash, ...args) => await this.emit(
        'language-translations',
        [
            langCode,
            hash,
            ...args
        ],
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
    login = async (id, secret, ...args) => await this.emit(
        'login',
        [
            id,
            secret,
            ...args
        ],
        async (data) => {
            const { address, roles = [] } = data || {}
            rxUserIdentity.next(address)
            // store user roles etc data sent from server
            setUser({ ...getUser(), ...data })
            rxIsLoggedIn.next(true)
            rxIsAdmin.next(roles.includes(ROLE_ADMIN))
            rxIsSupport.next(roles.includes(ROLE_SUPPORT))
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
    maintenanceMode = async (active, ...args) => await this.emit(
        eventMaintenanceMode,
        [active, ...args]
    )

    /**
     * @name    onMaintenanceMode
     * @summary listen for server maintenance status changes
     * 
     * @param   {Function} cb args: [active Boolean]
     */
    onMaintenanceMode = (cb, once) => this.on(
        eventMaintenanceMode,
        cb,
        once
    )

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
    message = async (toUserIds, msg, encrypted, ...args) => await this.emit(
        'message',
        [
            toUserIds,
            msg,
            encrypted,
            ...args
        ],
    )

    /**
     * @name    on
     * @summary listen to websocket events
     * 
     * @param   {String}    eventName 
     * @param   {Function}  cb 
     * @param   {Boolean}   once 
     * 
     * @returns {Function}  unsubscribe
     */
    on = (eventName, cb, once = false) => {
        if (!isFn(cb)) return () => { }

        const fn = once
            ? this.socket.once
            : this.socket.on
        fn.call(this.socket, eventName, cb)

        return () => this.socket.off(eventName, cb)
    }

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
    onMessage = (cb, once) => this.on(
        'message',
        cb,
        once
    )

    /**
     * @name    messageGetRecent
     * @summary fetch recent chat messages
     * 
     * @param   {String}    lastMsgTs   most recent previous message's timestamp
     * 
     * @returns {Array} messages
     */
    messageGetRecent = async (lastMsgTs, ...args) => await this.emit(
        'message-get-recent',
        [lastMsgTs, ...args],
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
    messageGroupName = async (userIds, name, ...args) => await this.emit(
        'message-group-name',
        [userIds, name, ...args],
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
    newsletterSignup = async (values, ...args) => await this.emit('newsletter-signup', [values, ...args])

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
    notify = async (toUserIds, type, childType, message, data, ...args) => await this.emit(
        'notification',
        [
            toUserIds,
            type,
            childType,
            message,
            data,
            ...args
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
    onNotify = (cb, once) => this.on(
        'notification',
        cb,
        once
    )

    /**
     * @name    notificationGetRecent
     * @summary retrieve a list of recent notification
     * 
     * @param   {String}    tsLast  (optional) timestamp of the most recent previously received notification
     * 
     * @returns {Map}
     */
    notificationGetRecent = async (tsLast, ...args) => await this.emit(
        'notification-get-recent',
        [tsLast, ...args],
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
    notificationSetStatus = async (id, read, deleted, ...args) => await this.emit(
        'notification-set-status',
        [id, read, deleted, ...args],
    )

    /**
     * @name    onCRUD
     * @summary listen to create, read, update and deletion of off-chain data.
     * 
     * @param   {Function} cb   Args: `{action, data, id, type}`
     */
    onCRUD = (cb, once) => this.on(
        'CRUD',
        cb,
        once
    )

    /**
     * @name    project
     * @summary add/get/update project (Activity)
     * 
     * @param {String}   projectId   Project ID
     * @param {Object}   project
     * @param {Boolean}  create      whether to create or update project
     */
    project = async (
        projectId,
        project,
        create,
        ...args
    ) => await this.emit(
        'project',
        [
            projectId,
            project,
            create,
            ...args
        ],
    )

    /**
     * @name    projectsByHashes
     * @summary retrieve projects by an IDs (AKA hashes)
     * 
     * @param   {Array} projectIds
     * 
     * @returns {Array} [projects, notFoundIds]
     */
    projectsByHashes = async (projectIds, ...args) => await this.emit(
        'projects-by-hashes',
        [projectIds, ...args],
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
    register = async (id, secret, address, referredBy, ...args) => await this.emit(
        'register',
        [
            id,
            secret,
            address,
            referredBy,
            ...args
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
    rewardsClaim = async (platform, handle, postId, ...args) => await this.emit(
        'rewards-claim',
        [
            platform,
            handle,
            postId,
            ...args
        ],
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
    rewardsClaimKAPEX = async (identity, ...args) => await this.emit(
        'rewards-claim-kapex',
        [identity, ...args]
    )

    /**
     * @name    rewardsGetData
     * @summary retrieves all received rewards by the user
     * 
     * @returns {Object}    rewards data
     */
    rewardsGetData = async (...args) => await this.emit(
        'rewards-get-data',
        [...args]
    )

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
    task = async (id, task, ownerAddress, ...args) => await this.emit(
        'task',
        [
            id,
            task,
            ownerAddress,
            ...args
        ],
    )

    /**
     * @name    taskGetById
     * @summary retrieve a list of tasks details' (off-chain data) by Task IDs
     * 
     * @param   {String|Array}  ids single or array of Task IDs
     * 
     * @returns {Map} list of objects with task details
     */
    taskGetById = async (ids, ...args) => await this.emit(
        'task-get-by-id',
        [ids, ...args],
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
    taskGetByParentId = async (parentId, ...args) => await this.emit(
        'task-get-by-parent-id',
        [parentId, ...args],
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
    taskMarketApply = async (application, ...args) => await this.emit(
        'task-market-apply',
        [application, ...args],
        result => new Map(result),
    )

    /**
     * @name    onTaskMarketCreated
     * @summary subscribe to new marketplace task creation event
     *
     * @param   {Function} cb   args: [taskId string]
     */
    onTaskMarketCreated = (cb, once) => this.on(
        'task-market-created',
        cb,
        once
    )

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
    taskMarketApplyResponse = async (data, ...args) => await this.emit(
        'task-market-apply-response',
        [data, ...args],
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
    taskMarketSearch = async (filter, ...args) => await this.emit(
        'task-market-search',
        [filter, ...args],
        result => new Map(result)
    )
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
    const triggerChange = (rx, newValue) => rx.value !== newValue && rx.next(newValue)
    instance.on(eventEventsMeta, meta => {
        instance.eventsMetaCache = meta
        instance.events = {}
        Object
            .keys(meta)
            .forEach(eventName => {
                const eventMeta = meta[eventName] || {}
                let {
                    name,
                    params,
                    // timeout
                } = eventMeta
                if (!eventName || !isArr(params)) return

                if (!name) {
                    const arr = eventName.split('-')
                    name = arr[0] + textCapitalize([...arr.slice(1)]).join('')
                }

                const suffix = ', resultModifier, onError, timeout'
                const dupCheck = {}
                let paramNames = []
                let funcParams = params
                    .map((p, i) => {
                        let {
                            defaultValue,
                            label,
                            name
                        } = p || {}
                        name = name || label
                        // make sure there's no duplicate name in the function arguments
                        if (!name || dupCheck[name]) name = `param${i}`
                        dupCheck[name] = true
                        paramNames.push(name)

                        if (defaultValue === undefined) return name

                        return `${name} = ${defaultValue}`
                    })
                funcParams = arrUnique(funcParams).join(', ') + suffix// + `= ${timeout}`
                paramNames = `[${paramNames.join(', ')}]${suffix}`
                const emitHandler = eval(
                    `(async function ${name}(${funcParams}) {\nreturn await instance.emit("${eventName}", ${paramNames})\n})`
                )
                instance.events[name] = emitHandler
                // add meta data
                eventMeta.eventName = eventName
                Object
                    .keys(eventMeta)
                    .forEach(key =>
                        Object.defineProperty(
                            instance.events[name],
                            `meta_${key}`,
                            { value: eventMeta[key] }
                        )
                    )
            })
        window.events = instance.events
        window.meta = meta
        console.log('events', { meta, events })
    })
    instance.onConnect(async () => {
        rxIsConnected.next(true)
        const active = await instance.maintenanceMode()
        triggerChange(rxIsInMaintenanceMode, active)
        if (!rxIsRegistered.value) return

        const {
            id,
            roles = [],
            secret
        } = getUser() || {}
        const isAdmin = roles.includes(ROLE_ADMIN)
        // wait until until maintenance mdoe is disabled and then attempt to login
        !isAdmin && await subjectAsPromise(rxIsInMaintenanceMode, false)[0]
        // auto login on connect to messaging service
        instance
            .login(id, secret)
            .then(() => console.log(
                new Date().toISOString(),
                'Logged into messaging service'
            ))
            .catch(console.error)
    })
    instance.on('disconnect', () => {
        log('disconnected')
        triggerChange(rxIsConnected, false)
        triggerChange(rxIsLoggedIn, false)
    })
    instance.onConnectError(error => {
        // log('connectError', error)
        triggerChange(rxIsConnected, false)
        triggerChange(rxIsLoggedIn, false)
    })
    instance.onMaintenanceMode(active => {
        console.log(`Maintenance mode ${active ? '' : 'de'}activated`)
        triggerChange(rxIsInMaintenanceMode, active)
    })
    instance.onFaucetStatus(enabled => {
        console.log(`Faucet ${enabled ? 'enabled' : 'disabled'}`)
        triggerChange(rxFaucetEnabled, enabled)
    })

    return instance
}

// retrieves user credentails from local storage
/** @name    setUser
 * @summary retrieves user credentails from local storage
 * 
 * @returns {Object} user
 */
export function getUser() { return rw().user }

const log = (...args) => console.log(
    new Date().toLocaleTimeString(),
    'Totem Messaging Service:',
    ...args
)

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
 * @summary saves user credentails from local storage
 * 
 * @param   {Object}    user
 * 
 * @returns {Object} user
 */
export const setUser = (user = {}) => rw({ user })

/**
 * @name    translateError
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

export default getClient()