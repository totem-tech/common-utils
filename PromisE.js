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
    try {
        if (!(promise instanceof Promise)) {
            const args = [...arguments]
            // supplied is not a promise instance
            // check if it is an uninvoked async function
            const isAsyncFn = promise instanceof (async () => { }).constructor
            promise = isAsyncFn ? promise.apply(null, args.slice(1)) : new Promise(promise)
        }
        promise.resolved = false
        promise.rejected = false
        promise.pending = true
        promise.then(() => {
            promise.resolved = true
            promise.pending = false
        }, () => {
            promise.rejected = true
            promise.pending = false
        })
    } catch (err) {
        promise = Promise.reject(err)
    }
    return promise
}
PromisE.all = function () {
    return PromisE(Promise.all(arguments))
}