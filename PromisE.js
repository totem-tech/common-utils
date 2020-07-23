import { isAsyncFn, isPromise, isFn } from "./utils"

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
// @promise     promise/function: any argument that is valid for PromisE()
// @timeout     integer: timeout duration in milliseconds
//
// Returns      PromisE
PromisE.timeout = (promise, timeout = 0) => {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timed out'), timeout))
    return PromisE(Promise.race([PromisE(promise), timeoutPromise]))
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