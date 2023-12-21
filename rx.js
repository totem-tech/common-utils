import {
    BehaviorSubject,
    Subscribable,
    Subject,
    Unsubscribable,
} from 'rxjs'
import { translated } from './languageHelper'
import PromisE from './PromisE'
import {
    deferred,
    hasValue,
    isArr,
    isFn,
    isPositiveNumber,
    isSubjectLike,
} from './utils'

const textsCap = {
    timedout: 'request timed out before an expected value is received.'
}
translated(textsCap, true)

export const IGNORE_UPDATE_SYMBOL = Symbol('ignore-rx-subject-update')
/**
 * @name    copyRxSubject
 * @summary creates a new subject that automatically copies the value of the source subject.
 *
 * @description The the changes are applied unidirectionally from the source subject to the destination subject.
 * Changes on the destination subject is NOT applied back into the source subject.
 *
 * @param   {Subscribable|Array}  rxSource  RxJS source subject(s). If Array, value of `rxCopy` will also be Array.
 * @param   {Subscribable}        rxCopy    (optional) RxJS copy/destination subject
 *                                          Default: `new BehaviorSubject()`
 * @param   {Function}            valueModifier (optional) callback to modify the value before copying from `rxSource`.
 *                                              Accepts async functions.
 *                                              Args: `newValue, previousValue, rxCopy`
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
    if (sourceIsArr) rxSource = rxSource.map(x => !isSubjectLike(x)
        ? new BehaviorSubject(x)
        : x
    )
    const gotSource = sourceIsArr || isSubjectLike(rxSource)
    const gotModifier = isFn(valueModifier)

    const isValid = value => value !== IGNORE_UPDATE_SYMBOL
    if (!isSubjectLike(rxCopy)) {
        let initialValue = !gotSource
            ? undefined
            : !sourceIsArr
                ? rxSource.value
                : rxSource.map(x => x.value)
        rxCopy = new BehaviorSubject()
        if (gotModifier) initialValue = valueModifier(
            initialValue,
            undefined,
            rxCopy
        )
        isValid(initialValue) && rxCopy.next(initialValue)
    }
    if (!gotSource) return rxCopy

    const subscribeOrg = rxCopy.subscribe.bind(rxCopy)
    rxCopy.subscribe = (...args) => {
        let unsubscribed = false
        let setValue = async value => {
            if (unsubscribed) return

            try {
                value = !gotModifier
                    ? value
                    : await valueModifier(
                        value,
                        rxCopy.value,
                        rxCopy
                    )
                isValid(value) && rxCopy.next(value)
            } catch (_) { } //ignore if valueModifier threw exception
        }
        if (defer > 0) setValue = deferred(setValue, defer)

        const values = []
        const subs = !sourceIsArr
            ? rxSource.subscribe(value => setValue(value))
            : rxSource.map((x, i) =>
                x?.subscribe(value => {
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
export const subjectAsPromise = (
    subject,
    expectedValue,
    timeout,
    modifier
) => {
    if (!isSubjectLike(subject)) return

    if (modifier) console.warn('utils/rx.js => subjectAsPromise: `modifier` deprecated! Use `promise.then()` instead.')

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
        timeoutId = isPositiveNumber(timeout) && setTimeout(() => {
            // prevent rejecting if already unsubscribed
            if (unsubscribed) return

            unsubscribe()
            reject(textsCap.timedout)
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