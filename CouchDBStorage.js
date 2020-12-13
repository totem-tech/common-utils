import uuid from 'uuid'
import PromisE from './PromisE'
import nano from 'nano'
import { isObj, isStr, isArr, arrUnique, isMap } from './utils'

// globab connection for use with multiple databases
let connection
/**
 * @name    getConnection
 * @summary getConnection returns existing connection, if available.
 *          Otherwise, creates a new connection using the supplied URL.
 * 
 * @param   {String}    url 
 * @param   {Boolean}   global whether to use global connection
 * 
 * @returns {Objecct}   CouchDB connection
 */
export const getConnection = (url, global = true) => {
    if (global && connection) return connection
    const con = nano(url)
    if (global) connection = con
    return con
}

/**
 * @name        CouchDBStorage
 * @summary     a wrapper for `nano` NPM module for reading from and writing to CouchDB
 * @description connection is only initialized only when first request is made or `getDB()` method is called.
 * 
 * @param   {String|Object|Null}    connectionOrUrl Possible values:
 *                                      1. string: CouchDB connection URL including username and password
 *                                      2. object: existing connection
 *                                      3. null:   will use global `connection` if available.
 * @param   {String}                dbName          database name
 * 
 * @returns {CouchDBStorage}
 */
export default class CouchDBStorage {
    constructor(connectionOrUrl, dbName) {
        this.connectionOrUrl = connectionOrUrl
        this.db = null
        this.dbName = dbName
    }

    /**
     * @name        getDB
     * @summary     Connect to CouchDB and then create new or re-use existing `db` instance
     * @description Will create new database, if does not exist.
     */
    async getDB() {
        if (this.db) return this.db
        // if initialization is already in progress wait for it
        if (this.dbPromise) return await this.dbPromise
        const cou = this.connectionOrUrl
        const dbName = this.dbName
        const con = cou && isStr(cou)
            ? getConnection(cou)
            : cou || connection
        // database already initialized
        if (!isObj(con)) throw new Error('CouchDB: invalid connection')
        if (!dbName) throw new Error('CouchDB: missing database name')

        this.dbPromise = new PromisE((resolve, reject) => (async ()=> {
            try {
                // retrieve a list of all database names
                const dbNames = await con.db.list()
                // database already exists, use it
                if (!dbNames.includes(dbName)) {
                    // database doesn't exist, create it
                    console.log('CouchDB: new database created. Name:', dbName)
                    await con.db.create(dbName)
                }
                this.dbPromise = null
                resolve(con.use(dbName))
            } catch (err) {
                reject(err)
            }
        })())
        
        return await this.dbPromise
    }

    /**
     * @name    delete
     * @summary delete documents
     * 
     * @param   {String|Object|Map|Array} ids   Possible values:
     *                        1. String: document `_id`
     *                        2. Object: document with `_id` property. Will be ignored if does not include `_id`.
     *                        3. Map: collection of (2) with `_id` as key 
     *                        4. Array: collection of (1) or (2) or both.
     * @returns {*}
     */
    async delete(ids = []) {
        ids = isArr(ids)
            ? ids
            : !isMap(ids)
                ? [ids]
                // convert documents Map to array
                : Array.from(ids)
                    .map(([_id, doc]) => ({ ...doc, _id }))
        let documents = ids.filter(x => isObj(x) && !!x._id && x._rev)
        ids = arrUnique(ids.filter(id => !!id && isStr(id)))
        // nothing do to!
        if (!ids.length && !documents.length) return

        documents = [
            ...documents,
            ...(ids.length ? await this.getAll(ids, false) : []),
        ]
            // exclude already deleted or not found documents
            .filter(x => x && !x._deleted)
            // add `_deleted` flag to mark the document for deletion
            .map(d => ({ ...d, _deleted: true }))
        // nothing to delete
        if (!documents.length) return []
        // save documents for deletion
        return await this.setAll(documents)
    }

