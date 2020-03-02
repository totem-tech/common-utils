import nano from 'nano'
import uuid from 'uuid'
import { isObj, isStr } from './utils'

let connection
// for maintaining a single connection
export const getConnection = url => {
    connection = connection || nano(url)
    return connection
}

export default class CouchDBStorage {
    constructor(connectionOrUrl, dbName) {
        this.dbName = dbName
        this.connection = isStr(connectionOrUrl) ? nano(connectionOrUrl) : connectionOrUrl
        this.dbPromise = this.getDB()
    }

    async getDB() {
        if (this.dbPromise) {
            // if initialization is already in progress wait for it
            await this.dbPromise
        }
        if (this.db) return this.db

        const con = this.connection
        // database already initialized
        if (!isObj(con)) throw new Error('CouchDB: invalid connection')
        if (!this.dbName) throw new Error('CouchDB: missing database name')

        // retrieve a list of all database names
        const dbNames = await con.db.list()
        // database already exists, use it
        if (dbNames.includes(this.dbName)) return con.use(this.dbName)

        // database doesn't exist, create it
        await con.db.create(this.dbName)
        console.log('CouchDB: new database created. Name:', this.dbName, data)
        return con.use(this.dbName)
    }

    async delete() { }


    async find() { }

    async get(id) {
        const db = await this.getDB()
        try {
            return await db.get(id)
        } catch (e) {
            return
        }
    }

    async getAll(ids = []) {
        const db = await this.getDB()
        // if ids supplied only retrieve only those otherwise, retrieve all
        if (ids.length > 0) return await db.fetch({ keys: ids })
        return await db.list()
    }

    async search() { }

    // create or update document
    // 
    // Params: 
    // @id      string: (optional) if exists, will update document
    // @value   object
    async set(id, value) {
        id = isStr(id) ? id : uuid.v1()
        const db = await this.getDB()
        const existing = await db.get(id)
        if (existing) {
            // attach `_rev` to execute an update operation
            value._rev = existing._rev
        }
        return await db.insert(value, id)
    }

    // add or update items in bulk
    async setAll(items) {
        if (items.length === 0) return
        const db = await this.getDB()
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (!item._id) return
            const existing = await this.get(item._id)
            if (existing) {
                // attach `_rev` to prevent conflicts when updateing existing items
                item._rev = existing._rev
            }
        }
        return await db.bulk({ docs: items })
    }
}