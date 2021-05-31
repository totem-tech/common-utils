import { isAsyncFn, isPromise, isFn, isObj, isInteger } from "./utils"
/*
 * List of optional node-modules and the functions used by them:
 * Module Name          : Function Name
 * ------------------------------------
 * abort-controller: PromisE.fetch
 * node-fetch      : PromisE.fetch
*/

/** 
 * @name PromisE
 * @summary attempts to solve a simple problem of Promise status (resolved/rejected) not being accessible externally.
 * Also compatible with async functions
 *
 * @param {Promise|Function|*}  promise AsyncFunction is not supported in NodeJS with Webpack!
 *
 * @example Examples:
 * <BR>
 * 
 * ```javascript
 * // 1. Use exacly the same as Promise to create a new Promise
 *    const dummyPromise = new PromisE((resolve, reject) => resolve())
 * // 2. Use an uninvoked async function
 *    PromisE(async () => await anotherPromise())
 *    new PromisE(async function() { return [...arguments].reverse() }, 1, 2, 3, 4, 5, 6).then(console.log)
 * // 3. Extend an existing Proimse instance
 *    PromisE(promiseInstance)
 * ```
 *
 * @returns {PromisE} with 3 accessible boolean properties: pending, rejected, resolved
 */
export default function PromisE(promise) {
    if (!(promise instanceof Promise)) {
        try {
            const args = [...arguments]
            // supplied is not a promise instance
            // check if it is an uninvoked async function
            promise = isPromise(promise) ? promise : (
                isAsyncFn(promise) ? promise.apply(null, args.slice(1)) : (
                    isFn(promise) ? new Promise(promise) : Promise.resolve(promise)
                )
            )
        } catch (err) {
            // something unexpected happened!
            promise = Promise.reject(err)
        }
    }

    promise.resolved = false
    promise.rejected = false
    promise.pending = true
    promise.then(
        () => promise.resolved = true,
        () => promise.rejected = true
    ).finally(() => promise.pending = false)
    return promise
}

/** 
 * @name    PromisE.all
 * @summary a wrapper for Promise.all with the benefits of `PromisE`
 * 
 * @param   {Array|...Promise} promises
 * 
 * @returns {PromisE} 
 */
PromisE.all = (...promises) => PromisE(Promise.all(promises.flat()))

/** 
 * @name PromisE.deferred
 * @summary the adaptation of the `deferred()` function tailored for Promises.
 * @description The main difference is that PromisE.deferred is to be used with promises 
 * and there is no specific time delay. The last/only promise in an on-going promise pool will be handled.
 * The time when a supplied promise is resolved is irrelevant. 
 * Once a promise is handled all previous ones will be ignored and new ones will be added to the pool.
 *
 * Params: 	No parameter accepted
 * 
 * @example Explanation & example usage:
 * <BR>
 * ```javascript
 *    const df = PromisE.deferred()
 *    const delayer = delay => new Promise(r => setTimeout(() => r(delay),  delay))
 *    df(delayer(5000)).then(console.log)
 *    df(delayer(500)).then(console.log)
 *    df(delayer(1000)).then(console.log)
 *    setTimeout(() => df(delayer(200)).then(console.log), 2000)
 * ```
 * 
 * @returns {Function} callback accepts only one argument and it must be a promise
*/
PromisE.deferred = () => {
    let ids = []
    const done = (cb, id) => function () {
        const index = ids.indexOf(id)
        // Ignore if:
        // 1. this is not the only/last promise
        // 2. if a successor promise has already resolved/rejected
        if (index === -1 || index !== ids.length - 1) return
        // invalidates all unfinished previous promises
        ids = []
        cb.apply(null, arguments)
    }
    return promise => new PromisE((resolve, reject) => {
        const id = Symbol()
        ids.push(id)
        try {
            promise.then(done(resolve, id), done(reject, id))
        } catch (err) {
            reject(err)
        }
    })
}

/**
 * @name    PromisE.delay
 * @summary simply a setTimeout as a promise
 * 
 * @param   {Number} delay
 * 
 * @returns {PromisE}
 */
PromisE.delay = delay => PromisE(resolve => setTimeout(resolve, delay))

// if timed out err.name will be 'AbortError''
PromisE.fetch = async (url, options, timeout, asJson = true) => {
    try {
        options = isObj(options) ? options : {}
        options.method = options.method || 'get'
        if (isInteger(timeout)) options.signal = getAbortSignal(timeout)

        const result = await fetcher(url, options)
        return asJson
            ? await result.json()
            : result
    } catch (err) {
        if (err.name === 'AbortError') throw 'Request timed out'
        throw err
    }
}

/** 
 * @name    PromisE.race
 * @summary a wrapper for Promise.race with the benefits of `PromisE`
 * 
 * @param   {...Promise} promises
 * 
 * @returns {PromisE}
 */
PromisE.race = (...promises) => PromisE(Promise.race(promises))

/**
 * @name    PromisE.timeout
 * @summary times out a promise after specified timeout duration.
 *
 * Params:
 * @param {...Promise}  promise  promise/function: one or more promises as individual arguments
 * @param {Number}      timeout  timeout duration in milliseconds. If not supplied will fail immediately.
 *                               If falsy, will use `10000`   
 * 
 * @example Example 1: multiple promises
 * <BR>
 *
 * ```javascript
 *    PromisE.timeout( Promise.resolve(1), 30000)
 *    // Result: 1
 * ```
 *
 * @example Example 2: multiple promises
 * <BR>
 *
 * ```javascript
 *    PromisE.timeout( Promise.resolve(1), Promise.resolve(2), Promise.resolve(3), 30000)
 *    // Result: [ 1, 2, 3 ]
 * ```
 *
 * @returns {PromisE}
 */
PromisE.timeout = (...args) => {
    const timeout = args.slice(-1) || 10000
    // use all arguments except last one
    const promiseArgs = args.slice(0, -1)
    const promise = promiseArgs.length === 1
        ? PromisE(promiseArgs[0]) // makes sure single promise resolves to a single result
        : PromisE.all(promiseArgs)
    const timeoutPromise = new PromisE((_, reject) =>
        // only reject if it's still pending
        setTimeout(() => promise.pending && reject('Timed out'), timeout)
    )
    const resultPromise = PromisE(Promise.race([promise, timeoutPromise]))
    // attach the timoutPromise so that it can be used to determined whether the error was 
    // due to timeout or request failure by checking `timtoutPromise.rejected === true`
    resultPromise.timeout = timeoutPromise
    resultPromise.promise = promise
    return resultPromise
}

const getAbortSignal = timeout => {
    const AbortController = require('abort-controller')
    const abortCtrl = new AbortController()
    setTimeout(() => abortCtrl.abort(), timeout)
    return abortCtrl.signal
}
const fetcher = async (url, options) => {
    let fetch2
    try {
        fetch2 = fetch
    } catch (_) {
        // required if nodejs
        fetch2 = require('node-fetch')
    }
    fetch2.Promise = PromisE

    return fetch2(url, options)
}