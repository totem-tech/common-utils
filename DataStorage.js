import { BehaviorSubject, Subject } from 'rxjs'
import { isDefined, isStr, mapSearch, isMap, isValidNumber, mapSort, isArr, isFn } from './utils'
/* For NodeJS (non-browser applications) the following node module is required: node-localstorage */

let storage, isNode
// use this to force all instances of DataStorage where caching is enabled to update data from LocalStorage
// ONLY USE IN EXTREME CASES such as restoring a backup.
// Usage: rxForeUpdateCache.next(true)
export const rxForeUpdateCache = new Subject()
try {
    // Use browser localStorage if available
    storage = localStorage
    isNode = false
    if (storage === null) {
        // hack for iframe
        // localStorage will not work!! (expected)
        storage = { getItem: () => '', setItem: () => { } }
    }
} catch (e) {
    try {
        // for NodeJS server
        const nls = require('node-localstorage')
        const STORAGE_PATH = process.env.STORAGE_PATH || './server/data'
        isNode = true
        storage = new nls.LocalStorage(STORAGE_PATH, 500 * 1024 * 1024)
        if (storage) {
            const absolutePath = require('path').resolve(STORAGE_PATH)
            console.log({ STORAGE_PATH, absolutePath })
        }
    } catch (e) { }
}

/**
 * @name    read
 * @summary read from storage (JSON file if NodeJS, otherwise, browser LocalStorage)
 *
 * @param   {String} key file name (NodeJS) or property key (LocalStorage)
 * 
 * @returns {Map}        retieved data
 */
const read = key => {
    try {
        const data = JSON.parse(storage.getItem(key) || '[]')
        return new Map(data)
    } catch (e) {
        return new Map()
    }
}
/**
 * @name    write
 * @summary write to storage (JSON file if NodeJS, otherwise, browser LocalStorage)
 * 
 * @param   {String}  key file name (NodeJS) or property key (LocalStorage)
 * @param   {*}       value will be converted to JSON string
 */
const write = (key, value) => {
    // invalid key: ignore request
    if (!isStr(key)) return
    try {
        value = Array.from(value.entries())
        storage.setItem(key, JSON.stringify(value))
    } catch (e) { }
}

export default class DataStorage {
    /**
     * @name DataStorage
     * @summary a wrapper to read/write to LocalStorage (browser) or JSON file (NodeJS) with added features.
     * @description Notes:
     *  - this is a key-value storage that mimics the structure of `Map` and add extra functionalities like search.
     *  - `name` is not supplied: `disableCache` will always be assumed true
     *  - `disableCache = true`: reads once from storage and and only write when necessary.
     *  - `disableCache = false`: data is never preserved in-memory and every read/write 
     *      operation will be directly from/to the appropriate storage
     *
     * @param {String}    name filename (NodeJS) or property name (browser LocalStorage).
     * @param {Boolean}   disableCache (optional) Whether to keep data in-memory. Default: false
     * @param {Function}  onChange (optional) callback to be invoked on change of data.
     *                      See Subject/BehaviorSubject.subscribe for more details.
     * @param {Map}       initialValue (optional) Default: new Map()
     */
    constructor(name, disableCache = false, initialValue, onChange) {
        let data = (name && read(name)) || initialValue
        data = !isMap(data) ? new Map() : data
        this.name = name
        this.disableCache = name && disableCache
        this.rxData = this.disableCache ? new Subject() : new BehaviorSubject(data)
        this.size = data.size
        this.save = true
        this.rxData.subscribe(data => {
            this.name && this.save && write(this.name, data)
            this.save = true
            this.size = data.size
            isFn(onChange) && onChange(data)
        })
        if (this.disableCache) return

        // update cached data from localStorage throughout the application only when triggered
        rxForeUpdateCache.subscribe(ok => {
            if (this.disableCache || ok !== true) return
            const data = read(this.name)
            this.size = data.size
            this.rxData.next(data)
        })
    }

    /**
     * @name    delete
     * @summary delete one or more items by their respective keys
     * 
     * @param   {Array|String} keys one or more keys
     * 
     * @returns {DataStorage}  reference to the DataStorage instance
     */
    delete(keys = []) {
        const data = this.getAll()
        keys = isArr(keys) ? keys : [keys]
        // nothing to do
        if (!keys.length) return this

        keys.forEach(key => data.delete(key))
        this.rxData.next(data)
        return this
    }

    /**
     * @name    find
     * @summary find the first item matching criteria. Uniqueness is not guaranteed.
     *
     * @param   {Object}  keyValues  Object with property names and the the value to match
     * @param   {Boolean} matchExact (optional) fulltext or partial search. Default: false
     * @param   {Boolean} matchAll   (optional) AND/OR operation for keys in @keyValues. Default: false
     * @param   {Boolean} ignoreCase (optional) case-sensitivity of the search. Default: false
     */
    find(keyValues, matchExact, matchAll, ignoreCase) {
        const result = this.search(
            keyValues,
            matchExact,
            matchAll,
            ignoreCase,
            1,
        )
        return result.size === 0
            ? null
            : Array.from(result)[0][1]
    }

