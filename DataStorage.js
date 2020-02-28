import { isDefined, isStr, mapSearch, isMap, isValidNumber } from './utils'
import { Bond } from 'oo7'
import uuid from 'uuid'

let storage;
try {
    // Use browser localStorage if available
    storage = localStorage
} catch (e) {
    // for node server
    const nls = require('node-localstorage')
    const STORAGE_PATH = process.env.STORAGE_PATH || './server/data'
    console.log({ STORAGE_PATH })
    storage = new nls.LocalStorage(STORAGE_PATH, 500 * 1024 * 1024)
}

const read = key => {
    const data = JSON.parse(storage.getItem(key) || '[]')
    return new Map(data)
}
const write = (key, value) => {
    // invalid key: ignore request
    if (!isStr(key)) return false
    value = Array.from(value.entries())
    storage.setItem(key, JSON.stringify(value))
}

export default class DataStorage {
    constructor(name, disableCache = false) {
        this.bond = new Bond().defaultTo(uuid.v1())
        this.name = name
        // whether to disable data cache
        this.disableCache = disableCache
        this.Type = Map
        this.data = new this.Type()
        if (name && !disableCache) {
            this.data = read(this.name)
        }
        this.size = this.data.size
    }

    _updateBond() {
        setTimeout(() => this.bond.changed(uuid.v1()))
    }

    delete(key) {
        const data = this.getAll()
        data.delete(key)
        if (!this.disableCache || !this.name) {
            this.data = data
        }
        this.name && write(this.name, data)
        this.size--
        this._updateBond()
        return this
    }

    // returns first item matching criteria
    find(keyValues, matchExact, matchAll, ignoreCase) {
        const result = this.search(keyValues, matchExact, matchAll, ignoreCase)
        return result.size === 0 ? null : Array.from(result)[0][1]
    }

    get(key) {
        return this.getAll().get(key)
    }

    getAll() {
        if (!this.name || !this.disableCache) return this.data
        const data = read(this.name)
        this.size = data.size
        if (!this.disableCache) {
            this.data = data
        }
        return data
    }

    search(keyValues, matchExact, matchAll, ignoreCase, limit) {
        let result = mapSearch(this.getAll(), keyValues, matchExact, matchAll, ignoreCase)
        if (isValidNumber(limit) && result.size > limit) {
            result = new Map(Array.from(result).slice(0, limit))
        }
        return result
    }

    set(key, value) {
        if (!isDefined(key)) return this
        const data = this.getAll()
        data.set(key, value)
        this.name && write(this.name, data)
        this.size = data.size
        this._updateBond()
        return this
    }

    // overrides any existing entries
    setAll(data) {
        if (!isMap(data)) return this
        if (!this.disableCache || !this.name) {
            this.data = data
        }
        this.name && write(this.name, data)
        this._updateBond()
        return this
    }
}