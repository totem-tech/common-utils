import uuid from 'uuid'
import { isObj, isStr, isArr, arrUnique, isMap } from './utils'

let connection
// getConnection returns existing connection, if available.
// Otherwise, creates a new connection using the supplied URL.
//
// Params:
// @url     string
//
// Returns  object
export const getConnection = (url) => {
    const nano = require('nano')
    connection = connection || nano(url)
    return connection
}

export default class CouchDBStorage {
    constructor(connectionOrUrl, dbName) {
        this.connectionOrUrl = connectionOrUrl
        this.db = null
        this.dbName = dbName
    }

    async getDB() {
        if (this.dbPromise) {
            // if initialization is already in progress wait for it
            return await this.dbPromise
        }
        if (this.db) return this.db
        const c = this.connectionOrUrl
        const con = c && isStr(c) ? nano(c) : c || connection
        // database already initialized
        if (!isObj(con)) throw new Error('CouchDB: invalid connection')
        if (!this.dbName) throw new Error('CouchDB: missing database name')

        this.dbPromise = (async () => {
            // retrieve a list of all database names
            const dbNames = await con.db.list()
            // database already exists, use it
            if (dbNames.includes(this.dbName)) return con.use(this.dbName)

            // database doesn't exist, create it
            await con.db.create(this.dbName)
            console.log('CouchDB: new database created. Name:', this.dbName)
            this.dbPromise = null
            return con.use(this.dbName)
        })()
        return await this.dbPromise
    }

    // delete removes one or more documents
    //
    // Params:
    // @ids     string/array of strings
    async delete(ids = []) {
        if (!isArr(ids)) {
            // invalid id supplied => ignore.
            if (!isStr(ids)) return
            // @ids is a string => convert to array
            ids = [ids]
        }
        ids = arrUnique(ids.filter(id => isStr(id)))

        let documents = (await this.getAll(ids, false))
            // exclude already deleted or not found documents
            .filter(x => x && !x._deleted)
            // add `_deleted` flag to mark the document for deletion
            .map(d => ({ ...d, _deleted: true }))
        return documents.length === 0 ? [] : await this.setAll(documents)
    }

    // find the first item matching criteria
    async find(selector, extraProps) {
        const docs = await this.search(selector, 1, 0, false, extraProps)
        return docs[0]
    }

    async get(id) {
        const db = await this.getDB()
        // prevents throwing an error when document not found.
        // instead returns undefined.
        try {
            return await db.get(id)
        } catch (e) { }
    }

    // get all or specific documents from a database
    // 
    // Params:
    // @ids     array: use null/falsy to retrieve all items
    // @asMap   boolean: whether to return the list of documents as a Map or Array
    // @limit   number: if @ids is falsy, specifiy how many items to retrieve. 
    //                  (if not specified, CouchDB will return 25 items by default)
    // @skip    number: number of items to skip. Use for pagination
    //
    // Returns array/map: depends on @asMap
    async getAll(ids = [], asMap = true, limit = 25, skip = 0) {
        const db = await this.getDB()
        // if ids supplied only retrieve only those otherwise, retrieve all (paginated)
        let rows
        if (!ids || ids.length === 0) {
            rows = (await this.searchRaw({}, limit, skip)).docs
        } else {
            rows = (await db.fetch({ keys: ids }))
                .rows.map(x => x.doc)
                // ignore not found documents
                .filter(Boolean)
        }
        if (!asMap) return rows
        return new Map(rows.map(x => [x._id, x]))
    }

    // search documents within the database
    async search(selector = {}, limit = 0, skip = 0, asMap = true, extraProps) {
        if (!isObj(selector) || Object.keys(selector).length === 0) return asMap ? new Map() : []
        const result = await this.searchRaw(selector, limit, skip, extraProps)
        return !asMap ? result.docs : new Map(result.docs.map(doc => [doc._id, doc]))
    }

    //
    // Params:
    // @selector    string/object   
    //https://docs.couchdb.org/en/stable/api/database/find.html#find-selectors
    async searchRaw(selector = {}, limit = 0, skip = 0, extraProps = {}) {
        const db = await this.getDB()
        const query = {
            ...extraProps,
            selector,
            limit: limit === 0 ? undefined : limit,
            skip,
        }
        return await db.find(query)
    }

    /**
     * @name    set 
     * @summary create or update document
     * 
     * @param   {String}    id         (optional) if exists, will update document
     * @param   {Object}    value      
     * @param   {Boolean}   override   (optional) whether to allow override of existing document.
     *                                 If truthy, will automatically check if `@id` already exists.
     *                   If false and `@id` exists and correct `@value._rev` not supplied, CouchDB will throw error.
     *                                 Default: true
     * @param   {Boolean}   merge      (optional) whether to merge `@value` with exiting entry.
     *                                 Only applicable if `@override` is truthy.
     *                                 Default: false 
     *
     * @returns {Object}
     */
    async set(id, value, override = true, merge = false) {
        id = isStr(id) ? id : uuid.v1()
        const db = await this.getDB()
        const existingDoc = override && await this.get(id)
        if (existingDoc) {
            // attach `_rev` to execute an update operation
            value._rev = existingDoc._rev
            value = !merge ? value : {...existingDoc, ...value }
        }
        return await db.insert(value, id)
    }

    // setAll adds or updates one or more documents in single request
    //
    // Params:
    // @docs            array/map
    // @ignoreExisting  boolean: whether to ignore existing documents
    //
    // Returns
    async setAll(docs, ignoreIfExists = false) {
        if (isMap(docs)) {
            // convert map to array
            docs = Array.from(docs).map(([_id, item]) => ({ ...item, _id }))
        }
        if (docs.length === 0) return
        const db = await this.getDB()
        for (let i = 0; i < docs.length; i++) {
            const item = docs[i]
            if (!item._id || item._rev) continue

            const existing = await this.get(item._id)
            if (!existing) continue
            if (ignoreIfExists) {
                docs[i] = null
                continue
            }
            // attach `_rev` to prevent conflicts when updating existing items
            item._rev = existing._rev
        }
        return await db.bulk({ docs: docs.filter(Boolean) })
    }
}