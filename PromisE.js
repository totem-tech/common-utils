import { isAsyncFn, isPromise, isFn, isObj, isInteger, isValidNumber, isPositiveInteger, isArr } from "./utils"
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
 * @param   {*}      result (optional) specify a value to resolve with.
 *                          Default: the value of delay
 * 
 * @returns {PromisE}
 */
PromisE.delay = (delay, result = delay) => new PromisE(resolve =>
    setTimeout(() => resolve(result), delay)
)

/**
 * @name    PromisE.emitAsPromise
 * @summary a wrapper function for socket.io emitter to eliminate the need to use callbacks. 
 * 
 * @param   {Object} socket         'socket.io-client' client instance.
 * @param   {Number} timeoutGlobal  (optional) default timeout for all events emitted using the returned callback
 * @param   {Number} errorArgIndex  (optional) index of the callback argument that contains server error message.
 *                                  Use non-integer value to indicate that error message will not be provided
 *                                  as a direct argument by server. Eg: error message is a property of an object. 
 *                                  In that case, error should be thrown manually inside the `resultModifier` function.
 *                                  Default: `0` (this assumes that emitted message will resolve)
 *  
 * @param   {Number} callbackIndex  (optional) index of the emitter parameter that is expected to be a callback
 *                                  Default: `null` (callback will be place at the end of `args` array)
 * 
 * @returns {Function}  callback function when invoked returns a promise
 *                      Callback Arguments:
 *                      - evenName       String: 
 *                      - args           Array:
 *                      - resultModifier Function:
 *                      - onError        Function
 *                      - timemoutLocal  Number:  overrides `timeoutGlobal`
 * 
 * @example Example 1: A simple message sent to the socket server with 15 seconds timeout
 * ```javascript
 * const socket = require('socket.io-client')(....)
 * const emitter = PromisE.getSocketEmitter(socket, 15000, 0)
 * const result = await emitter('message', ['Hello world'])
 * ```
 * 
 * @example Example 2: Handle time out
 * ```javascript
 * const resultPromise = emitter('message', ['Hello world'])
 * resultPromise.catch(err => {
 *     if (resultPromise.timeout) alert('Request is taking longer than expected')
 *      resultPromise
 *          .promise
 *          .then(result => alert('Finally, got the result!'))
 * })
 * ```
 */
PromisE.getSocketEmitter = (socket, timeoutGlobal, errorArgIndex = 0, callbackIndex = null) => {
    return (eventName, args = [], resultModifier, errorModifier, timeoutLocal) => {
        args = !isArr(args)
            ? [args]
            : args
        const timeout = isPositiveInteger(timeoutLocal)
            ? timeoutLocal
            : timeoutGlobal
        const getError = err => isFn(errorModifier)
            && errorModifier(err)
            || err
        const promise = new Promise((resolve, reject) => {
            try {
                const interceptor = async (...result) => {
                    try {
                        let err = isInteger(errorArgIndex) && result.splice(errorArgIndex, 1)[0]
                        if (!!err) return reject(getError(err))

                        result = result.length > 1
                            ? result // if multiple values returned from the backend resolve with an array
                            : result[0] // otherwise resolve with single value

                        if (isFn(resultModifier)) result = await resultModifier(result)
                    } catch (err) {
                        console.log({ interceptorError: err })
                    }
                    resolve(result)
                }
                if (callbackIndex === null) {
                    // last item is the callback 
                    args = [...args, interceptor]
                } else if (isFn(args[callbackIndex])) {
                    // replace exising callback
                    args[callbackIndex] = interceptor
                } else {
                    // inject the callback at specific index
                    args.splice(callbackIndex, 0, interceptor)
                }
                socket.emit(eventName, ...args)
            } catch (err) {
                reject(getError(err))
            }
        })
        if (!isPositiveInteger(timeout)) return promise
        return PromisE.timeout(timeout, promise)
    }
}

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
        if (err.name === 'AbortError') throw new Error('Request timed out')
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
PromisE.race = (...promises) => PromisE(Promise.race(promises.flat()))

/**
 * @name    PromisE.timeout
 * @summary times out a promise after specified timeout duration.
 * 
 * @param {Number}      timeout  (optional) timeout duration in milliseconds. 
 *                               Default: `10000`
 * @param {...Promise}  promise  promise/function: one or more promises as individual arguments
 * 
 * @example Example 1: multiple promises
 * ```javascript
 *    PromisE.timeout(30000, Promise.resolve(1))
 *    // Result: 1
 * ```
 *
 * @example Example 2: multiple promises
 *
 * ```javascript
 *    PromisE.timeout(30000, Promise.resolve(1), Promise.resolve(2), Promise.resolve(3))
 *    // Result: [ 1, 2, 3 ]
 * ```
 * 
 * @example Example 3: timeout
 * ```javascript
 *  PromisE.timeout(PromisE.delay(20000))
 *
 * @returns {PromisE} resultPromise
 */
PromisE.timeout = (...args) => {
    const timeoutIndex = args.findIndex(isValidNumber)
    const timeout = timeoutIndex >= 0
        && args.splice(timeoutIndex, 1)
        || 10000
    // use all arguments except last one
    const promiseArgs = args
    const promise = promiseArgs.length === 1
        ? PromisE(promiseArgs[0]) // makes sure single promise resolves to a single result
        : PromisE.all(promiseArgs)
    const timeoutPromise = new PromisE((_, reject) =>
        // only reject if it's still pending
        setTimeout(() => {
            if (!promise.pending) return
            resultPromise.timeout = true
            reject('Timed out')
        }, timeout)
    )
    const resultPromise = PromisE.race([promise, timeoutPromise])
    // attach the timoutPromise so that it can be used to determined whether the error was 
    // due to timeout or request failure by checking `timeoutPromise.rejected === true`
    resultPromise.timeout = timeoutPromise
    resultPromise.promise = promise
    return resultPromise
}

const getAbortSignal = timeout => {
    let abortCtrl
    try {
        abortCtrl = new AbortController()
    } catch (err) {
        abortCtrl = new require('abort-controller')
    }
    setTimeout(() => abortCtrl.abort(), timeout)
    return abortCtrl.signal
}
const fetcher = async (url, options) => {
    let _fetch
    try {
        _fetch = fetch
    } catch (_) {
        // required if nodejs
        _fetch = require('node-fetch')
    }
    _fetch.Promise = PromisE

    return _fetch(url, options)
}