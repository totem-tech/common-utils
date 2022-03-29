import uuid from 'uuid'
import PromisE from './PromisE'
import nano from 'nano'
import { isObj, isStr, isArr, arrUnique, isMap, isValidNumber } from './utils'

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
export const getConnection = async (url, global = true) => {
    if (global && connection) return connection

    const con = await nano(url)
    if (global) connection = con
    return con
}

/**
 * @name    isCouchDBStorage
 * @summary checks if all arguments are instance of CouchDBStorage class
 * 
 * @param   {...} args  values to check
 * 
 * @returns {Boolean} 
 */
export const isCouchDBStorage = (...args) => args.flat()
    .every(instance => instance instanceof CouchDBStorage)

/**
 * @name    setTs
 * @summary set created and updated timestamps to document
 * 
 * @param   {Object}    doc 
 * @param   {Object}    existingDoc (optional)
 * 
 * @returns {Object}    doc
 */
const setTs = (doc, existingDoc) => {
    if (!doc) {
        console.log({ doc, existingDoc })
    }
    // add/update creation and update time
    doc.tsCreated = (existingDoc || doc).tsCreated || new Date()
    if (!!existingDoc || doc.tsUpdated) {
        doc.tsUpdated = new Date()
    }
    return doc
}

export default class CouchDBStorage {
    /**
     * @name        CouchDBStorage
     * @summary     a wrapper for `nano` NPM module for reading from and writing to CouchDB
     * @description connection is only initialized only when first request is made or `getDB()` method is called.
     *
     * @param   {String|Object|Null}    connectionOrUrl Possible values:
     *                                      1. string: CouchDB connection URL including username and password
     *                                      2. object: existing connection
     *                                      3. null:   will use global `connection` if available.
     *                                  Alternatively, use a specific environment variable for individual database.
     *                                  The name of the environement variable must be in the following format:
     *                                      `CouchDB_URL_$DBNAME`
     *                                  Replace `$DBNAME` with database name. The same to be provide in param `dbName`
     * @param   {String}                dbName          database name
     * @param   {Array}                 fields (optional) fields to retreive whenever retrieving documents.
     *                                  This can be overridden in the `extraProps` argument wherever applicable.
     *                                  Default: `[]` (all fields)
     *
     * @returns {CouchDBStorage}
     */
    constructor(connectionOrUrl, dbName, fields = []) {
        this.connectionOrUrl = connectionOrUrl || process.env[`CouchDB_URL_${dbName}`]
        // whethe to use the global connection or database specific
        this.useGlobalCon = !this.connectionOrUrl
        this.db = null
        this.dbName = dbName
        this.fields = fields

        // Forces the application to immediately attempt to connect.
        // This is required because "nano" (CouchDB's official NPM module) does not handle connection error properly 
        // and the entire application crashes. Neither try-catch nor async - await can catch this freakish error!
        // Doing this will make sure database connection error is thrown on application startup and not later.
        if (!this.useGlobalCon) this.getDB()
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
    async find(selector, extraProps, timeout) {
        const docs = await this.search(
            selector,
            1,
            0,
            false,
            extraProps,
            timeout,
        )
        return docs[0]
    }

    /**
     * @name    get
     * @summary get document with specified fields. This method cannot retrieve any design documents.
     * 
     * @param   {String} id     document ID. (the `_id` property)
     * @param   {Array}  fields list of properties to retrieve. 
     * 
     * @returns {Object} document if available otherwise, undefined
     */
    async get(id, fields = this.fields, timeout) {
        return await this.find(
            { _id: id },
            isArr(fields)
                ? { fields }
                : undefined,
            timeout
        )
    }

    /**
     * @name    getDoc
     * @summary retrieve a document with all properties. This method can retrieve design documents.
     * 
     * @param   {String} id document ID. (the `_id` property)
     * 
     * @returns {Object}
     */
    async getDoc(id) {
        const db = await this.getDB()
        try {
            return await db.get(id)
        } catch (_) { }
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
     * @param   {Object}     extraProps extra properties to be supplied to `searchRaw()`.
     *                              Can be used for sorting, limiting which fields to retrieve etc.
     *                              Only used when no IDs supplied.
     * @param   {Number}    timeout timeout duration in milliseconds (only when no IDs supplied).
     *                              Default: `15000`
     * @returns {Map|Array}
     */
    async getAll(ids = [], asMap = true, limit = 25, skip = 0, extraProps = {}, timeout) {
        const db = await this.getDB()
        // if ids supplied only retrieve only those otherwise, retrieve all (paginated)
        const paginate = !ids || ids.length === 0
        const rows = paginate
            ? (await this.searchRaw({}, limit, skip, extraProps)).docs
            : (await db.fetch({ keys: ids })).rows
                .map(x => x.doc)
                // ignore not found documents
                .filter(Boolean)
        return asMap
            ? new Map(rows.map(x => [x._id, x]))
            : rows
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

        const dbName = this.dbName
        if (!dbName) throw new Error('CouchDB: missing database name')

        const con = isObj(this.connectionOrUrl)
            ? await this.connectionOrUrl
            : await getConnection(this.connectionOrUrl, this.useGlobalCon)
        // database already initialized
        if (!isObj(con)) throw new Error('CouchDB: invalid connection')

        this.dbPromise = new PromisE((resolve, reject) => (async () => {

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

                this.db = con.use(dbName)
                resolve(this.db)
            } catch (err) {
                reject(err)
            }
        })())

        return await this.dbPromise
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
     * @param   {Number}    timeout     query timeout duration in milliseconds.
     *                                  Default: `15000`
     * 
     * @returns {Map|Array}
     */
    async search(selector = {}, limit = 0, skip = 0, asMap = true, extraProps, timeout) {
        if (!isObj(selector) || Object.keys(selector).length === 0) return asMap ? new Map() : []
        const result = await this.searchRaw(selector, limit, skip, extraProps, timeout)
        return !asMap
            ? result.docs
            : new Map(result.docs.map(doc => [doc._id, doc]))
    }

    /**
     * @name    searchRaw
     * @summary sugar for `db.find()`
     * 
     * @param   {Object}    selector 
     * @param   {Number}    limit 
     * @param   {Number}    skip 
     * @param   {Object}    extraProps
     * @param   {Number}    timeout     query timeout duration in milliseconds.
     *                                  Default: `15000`
     * 
     * @returns {Array}
     */
    async searchRaw(selector = {}, limit = 0, skip = 0, extraProps = {}, timeout = 15000) {
        const db = await this.getDB()
        const query = {
            fields: this.fields,
            ...extraProps,
            selector,
            limit: limit === 0 ? undefined : limit,
            skip,
        }
        return await PromisE.timeout(
            db.find(query),
            timeout,
        )
    }

    /**
     * @name    set 
     * @summary create or update document
     * 
     * @param   {String}    id      (optional) if exists, will update document
     * @param   {Object}    value   
     * @param   {Boolean}   update  (optional) whether to allow updating existing document.
     *                              If truthy, will automatically check if `@id` already exists.
     *                              If false and `@id` exists and correct `@value._rev` not already supplied, CouchDB 
     *                              will throw an error.
     *                              Default: `true`
     * @param   {Boolean}   merge   (optional) whether to merge `@value` with exiting entry.
     *                              Only applicable if `@update` is truthy.
     *                              Default: `true`
     * @param   {Number}    timeout timeout duration in milliseconds for save operation.
     *                              Default: `3000`
     * 
     *
     * @returns {Object}
     */
    async set(id, value, update = true, merge = true, timeout = 3000, updateTS = true) {
        id = isStr(id)
            ? id
            : uuid.v1()
        const db = await this.getDB()
        const existingDoc = update && await this.get(id, [])
        if (existingDoc) {
            // attach `_rev` to execute an update operation
            value = !merge
                ? value
                : {
                    ...existingDoc,
                    ...value,
                }
            // make sure _rev is latest
            value._rev = existingDoc._rev
        }

        updateTS && setTs(value, existingDoc)
        return await PromisE.timeout(
            db.insert(value, id),
            timeout,
        )
    }

    /**
     * @name    setAll 
     * @summary bulk add or update documents in single request
     *
     * @param   {Array|Map} docs            documents to add or update
     * @param   {Boolean}   ignoreIfExists  (optional) if `true`, will prevent overriding existing documents.
     *                                      Default: `false`
     * @param   {Number}    timeout         bulk save operation timeout duration in milliseconds
     *
     * @returns {*}
     */
    async setAll(docs, ignoreIfExists = false, timeout, updateTS = true) {
        if (isMap(docs)) {
            // convert Map to Array
            docs = Array.from(docs).map(([_id, item]) => ({ ...item, _id }))
        }
        if (!docs.length) return

        const db = await this.getDB()
        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i]
            if (!doc._id || doc._rev) continue

            const existingDoc = await this.get(doc._id, [])
            if (!existingDoc) continue
            if (ignoreIfExists) {
                docs[i] = null
                continue
            }
            // attach `_rev` to prevent conflicts when updating existing items
            doc._rev = existingDoc._rev
            updateTS && setTs(doc, existingDoc)
        }
        const promise = db.bulk({ docs: docs.filter(Boolean) })
        return await (
            isValidNumber(timeout)
                ? PromisE.timeout(promise, timeout)
                : promise
        )
    }

    /**
     * @name    view
     * @summary query a specific CouchDB "view"
     * 
     * @param   {String} designName 
     * @param   {String} viewName 
     * @param   {Object} params     (optional)
     * 
     * @returns {Array}
     */
    async view(designName, viewName, params) {
        const db = await this.getDB()
        const { rows = [] } = await db.view(
            designName,
            viewName,
            {
                include_docs: true,
                ...params,

            },
        )

        return rows.map(x => x.doc)
    }
}