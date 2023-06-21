import {
    useEffect,
    useMemo,
    useState,
} from 'react'
import { BehaviorSubject, Subject } from 'rxjs'
import PromisE from '../../PromisE'
import {
    deferred,
    isFn,
    isObj,
    isSubjectLike,
} from '../../utils'
import { copyRxSubject } from '../../rx.js'

/**
 * @name    useRxSubject
 * @summary custom React hook for use with RxJS subject and auto update when value changes
 *
 * @param   {BehaviorSubject}   subject             (optional) RxJS subject to observe, collect & update value from.
 *                                                  If a not "subject like", will created an instance of BehaviorSubject
 * @param   {Function}          valueModifier       (optional) callback to modify value received on change.
 *                                                  Async function is accepted.
 *                                                  Args: `[newValue, oldValue, rxSubject]`
 * @param   {*}                 initialValue        (optional) initial value where appropriate
 * @param   {Boolean}           allowMerge          (optional) only applicable if value is an object
 * @param   {Boolean}           allowSubjectUpdate  (optional) whether to allow update of the subject or only state.
 *                                                  CAUTION: if true and `@subject` is sourced from a DataStorage
 *                                                  instance, it may override values in the LocalStorage values.
 *                                                  Default: `false`
 *
 * @returns {Array}     [value, setvalue, subject]
 */
export const useRxSubject = (
    subject,
    valueModifier,
    initialValue,
    allowMerge = false,
    allowSubjectUpdate = false,
    defer = 100
) => {
    const _subject = useMemo(
        () => isSubjectLike(subject)
            ? allowSubjectUpdate
                ? subject
                : copyRxSubject(subject)
            : new BehaviorSubject(
                initialValue !== undefined
                    ? initialValue
                    : subject
            ),
        [subject],
    )
    const [setValue, setValueDeferred] = useMemo(() => {
        const setState = newValue => _subject.next(newValue)

        return [
            setState,
            defer > 0
                ? deferred(setState, defer)
                : undefined
        ]
    }, [])

    let [
        {
            firstValue,
            isBSub,
            value,
        },
        _setState
    ] = useState(() => {
        const isBSub = _subject instanceof BehaviorSubject
        let value = isBSub
            ? _subject.value
            : initialValue
        value = !isFn(valueModifier)
            ? value
            : valueModifier(
                value,
                undefined,
                _subject,
            )
        if (value === useRxSubject.IGNORE_UPDATE) {
            value = undefined
        }

        return {
            firstValue: value,
            isBSub,
            value,
        }
    })

    useEffect(() => {
        let mounted = true
        let ignoreFirst = !isBSub
        const subscribed = _subject.subscribe(newValue => {
            if (!ignoreFirst) {
                ignoreFirst = true
                if (firstValue === newValue) return
            }

            const promise = PromisE(
                !isFn(valueModifier)
                    ? newValue
                    : valueModifier(
                        newValue,
                        value,
                        _subject,
                    )
            )
            promise.then(newValue => {
                if (newValue === useRxSubject.IGNORE_UPDATE) return
                value = allowMerge
                    ? {
                        ...isObj(value) && value,
                        ...newValue,
                    }
                    : newValue

                if (allowMerge && isBSub && isObj(_subject.value)) Object
                    .keys(value)
                    .forEach(key => {
                        try {
                            _subject.value[key] = value[key]
                        } catch (err) {
                            console.warn('useRxSubject:', err)
                        }
                    })
                mounted && _setState({
                    firstValue,
                    isBSub,
                    value,
                })
            })
            promise.catch(err => console.log('useRxSubject => unexpected error:', err))
        })
        return () => {
            mounted = false
            subscribed.unsubscribe()
        }
    }, [])

    return [
        value,
        setValue,
        _subject,
        setValueDeferred
    ]
}
// To prevent an update return this in valueModifier
useRxSubject.IGNORE_UPDATE = Symbol('ignore-rx-subject-update')

export default useRxSubject