    /**
     * @name    find
     * @summary find the first item matching criteria
     * 
     * @param   {Object} selector   CouchDB selector for mango query
     * @param   {Object} extraProps (optional) extra properties to be supplied to mango query. Eg: for sorting.
     * 
     * @returns {Object} document if available otherwise, undefined
     */
    async find(selector, extraProps) {
        const docs = await this.search(selector, 1, 0, false, extraProps)
        return docs[0]
    }

    /**
     * @name    get
     * @summary get document by ID without throwing error if ID doesn't exists.
     * 
     * @param   {String} id document ID. (the `_id` property)
     * 
     * @returns {Object} document if available otherwise, undefined
     */
    async get(id) {
        this.name === 'users' && console.log('getDB')
        const db = await this.getDB()
        this.name === 'users' && console.log({db})
        // prevents throwing an error when document not found.
        // instead returns undefined.
        try {
            return await db.get(id)
        } catch (e) { }
    }

    /**
     * @name    getAll
     * @summary get all or specific documents from a database.
     * 
     * @param   {Array|Null} ids    (optional) If document IDs supplied will retrieve all relevant documents in one go.
     *                              Otherwise, will retrieve paginated documents by using `skip` and `limit`. 
     * @param   {Boolean}    asMap  whether to return result as an `Array` or `Map`.
     *                              Default: true
     * @param   {Number}     limit  (optional) maximum number of items to retrieve in one go.
     *                              Ignored if `ids` supplied.
     *                              Default: 25
     * @param   {Number}     skip   (optional) for pagination, number of items to skip.
     *                              Ignored if `ids` supplied.
     *                              Default: 0
     * @returns {Map|Array}
     */
    async getAll(ids = [], asMap = true, limit = 25, skip = 0) {
        const db = await this.getDB()
        // if ids supplied only retrieve only those otherwise, retrieve all (paginated)
        const paginate = !ids || ids.length === 0
        const rows = paginate
            ? (await this.searchRaw({}, limit, skip)).docs
            : (await db.fetch({ keys: ids }))
                .rows.map(x => x.doc)
                // ignore not found documents
                .filter(Boolean)
        return asMap
            ? new Map(rows.map(x => [x._id, x]))
            : rows
    }

    /**
     * @name    search
     * @summary search for documents using CouchDB mango query
     * 
     * @param   {Object}  selector   For documentation visit:
     *                               https://docs.couchdb.org/en/stable/api/database/find.html#selector-syntax
     * @param   {Number}  limit      (optional) number of items to retrieve 
     *                               Default: 100
     * @param   {Number}  skip       (optional) number of items to skip
     *                               Default: 0 (unlimited)
     * @param   {Boolean} asMap      (optional) whether to return result as an `Array` or `Map`
     *                               Default: true
     * @param   {Object}  extraProps (optional) extra properties to be supplied to to the mango query
     * 
     * @returns {Map|Array}
     */
    async search(selector = {}, limit = 0, skip = 0, asMap = true, extraProps) {
        if (!isObj(selector) || Object.keys(selector).length === 0) return asMap ? new Map() : []
        const result = await this.searchRaw(selector, limit, skip, extraProps)
        return !asMap
            ? result.docs
            : new Map(result.docs.map(doc => [doc._id, doc]))
    }

    /**
     * @name    searchRaw
     * @summary sugar for `db.find()`
     * 
     * @param   {Object} selector 
     * @param   {Number} limit 
     * @param   {Number} skip 
     * @param   {Object} extraProps 
     * 
     * @returns {Array}
     */
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

    /**
     * @name    setAll 
     * @summary bulk add or update documents in single request
     *
     * Params:
     * @param   {Array|Map} docs            documents to add or update
     * @param   {Boolean}   ignoreIfExists  (optional) if true, will prevent overriding existing documents.
     *                                      Default: false
     *
     * @returns {*}
     */
    async setAll(docs, ignoreIfExists = false) {
        if (isMap(docs)) {
            // convert Map to Array
            docs = Array.from(docs).map(([_id, item]) => ({ ...item, _id }))
        }
        if (!docs.length) return

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