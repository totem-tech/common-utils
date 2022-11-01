/*
 * Storage Helper: helper funtions to handle all interactions with browser's localStorage including backup and restore.
 */
import { isHex } from 'web3-utils'
import DataStorage, { rxForeUpdateCache } from './DataStorage'
import { downloadFile, generateHash, hasValue, isFn, isMap, isObj, isSet, isStr, isValidDate, objClean } from './utils'

// Local Storage item key prefix for all items
const PREFIX = 'totem_'
const PREFIX_STATIC = PREFIX + 'static_'
const CACHE_KEY = PREFIX + 'cache'
const SETTINGS_KEY = PREFIX + 'settings'
const MODULE_SETTINGS_KEY = 'module_settings'
const storage = {}
const cache = new DataStorage(CACHE_KEY, true)
const settings = new DataStorage(SETTINGS_KEY, true) // keep cache disabled

// LocalStorage items that are essential for the applicaiton to run. 
export const essentialKeys = [
    'totem_chat-history', // chat history
    'totem_contacts',
    'totem_history', // user activity history
    'totem_identities',
    'totem_locations',
    // notifications are essential because user may need to respond to them in case they are migrating to a new device.
    'totem_notifications',
    'totem_partners',
    'totem_settings',
]

// Storage items that are to include a timestamp after being backed up
export const modulesWithTS = [
    'totem_contacts',
    'totem_identities',
    'totem_locations',
    'totem_partners',
]

/**
 * @name    rw
 * @summary Read/write to storage
 * 
 * @param   {DataStorage} storage 
 * @param   {String}      key       module/item key
 * @param   {String|null} propKey   name of the property to read/write to.
 *                                  If null, will remove all data stored for the @key
 *                                  If not supplied, will return value for the @key
 * @param   {*}           value       If not specified, will return value for @propKey
 *                                  If null, will remove value for @propKey
 *                                  If Map or Set supplied, will be converted to array using `Array.from`.
 *                                  If Object supplied, will merge with existing values.
 * @param   {Boolean}     override  If @value is an Object, whether to override or merge with existing value. 
 *                                  Default: false
 * 
 * @returns {*} 
 */
export const rw = (storage, key, propKey, value, override = false) => {
    if (!storage || !key) return {}
    const data = storage.get(key) || {}
    if (!isStr(propKey) && propKey !== null) return data

    if (propKey === null) {
        return storage.delete(key)
    } else if (value === null) {
        // remove from storage
        delete data[propKey]
    } else if (isMap(value) || isSet(value)) {
        // convert map to array. PS: may need to convert back to Map on retrieval
        data[propKey] = Array.from(value)
    } else if (isObj(value)) {
        // merge with existing value
        data[propKey] = override
            ? value
            : { ...data[propKey], ...value }
    } else if (hasValue(value)) {
        data[propKey] = value
    } else {
        // nothing to save | read-only operation
        return data[propKey]
    }
    storage.set(key, data)
    return data[propKey]
}

