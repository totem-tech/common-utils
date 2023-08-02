import { translated } from './languageHelper'
import {
    deferred,
    isArr,
    isAsyncFn,
    isFn,
    isInteger,
    isObj,
    isPositiveNumber,
    isPromise,
    isValidURL,
} from './utils'

const textsCap = {
    invalidUrl: 'invalid URL',
    timedout: 'request timed out',
}
translated(textsCap)

/*
 * List of optional node-modules and the functions required for NodeJS:
 * Module Name     : Substitue For
 * ------------------------------------
 * abort-controller: AbortController
 * node-fetch      : fetch
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
 * @returns {{
 *  catch: Function,
 *  finally: Function,
 *  pending: Boolean,
 *  rejected: Boolean,
 *  resolved: Boolean,
 *  then: Function,
 * }} result promise
 */
export default function PromisE(promise, ...args) {
    if (!(promise instanceof Promise)) {
        try {
            // supplied is not a promise instance
            // check if it is an uninvoked async function
            promise = isPromise(promise)
                ? promise
                : isAsyncFn(promise) // may or may not work on nodejs with webpack & babel
                    ? promise.apply(null, args) // pass rest of the arguments to the async function (args[0])
                    : isFn(promise)
                        ? new Promise(promise)
                        : Promise.resolve(promise) // anything else resolve as value
        } catch (err) {
            // something unexpected happened!
            promise = Promise.reject(err)
        }
    }

    promise.pending = true
    promise.resolved = false
    promise.rejected = false
    promise
        .then(
            () => promise.resolved = true,
            () => promise.rejected = true
        )
        .finally(() => promise.pending = false)
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
PromisE.all = (...promises) => PromisE(
    Promise.all(
        promises
            .flat()
            .map(p => PromisE(p))
    )
)

/** 
 * @name PromisE.deferred
 * @summary the adaptation of the `deferred()` function tailored for Promises.
 * 
 *
 * @param   {Function}  callback    (optional)
 * @param   {Number}    defer       (optional)
 * @param   {Object}    conf        (optional)
 * @param   {Function}  conf.onError   (optional)
 * @param   {Function}  conf.onResult  (optional)
 * @param   {Boolean}   conf.strict     (optional) only used if `throttle` is truthy.
 *                                      Default: `false`
 * @param   {Boolean}   conf.throttle   (optional) Default: `false`
 * 
 * @description The main difference is that:
 *  - Notes: 
 *      1. A "request" simply means invokation of the returned callback function
 *      2. By "handled" it means a "request" will be resolved or rejected.
 *  - `PromisE.deferred` is to be used with promises/functions
 *  - There is no specific time delay.
 *  - The time when a request is completed is irrelevant. 
 *  - If not throttled:
 *      1. Once a request is handled, all previous requests will be ignored and pool starts anew.
 *      2. If a function is provided in the  returned callback, ALL of them will be invoked, regardless of pool size.
 *      3. The last/only request in an on-going requests' pool will handled (resolve/reject).
 *  - If throttled:
 *      1. Once a requst starts executing, subsequent requests will be added to a queue.
 *      2. The last/only item in the queue will be handled. Rest will be ignored.
 *      3. If a function is provided in the returned callback, it will be invoked only if the requst is handled. 
 *      Thus, improving performance by avoiding unnecessary invokations.
 *      4. If every single request/function needs to be invoked, avoid using throttle.
 * 
 *  - If throttled and `strict` is truthy, all subsequent request while a request is being handled will be ignored.
 * 
 * @example Explanation & example usage:
 * <BR>
 * ```javascript
 * const example = throttle => {
 *     const df = PromisE.deferred(throttle)
 *     df(() => PromisE.delay(5000)).then(console.log)
 *     df(() => PromisE.delay(500)).then(console.log)
 *     df(() => PromisE.delay(1000)).then(console.log)
 *     // delay 2 seconds and invoke df() again
 *     setTimeout(() => {
 *         df(() => PromisE.delay(200)).then(console.log)
 *     }, 2000)
 * }
 * 
 * // Without throttle
 * example(false)
 * // `1000` and `200` will be printed in the console
 * 
 * // with throttle
 * example(true)
 * // `5000` and `2000` will be printed in the console
 * 
 * // with throttle with strict mode
 * example(true)
 * // `5000` will be printed in the console
 * ```
 * 
 * @returns {Function} callback accepts only one argument and it must be a either a promise or a function
*/
PromisE.deferred = (
    callback,
    defer,
    {
        onError = () => { },
        onResult, // result: whatever is returned from the callback on the execution/request that was "handled"
        strict,
        thisArg,
        throttle = !!callback,
    } = {}
) => {
    let lastPromise
    const ids = []
    const queue = []
    const done = (resolver, id) => result => {
        const index = ids.indexOf(id)
        // Ignore if:
        // 1. this is not the only/last promise
        // 2. if a previous promise has already resolved/rejected
        if (index === -1 || index !== ids.length - 1) return
        // invalidates all unfinished previous promises
        resolver(result)
        ids.splice(0)
        lastPromise = null
        const handler = queue
            .splice(0)
            .pop()
        handler && handler()
    }
    const dp = promise => PromisE((resolve, reject) => {
        const handler = () => {
            const id = Symbol()
            try {
                ids.push(id)
                promise = PromisE(
                    isFn(promise)
                        ? promise()
                        : promise
                )
                lastPromise = promise
                promise.then(
                    done(resolve, id),
                    done(reject, id)
                )
            } catch (err) {
                // execution failed while invoking promise()
                done(reject, id)
            }
        }
        if (!throttle || !lastPromise) return handler()

        // simply add subsequent requests to the queue and only execute/resolve the last in the queue
        !strict && queue.push(handler)
    })
    if (!isFn(callback)) return dp

    const cb = (...args) =>
        dp(() => callback.call(thisArg, ...args))
            .then(onResult, onError)

    return isPositiveNumber(defer)
        ? deferred(cb, defer)
        : cb
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
 * @name    PromisE.getSocketEmitter
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
 *                      - args           Array: (optional)
 *                      - resultModifier Function: (optional)
 *                      - onError        Function: (optional)
 *                      - timemoutLocal  Number: (optional)  overrides `timeoutGlobal`
 *                      - delayPromise   Promise: (optional) if supplied, will wait untils promise is finalized
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
 * resultPromise
 * .then(result => alert('Result received on time'))
 * .catch(err => {
 *     if (resultPromise.timeout) alert('Request is taking longer than expected')
 *      resultPromise
 *          .promise
 *          .then(result => alert('Finally, got the result after the timeout!'))
 * })
 * ```
 */
PromisE.getSocketEmitter = (
    socket,
    timeoutGlobal,
    errorArgIndex = 0,
    callbackIndex = null,
) => (
    eventName,
    args = [],
    resultModifier,
    errorModifier,
    timeoutLocal,
    delayPromise
) => {
        args = !isArr(args)
            ? [args]
            : args
        const timeout = isPositiveNumber(timeoutLocal)
            ? timeoutLocal
            : timeoutGlobal
        const getError = err => new Error(
            isFn(errorModifier)
            && errorModifier(err)
            || err
        )
        const promise = new PromisE((resolve, reject) => {
            const interceptor = async (...result) => {
                try {
                    let err = isInteger(errorArgIndex) && result.splice(errorArgIndex, 1)[0]
                    if (!!err) return reject(getError(err))

                    result = result.length > 1
                        ? result // if multiple values returned from the backend resolve with an array
                        : result[0] // otherwise resolve with single value

                    if (isFn(resultModifier)) result = await resultModifier(result)
                } catch (err) {
                    console.log('PromisE.getSocketEmitter', { eventName, interceptorError: err })
                }
                resolve(result)
            }
            try {
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
                // if a promise is supplied wait until it's resolved
                PromisE(delayPromise)
                    .finally(() => socket.emit(eventName, ...args))
            } catch (err) {
                reject(getError(err))
            }
        })

        return !isPositiveNumber(timeout)
            ? promise
            : PromisE.timeout(timeout, promise)
    }

/**
 * @name    PromisE.fetch
 * @summary makes HTTP requests
 * 
 * @param   {String}    url 
 * @param   {Object}    options 
 * @param   {String}    options.method  request method: get, post...
 *                                      Default: `"get"`
 * @param   {Number}    timeout 
 * @param   {Boolean}   asJson 
 * 
 * @returns {*} result
 */
PromisE.fetch = async (url, options, timeout, asJson = true) => {
    if (!isValidURL(url, false)) throw new Error(textsCap.invalidUrl)

    options = isObj(options)
        ? options
        : {}
    options.method = (options.method || 'get').toUpperCase()
    if (options.method === 'POST') {
        // set default content type to JSON
        options.headers = options.headers || {}
        options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json'
        options.headers['content-type'] = 'application/json'
    }
    // options.redirect = 'follow'
    if (isInteger(timeout)) options.signal = getAbortSignal(timeout)

    const result = await fetch(url.toString(), options)
        .catch(err =>
            Promise.reject(
                err.name === 'AbortError'
                    ? new Error(textsCap.timedout)
                    : err
            )
        )
    const { status = 0 } = result || {}
    const isSuccess = status >= 200 && status <= 299
    if (!isSuccess) {
        const json = await result.json() || {}
        const message = json.message || `Request failed with status code ${status}. ${JSON.stringify(json || '')}`
        const error = new Error(`${message}`.replace('Error: ', ''))
        console.log({ options, status, isSuccess, result, json })
        throw error
    }

    return asJson
        ? await result.json()
        : result
}

/**
 * @name    PromisE.post
 * @summary makes HTTP post requests
 * 
 * @param   {String}    url 
 * @param   {Object}    data 
 * @param   {Object}    options 
 * @param   {Number}    timeout 
 * @param   {Boolean}   asJson 
 * 
 * @returns {*} result
 */
PromisE.post = async (
    url,
    data,
    options,
    timeout,
    asJson = true
) => await PromisE.fetch(
    url,
    {
        ...options,
        body: JSON.stringify(data),
        method: 'post',
    },
    timeout,
    asJson
)

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
 *    PromisE.timeout(
 *      30000, // timeout duration
 *      Promise.resolve(1)
 *    )
 *    // Result: 1
 * ```
 *
 * @example Example 2: multiple promises
 *
 * ```javascript
 *    PromisE.timeout(
 *      30000, // timeout duration
 *      Promise.resolve(1),
 *      Promise.resolve(2),
 *      Promise.resolve(3),
 *    )
 *    // Result: [ 1, 2, 3 ]
 * ```
 * 
 * @example Example 3: default timeout duration 10 seconds
 * ```javascript
 *    const promise = PromisE.timeout(PromisE.delay(20000))
 *    promise.catch(err => {
 *          if (promise.timeout) {
 *              // request timed out
 *              alert('Request is taking longer than expected......')
 *              promise.promise.then(result => alert(result))
 *              return
 *          }
 *          alert(err)
 *      })
 *```
 * @returns {PromisE} resultPromise
 */
PromisE.timeout = (...args) => {
    const timeoutIndex = args.findIndex(isPositiveNumber)
    const timeout = timeoutIndex >= 0
        && args.splice(timeoutIndex, 1)
        || 10000
    // use all arguments except last one
    const promiseArgs = args
    const promise = promiseArgs.length === 1
        ? PromisE(promiseArgs[0]) // makes sure single promise resolves to a single result
        : PromisE.all(promiseArgs)
    let timeoutId
    const timeoutPromise = new PromisE((_, reject) =>
        // only reject if it's still pending
        timeoutId = setTimeout(() => {
            if (!promise.pending) return

            resultPromise.timeout = true
            reject(textsCap.timedout)
        }, timeout)
    )
    const resultPromise = PromisE.race([promise, timeoutPromise])
    resultPromise.promise = promise
    resultPromise.timeoutId = timeoutId
    resultPromise.clearTimeout = () => clearTimeout(timeoutId)
    resultPromise.timeoutPromise = timeoutPromise
    return resultPromise
}

const getAbortSignal = timeout => {
    let abortCtrl = new AbortController()
    setTimeout(() => abortCtrl.abort(), timeout)
    return abortCtrl.signal
}