import { isAsyncFn, isPromise, isFn } from "./utils"
import { isValidElement } from "react"

// PromisE attempts to solve a simple problem of Promise status (resolved/rejected) not being accessible externally.
// Also compatible with async functions
//
// Params:
// @promise     Promise/function
//
// Examples:
// 1. Use exacly the same as Promise to create a new Promise
//      const dummyPromise = new PromisE((resolve, reject) => resolve())
// 2. Use an uninvoked async function
//      PromisE(async () => await anotherPromise())
//      new PromisE(async function() { return [...arguments].reverse() }, 1, 2, 3, 4, 5, 6).then(console.log)
// 3. Extend an existing Proimse instance
//      PromisE(promiseInstance)
//
// Returns      Promise (with 3 accessible boolean properties: pending, rejected, resolved)
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

// PromisE.all is a wrapper for Promise.all with the benefits of PromisE
PromisE.all = function () {
    return PromisE(Promise.all(arguments))
}
// PromisE.timeout times out a promise after specified timeout duration.
//
// Params:
// @...promise  promise/function: one or more promises as individual arguments
// @timeout     integer: <last argument> timeout duration in milliseconds. If not supplied will fail immediately.
//                  Example 1: multiple promises
//                      ```
//                      PromisE.timeout(
//                          Promise.resolve(1), 
//                          30000,
//                        )
//                      ```
//                      Result: 1
//
//                  Example 2: multiple promises
//                      ```
//                      PromisE.timeout(
//                          Promise.resolve(1), 
//                          Promise.resolve(2), 
//                          Promise.resolve(3), 
//                          30000, 
//                      )
//                      ```
//                      Result: [ 1, 2, 3 ]
//
// Returns      PromisE
PromisE.timeout = function () {
    const args = [...arguments]
    const timeout = args.slice(-1) || 0
    // use all arguments except last one
    const promiseArgs = args.slice(0, args.length - 1)
    const promise = promiseArgs.length === 1 ? PromisE(promiseArgs[0]) : PromisE.all.apply(null, [...promiseArgs])
    const timeoutPromise = new PromisE((_, reject) =>
        // only reject if it's still pending
        setTimeout(() => promise.pending && reject('Timed out'), timeout)
    )
    const resultPromise = PromisE(Promise.race([promise, timeoutPromise]))
    // attach the timoutPromise so that it can be used to determined whether the error was 
    // due to timeout or request failure by checking `timtoutPromise.rejected === true`
    resultPromise.timeout = timeoutPromise
    return resultPromise
}

// PromisE.deferred is the adaptation of the `deferred()` function tailored for Promises.
// The main difference is that PromisE.deferred is to be used with promises and there is no specific time delay.
// The last/only promise in an on-going promise pool will be handled.
// The time when a supplied promise is resolved is irrelevant. 
// Once a promise is handled all previous ones will be ignored and new ones will be added to the pool.
//
// Params: 	No parameter accepted
// Returns function: callback accepts only one argument and it must be a promise
/*  Explanation & example usage:
	const df = PromisE.deferred()
	const delayer = delay => new Promise(r => setTimeout(() => r(delay),  delay))
	df(delayer(5000)).then(console.log)
	df(delayer(500)).then(console.log)
	df(delayer(1000)).then(console.log)

	setTimeout(() => df(delayer(200)).then(console.log), 2000)
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
    return promise => new Promise((resolve, reject) => {
        const id = Symbol()
        ids.push(id)
        try {
            promise.then(done(resolve, id), done(reject, id))
        } catch (err) {
            reject(err)
        }
    })
}