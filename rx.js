import {
    BehaviorSubject,
    Subscribable,
    Subject,
    Unsubscribable,
} from 'rxjs'
import PromisE from './PromisE'
import {
    deferred,
    hasValue,
    isArr,
    isFn,
    isSubjectLike,
    isValidNumber
} from './utils'

/**
 * @name    copyRxSubject
 * @summary creates a new subject that automatically copies the value of the source subject.
 *
 * @description The the changes are applied unidirectionally from the source subject to the destination subject.
 * Changes on the destination subject is NOT applied back into the source subject.
 *
 * @param   {Subscribable|Array}  rxSource  RxJS source subject(s). If Array, value of rxCopy will also be Array.
 * @param   {Subscribable}        rxCopy    (optional) RxJS copy/destination subject
 *                                          Default: `new BehaviorSubject()`
 *
 * @returns {Subscribable}        rxCopy
 */
export const copyRxSubject = (
    rxSource,
    rxCopy,
    valueModifier,
    defer,
) => {
    const sourceIsArr = isArr(rxSource)
    const gotSource = !sourceIsArr
        ? isSubjectLike(rxSource)
        : rxSource.every(isSubjectLike)
    const gotModifier = isFn(valueModifier)

    if (!isSubjectLike(rxCopy)) {
        let initialValue = !sourceIsArr
            ? rxSource?.value
            : rxSource.map(x => x.value)
        rxCopy = new BehaviorSubject()
        if (gotModifier) initialValue = valueModifier(
            initialValue,
            undefined,
            rxCopy
        )
        rxCopy.next(initialValue)
    }
    if (!gotSource) return rxCopy

    const subscribeOrg = rxCopy.subscribe.bind(rxCopy)
    rxCopy.subscribe = (...args) => {
        let unsubscribed = false
        let setValue = value => !unsubscribed && rxCopy.next(
            gotModifier
                ? valueModifier(
                    value,
                    rxCopy.value,
                    rxCopy
                )
                : value
        )
        if (defer > 0) setValue = deferred(setValue, defer)

        const values = []
        const subs = !sourceIsArr
            ? rxSource.subscribe(value => setValue(value))
            : rxSource.map((x, i) =>
                x.subscribe(value => {
                    values[i] = value
                    setValue(values)
                })
            )
        const sub = subscribeOrg(...args)
        const unsubscribeOrg = sub.unsubscribe
        sub.unsubscribe = (...args) => {
            if (unsubscribed) return

            unsubscribed = true
            unsubscribeOrg.call(sub, ...args)
            unsubscribe(subs)
        }
        return sub
    }
    return rxCopy
}

export const getRxInterval = (
    initialValue = 0,
    delay = 1000,
    autoStart = true,
    incrementBy = 1
) => {
    let intervalId
    let rxInterval = {}
    rxInterval = new BehaviorSubject(parseInt(initialValue) || 0)
    rxInterval.autoStart = autoStart
    rxInterval.delay = delay
    rxInterval.incrementBy = incrementBy
    rxInterval.pause = () => clearInterval(intervalId)
    rxInterval.start = () => {
        intervalId = setInterval(
            () => rxInterval.next(
                rxInterval.value + rxInterval.incrementBy
            ),
            delay,
        )
    }
    rxInterval.stop = () => {
        rxInterval.pause()
        rxInterval.next(0)
    }
    autoStart && rxInterval.start()
    return rxInterval
}

/**
 * @name    subjectAsPromise
 * @summary sugar for RxJS subject as promise and, optionally, wait until an expected value is received
 * 
 * @param   {Subject}           subject         RxJS subject or similar subscribable
 * @param   {*|Function}        expectedValue   (optional) if undefined, will resolve as soon as any value is received.
 *                      If function, it should return true or false to indicate whether the value should be resolved.
 * @param   {Number|Function}   timeout         (optional) will reject if no value received within given time
 * 
 * @returns {[Promise, Function]}   will reject with: 
 *                                  - `null` if times out
 *                                  - `undefined` if @subject is not a valid RxJS subject like subscribable
 */
export const subjectAsPromise = (subject, expectedValue, timeout) => {
    if (!isSubjectLike(subject)) return

    let subscription, timeoutId, unsubscribed
    const unsubscribe = () => setTimeout(() => {
        !unsubscribed && subscription.unsubscribe()
        unsubscribed = true
        clearTimeout(timeoutId)
    }, 50)
    const promise = new PromisE((resolve, reject) => {
        subscription = subject.subscribe(value => {
            const shouldResolve = isFn(expectedValue) && expectedValue(value)
                // no expected value set. resolve with first value received
                || expectedValue === undefined
                // exact match
                || value === expectedValue
                // resolve only when `subject` is NOT empty, null, NaN etc. Check `hasValue` for details.
                || (expectedValue === subjectAsPromise.anyValueSymbol && hasValue(value))
            if (!shouldResolve) return

            unsubscribe()
            resolve(value)
        })
        timeoutId = isValidNumber(timeout) && setTimeout(() => {
            unsubscribe()
            reject('Timed out before an expected value is received.')
        }, timeout)

    })
    return [promise, unsubscribe]
}
subjectAsPromise.anyValueSymbol = Symbol('any-value')

/**
 * @name    unsubscribe
 * @summary unsubscribe to multiple RxJS subscriptions
 * @param   {Function|Unsubscribable|Array} unsub
 */
export const unsubscribe = (unsub = {}) => {
    // single function supplied
    if (isFn(unsub)) return unsub()

    // single
    if (unsub && isFn(unsub.unsubscribe)) return unsub.unsubscribe()

    // multi
    Object
        .values(unsub)
        .forEach(x => {
            try {
                if (!x) return
                const fn = isFn(x)
                    ? x
                    : isFn(x.unsubscribe)
                        ? x.unsubscribe
                        : null
                fn && fn()
            } catch (e) { } // ignore
        })
}