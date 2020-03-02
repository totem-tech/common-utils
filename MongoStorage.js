import { isDefined, isObj } from './utils'

import { MongoClient, ObjectId } from 'mongodb'

let client, connectPromise

export const getConnection = url => {
    connectPromise = new Promise((resolve, reject) => {
        if (client) return resolve(client)
        // Use connect method to connect to the server
        const mongoClient = new MongoClient(url, {
            // tls: true, // requires ssl certificate
            // reconnectTries: 30,
            // reconnectInterval: 1000,
            // tlsCertificateKeyFile: 
            // tlsCAFile
            // tlsCertificateKeyFilePassword
            //autoReconnect
            // noDelay: true,
            useUnifiedTopology: true,
        })
        console.log('MongoDB: connecting to', url)
        mongoClient.connect((err, client) => {
            connectPromise = null
            if (err) {
                console.log('MongoDB: connection failed. Error: ' + err)
                return reject(err)
            }
            console.log('MongoDB: connected')
            resolve(client)
            // console.log(!err ? 'MongoDB: connected' : 'MongoDB: connection failed. Error: ' + err)
            // err ? reject(err) : resolve(client)
        })
    })
    return connectPromise
}

export class MongoStorage {
    constructor(dbName, collectionName, client) {
        this.db = client.db(dbName)
        this.collection = !client ? null : this.db.collection(collectionName)
        this.collectionName = collectionName

        this.collection.createIndex({ "$**": "text" })
    }

    delete(idOrQuery) {
        return new Promise((resolve, reject) => this.collection.deleteOne(
            isObj(idOrQuery) ? idOrQuery : { _id: ObjectId(idOrQuery) },
            (err, result) => err ? reject(err) : resolve(result)
        ))
    }

    find() { }

    get(_id) {
        return new Promise((resolve, reject) => this.collection
            .find({ _id: `${_id}` })
            .limit(1)
            .toArray((err, result) => err || !isDefined(result[0]) ? reject(err) : resolve(result[0])))
    }

    getAll() {
        return new Promise((resolve, reject) => this.collection.find({})
            .toArray((err, result) => {
                if (err) return reject(err)
                resolve(new Map(result.map(obj => [obj._id, obj])))
            })
        )
    }

    search(query, limit) {
        return new Promise((resolve, reject) => {
            this.collection
                .find(query)
                .project({ score: { $meta: "textScore" } })
                .sort({ score: { $meta: "textScore" } })
                .limit(limit || 0)
                .toArray((err, resultArr) => {
                    if (err) return reject(err)
                    // convert result array to Map
                    resolve(new Map(resultArr.map(obj => [obj._id, obj])))
                })

        })
    }

    set(_id, value = {}) {
        return new Promise((resolve, reject) =>
            this.collection.updateOne(
                { _id }, // create or replace by id
                { $set: { ...value, _id } },
                { upsert: true }, // insert if no document with id exists
                (err, result) => err ? reject(err) : resolve(result)
            ))
    }

    setAll() { }

}

export const getInstance = (dbName, collectionName, url) => new Promise((resolve, reject) => {
    if (!collectionName || !dbName) return reject('Both collection and database name required')
    const resolver = client => resolve(new MongoStorage(dbName, collectionName, client))

    // a connection is already in progress => wait for it 
    if (connectPromise) return connectPromise.then(resolver, reject)
    // a connection already exists
    if (client) return resolver()
    // both url and db name is required
    if (!url) return reject('MongoDB URL required')
    getConnection(url).then(resolver, reject)
})
export default getInstance

/* // example usage
getInstance('testdb', 'testCollection', 'mongodb://localhost:27017')
    .then(testCollection => {
        // Start listening
        server.listen(PORT, () => console.log(`Totem Messaging Service started. Websocket listening on port ${PORT} (https)`))
        // testCollection.set(1, { desc: 'this is one', title: 'one' }).then(() => console.log('success'), err => console.log({ err }))
        // testCollection.set(2, { desc: 'this is two', title: 'two' }).then(() => console.log('success'), err => console.log({ err }))
        // testCollection.set(4, { desc: 'four is here', title: 'four' }).then(() => console.log('success'), err => console.log({ err }))
        // testCollection.set(3, { desc: 'this is three', title: 'three' }).then(() => console.log('success'), err => c         onsole.log({ err }))
        // testCollection.set(5, { a: '9945', b: '1001 test', desc: 'five is here', title: 'four' }).then(() => console.log('success'), err => console.log({ err }))
        // testCollection.set(6, { a: '1001', b: '9945 test', desc: 'six is here', title: 'six' }).then(() => console.log('success'), err => console.log({ err }))

        // testCollection.delete({ title: 'this is one' }).then(result => {}, err => console.log({ err }))
        testCollection.search({
            // desc: 'this is one',
            $text: { $search: 'five' }, // full-text search on all keys
            // title: 'five is here', // full-text search on specific key
        })
            .then(result => console.log('Search result\n', { result }), console.log)
        // testCollection.getAll().then(result => console.log({ result }), err => console.log({ err }))
    }, console.log)
*/