export const backup = {
    /**
     * @name    backup.download
     * @summary download backup of application data
     * 
     * @param   {String}    filename        (optional) Default: generated name with domain and timestamp
     * @param   {Function}  dataModifier    function to modify/encrypt downloadable data/object
     *                                      Args: Object
     *                                      Expected return: String/Object
     * 
     * @returns {Array} 
     * [
     *     content     String:
     *     timestamp   String:
     *     fileName    String:
     * ]
     */
    download: (filename, dataModifier = null) => {
        filename = filename || backup.generateFilename()
        const timestamp = backup.filenameToTS(filename)
        let data = backup.generateData(timestamp)
        // add filename hash to the backup to force user to upload the exact same file
        data._file = generateHash(filename, 'blake2', 32).slice(2)
        data = isFn(dataModifier)
            ? dataModifier(data)
            : data
        const content = isStr(data)
            ? data
            : JSON.stringify(data)
        downloadFile(
            content,
            filename,
            'application/json',
        )
        return {
            data,
            hash: generateHash(content, 'blake2', 256),
            timestamp,
            filename,
        }
    },

    /**
     * @name    backup.filenameToTS
     * @summary extract timestamp from the backup filename
     * 
     * @returns {String}
     */
    filenameToTS: (filename) => `${filename || ''}`
        .split('backup-')[1]
        .split('.json')[0],

    /**
     * @name    backup.generateData
     * @summary generates an object for backup only using essential data from localStorage
     * 
     * @params  {String}    timestamp
     * 
     * @returns {Object}
     */
    generateData: (timestamp = new Date().toISOString()) => {
        // data to be backed up
        const data = objClean(localStorage, essentialKeys)
        Object
            .keys(data)
            .forEach(key => {
                data[key] = JSON.parse(data[key])
                if (!timestamp) return

                if (key === SETTINGS_KEY) {
                    const { messaging = {} } = data[SETTINGS_KEY]
                        .find(([key]) => key === MODULE_SETTINGS_KEY)[1]
                        || {}
                    messaging.user = {
                        ...messaging.user,
                        fileBackupTS: timestamp,
                    }
                }
                if (!modulesWithTS.includes(key)) return

                // update backup timestamp
                data[key].forEach(([_, entry]) =>
                    entry.fileBackupTS = timestamp
                )
            })

        return data
    },

    /**
     * @name    backup.generateFileName
     * @summary generates a backup filename using current timestamp and URL hostname
     * 
     * @returns {String}
     */
    generateFilename: (timestamp = new Date().toISOString()) => {
        const hostname = window.location.hostname === 'localhost'
            ? 'totem-localhost'
            : window.location.hostname

        const fileName = `${hostname}-backup-${timestamp}.json`
        return fileName
    },

    /**
     * @name    backup.updateTS
     * @summary update backup timestamps of module data (eg: identities, partners).
     *          This should only be invoked after backup download has been confirmed.
     * 
     * @param   {Object}    data        parsed replica of localStorage with only the keys that are to be backed up
     * @param   {String}    timestamp   ISO timestamp to be set as the backup datetime
     * 
     * @returns {Object}    data
     */
    updateFileBackupTS: (timestamp) => {
        if (!isValidDate(timestamp)) throw new Error('invalid timestamp')

        // set timestamp for individual storage entries
        modulesWithTS.forEach(moduleKey => {
            const moduleStorage = new DataStorage(moduleKey)
            const updated = moduleStorage
                .map(([key, value]) => ([key, {
                    ...value,
                    fileBackupTS: timestamp,
                }]))
            moduleStorage.setAll(new Map(updated), true)
        })

        // set timestamp on user credentials
        const user = {
            ...storage
                .settings
                .module('messaging')
                .user
            || {},
            fileBackupTS: timestamp,
        }
        !!user.id && storage.settings.module('messaging', { user })

        // update modules
        rxForeUpdateCache.next(modulesWithTS)
    },
}

storage.backup = backup
storage.countries = new DataStorage(PREFIX_STATIC + 'countries', true)

storage.settings = {
    // global settings
    // 
    // Params: 
    // @itemKey string: unique identifier for target module or item (if not part of any module)
    // @value   object: (optional) settings/value to replace existing.
    global: (itemKey, value) => rw(settings, 'global_settings', itemKey, value),

    /**
     * @name    storage.settings.module
     * @summary read/write module related settings to localStorage
     * 
     * @param   {String}    moduleKey   a unique identifier for the module
     * @param   {*}         value
     * @param   {Boolean}   override    if @value is an Object, whether to override or merge with existing value.
     *                                  Default: false
     * 
     * @returns {*} returns the saved value
     */
    module: (moduleKey, value, override = false) => rw(settings, MODULE_SETTINGS_KEY, moduleKey, value, override)
}

/**
 * @name    storage.cache
 * @summary read/write to module cache storage
 * 
 * @param   {String}        moduleKey 
 * @param   {String|null}   itemKey 
 * @param   {*|null}        value 
 * 
 * @returns {*}
 */
storage.cache = (moduleKey, itemKey, value) => rw(cache, moduleKey, itemKey, value)

/**
 * @name    storage.cacheDelete
 * @summary remove all cached data for a module
 * 
 * @param   {String} moduleKey 
 */
storage.cacheDelete = moduleKey => rw(cache, moduleKey, null)

// removes cache and static data
// Caution: can remove 
storage.clearNonEssentialData = () => {
    const keys = [
        CACHE_KEY,
        //deprecated
        'totem_service_notifications',
        'totem_translations',
        'totem_sidebar-items-status',
    ]
    const partialKeys = [
        '_static_',
        '_cache_',
    ]
    const shouldRemove = key => !essentialKeys.includes(key) && (
        // makes sure essential keys are not removed
        keys.includes(key)
        || partialKeys.reduce((remove, pKey) =>
            remove || key.includes(pKey),
            false,
        )
    )

    Object
        .keys(localStorage)
        .forEach(key =>
            shouldRemove(key)
            && localStorage.removeItem(key)
        )
}

export default storage