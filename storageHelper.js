/*
 * Storage Helper: helper funtions to handle all interactions with browser's localStorage including backup and restore.
 */
import DataStorage, { rxForeUpdateCache } from './DataStorage'
import { downloadFile, generateHash, hasValue, isMap, isObj, isSet, isStr, isValidDate, objClean } from './utils'

// Local Storage item key prefix for all items
const PREFIX = 'totem_'
const PREFIX_STATIC = PREFIX + 'static_'
const CACHE_KEY = PREFIX + 'cache'
const storage = {}
const cache = new DataStorage(CACHE_KEY, true)
const settings = new DataStorage(PREFIX + 'settings', true) // keep cache disabled

// LocalStorage items that are essential for the applicaiton to run. 
export const essentialKeys = [
    'totem_chat-history', // chat history
    'totem_history', // user activity history
    'totem_identities',
    'totem_locations',
    // notifications are essential because user may need to respond to them in case they are migrating to a new device.
    'totem_notifications',
    'totem_partners',
    'totem_settings',
]

export const modulesWithTS = [
    'totem_identities',
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
     * @param   {String}    filename (optional)
     * 
     * @returns {Array} [
     *                      content     string: st
     *                      timestamp   string:
     *                      fileName    string:
     *                  ]
     */
    download: (filename = backup.generateFilename()) => {
        const timestamp = storage
            .backup
            .filenameToTS(filename)
        const data = backup.generateData(timestamp)
        data.__fileName = filename
        const content = JSON.stringify(data)
        downloadFile(
            content,
            filename,
            'application/json'
        )
        return {
            data,
            hash: generateHash(content),
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
     * @name    backup.generate
     * @summary generates an object for backup only using essential data from localStorage
     * 
     * @returns {Object}
     */
    generateData: (timestamp) => {
        const data = objClean(localStorage, essentialKeys)
        Object
            .keys(data)
            .forEach(key => {
                data[key] = JSON.parse(data[key])

                if (!timestamp || modulesWithTS.includes(key)) return
                // update backup timestamp
                data[key]
                    .forEach(([_, entry]) =>
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
     */
    updateFileBackupTS: (data, timestamp) => {
        if (!isObj(data) || !isValidDate(timestamp)) return console.log('updateFileBackupTS invalid', data, timestamp)

        Object
            .keys(data)
            .forEach(moduleKey => {
                if (!modulesWithTS.includes(moduleKey)) return
                const moduleStorage = new DataStorage(moduleKey)
                const keysToUpdated = data[moduleKey]
                    .map(([key]) => key)
                const updated = moduleStorage
                    .map(([key, value]) => [
                        key,
                        {
                            ...value,
                            fileBackupTS: keysToUpdated.includes(key)
                                ? timestamp
                                : value.fileBackupTS,
                        },
                    ])
                moduleStorage.setAll(new Map(updated))
            })

        // update modules
        rxForeUpdateCache.next(modulesWithTS)
    }
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
    module: (moduleKey, value, override = false) => rw(settings, 'module_settings', moduleKey, value, override)
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
    const shouldRemove = key => !essentialKeys.includes(key)
        // makes sure essential keys are not removed
        && (
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