    /**
     * @name    get
     * @summary get item by key
     * 
     * @param   {String} key 
     * 
     * @returns {*} value stored for the supplied @key
     */
    get(key) {
        return this.getAll().get(key)
    }

    /**
     * @name    forceRead
     * @summary force read from storage
     * 
     * @param   {Boolean} forceRead 
     * 
     * @returns {Map} data
     */
    getAll(forceRead = false) {
        if (!forceRead && !this.disableCache) return this.rxData.value
        const data = read(this.name)
        this.size = data.size
        return data
    }

    /**
     * @name map
     * @summary map each item on the data to an Array. This is a shorhand for `Array.from(this.getAll()).map(cb)`
     * @param {Function} callback callback function to execute for each item in the list. 3 arguments supplied:
     *                              @item   Array: Each item will contain key and value in an array. Eg: [key, value]
     *                              @index  Number
     *                              @array  Array: The entire Map in a 2D Array. Eg: [[key, value], [key2, value2]]
     * @returns {Array} array of items returned by callback
     */
    map(callback) {
        return this.toArray().map(callback)
    }

    /**
     * @name    search
     * @summary partial or fulltext search on storage data
     * 
     * @param   {Object}  keyValues  Object with property names and the the value to match
     * @param   {Boolean} matchExact (optional) fulltext or partial search. Default: false
     * @param   {Boolean} matchAll   (optional) AND/OR operation for keys in @keyValues. Default: false
     * @param   {Boolean} ignoreCase (optional) case-sensitivity of the search. Default: false.
     * @param   {Number}  limit      (optional) limits number of results. Default: 0 (no limit)
     * 
     * @returns {Map}     result
     */
    search(keyValues, matchExact = false, matchAll = false, ignoreCase = false, limit = 0) {
        const result = mapSearch(
            this.getAll(),
            keyValues,
            matchExact,
            matchAll,
            ignoreCase,
        )
        const doLimit = isValidNumber(limit) && limit > 0 && result.size > limit
        return !doLimit
            ? result
            : new Map(
                Array.from(result)
                    .slice(0, limit)
            )
    }

    /**
     * @name    set
     * @summary save/update an item
     * 
     * @param   {String|Number|Boolean} key 
     * @param   {*} value 
     * 
     * @returns {DataStorage} reference to the DataStorage instance
     */
    set(key, value) {
        if (!isDefined(key)) return this
        const data = this.getAll()
        data.set(key, value)
        this.rxData.next(data)
        return this
    }

    /**
     * @name    setAll
     * @summary set multiple items at one go
     * 
     * @param   {Map}     data     list of items
     * @param   {Boolean} override whether to override or merge with existing data
     * 
     * @returns {DataStorage}      reference to the DataStorage instance
     */
    setAll(data, override = true) {
        if (!isMap(data)) return this
        if (!override) {
            // merge data
            const existing = this.getAll()
            Array.from(data)
                .forEach(([key, value]) =>
                    existing.set(key, value)
                )
            data = existing // merged value
        }

        this.rxData.next(data)
        return this
    }

    /**
     * @name    sort
     * @summary sort data by key or simply reverse the entire list. Optionally, save sorted data to storage.
     * 
     * @param   {Boolean} reverse whether to reverse reverse sort. Deafult: false
     * @param   {String}  key     (optional) sort by specific key. If `!key && !!reverse`, reverse the entire list.
     * @param   {Boolean} save    (optional) whether to save sorted data to storage. Default: false
     * 
     * @retuns  {Map}
     */
    sort(key, reverse = false, save = false) {
        let data = this.getAll()
        if (!key && !reverse) return data // nothing to do

        data = !key
            ? new Map(Array.from(data).reverse())
            : mapSort(data, key, reverse)
        if (save) this.setAll(data)

        return data
    }

    /**
     * @name    toArray
     * @summary convert list of items (Map) to 2D Array
     * 
     * @returns {Array}
     */
    toArray() {
        return Array.from(this.getAll())
    }

    /**
     * @name    toString
     * @summary converts list of items (Map) to JSON string of 2D Array 
     * 
     * @param   {Function}  replacer (optional) for use with `JSON.stringify`. Default: null
     * @param   {Number}    spacing  (optional) for use with `JSON.stringify`. Default: 0
     * 
     * @returns {String}    JSON string
     */
    toString(replacer = null, spacing = 0) {
        return JSON.stringify(
            this.toArray(),
            replacer,
            spacing,
        )
    }
}