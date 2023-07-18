import {
    useEffect,
    useMemo,
    useState,
} from 'react'
import { BehaviorSubject, SubjectLike } from 'rxjs'
import PromisE from '../../PromisE'
import { copyRxSubject } from '../../rx.js'
import {
    deferred,
    isFn,
    isObj,
    isPositiveInteger,
    isSubjectLike,
} from '../../utils'
import { useUnmount } from './useMount'

// returning this symbol in the valueModifier will skip the state update
export const IGNORE_UPDATE_SYMBOL = Symbol('ignore-rx-subject-update')

/**
 * @name    useRxSubject
 * @summary custom React hook for use with RxJS subject and auto update when value changes
 *
 * @param   {SubjectLike} subject             (optional) RxJS subject to observe, collect & update value from.
 *                                            If a not "subject like", will created an instance of BehaviorSubject
 * @param   {Function}    valueModifier       (optional) callback to modify the value received on subject change.
 *                                            Args:
 *                                            - newValue
 *                                            - oldValue
 *                                            - rxSubject
 *                                            - unsubscribe: unsubscribe from all future updates
 *                                            If function returns a promise, it will be awaited.
 *                                            Whatever result is returned from this function/promise will be returned
 *                                            as the value of this hook, with the exception of the following:
 *                                            - `IGNORE_UPDATE_SYMBOL`: skip the current update.
 * @param   {*}           initialValue        (optional) initial value if `subject.value` is undefined
 * @param   {Boolean}     allowMerge          (optional) whether to merge previous value with new value.
 *                                            Only applicable if value is an object
 *                                            Default: true (if first value is an object)
 * @param   {Boolean}     allowSubjectUpdate  (optional) whether to allow update of the subject or only state.
 *                                            CAUTION: if true and `@subject` is sourced from a DataStorage
 *                                            instance, it may override values in the LocalStorage values.
 *                                            Default: `false`
 * @param   {Number}      defer               (optional)
 *                                            Default: `100`
 *
 * @returns {[
 * *,
 * Function,
 * SubjectLike,
 * Fuction
 * ]}   [value, setvalue, subject, setValueDeferred]
 */
export const useRxSubject = (
    subject,
    valueModifier,
    initialValue,
    allowMerge,
    allowSubjectUpdate,
    defer = 100,
    onUnmount,
) => {
    const [
        _subject,
        firstValue,
        isBSub,
        setValue,
        setValueDeferred,
        shouldSubscribe
    ] = useMemo(() => {
        const isSub = isSubjectLike(subject)
        const _subject = isSub
            ? allowSubjectUpdate
                ? subject
                : copyRxSubject(subject)
            : new BehaviorSubject(
                initialValue !== undefined
                    ? initialValue
                    : subject
            )
        const setState = newValue => _subject.next(newValue)
        let setState2 = setState
        if (isPositiveInteger(defer)) {
            setState2 = deferred(setState, defer)
            setState2.defer = defer
        }

        const isBSub = _subject instanceof BehaviorSubject
        let value = _subject.value
        value ??= initialValue
        let shouldSubscribe = true
        value = !isFn(valueModifier)
            ? value
            : valueModifier(
                value,
                undefined,
                _subject,
                () => shouldSubscribe = false
            )
        if (IGNORE_UPDATE_SYMBOL === value) value = undefined
        allowMerge ??= isObj(value)
        return [
            _subject,
            value,
            isBSub,
            setState,
            setState2,
            shouldSubscribe,
        ]
    }, [subject])

    let [value, _setValue] = useState(firstValue)

    useEffect(() => {
        let mounted = true
        let ignoreFirst = !isBSub
        const unsubscribe = deferred(() => subscription?.unsubscribe?.(), 1)
        const handleChange = newValue => {
            if (!mounted) return
            if (!ignoreFirst) {
                // BehaviorSubject subscription triggers a result immediately with the pre-existing value.
                // Ignoring first result reduces one extra state update.
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
                        unsubscribe
                    )
            )
            promise.then(newValue => {
                if (newValue === IGNORE_UPDATE_SYMBOL) return
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
                mounted && _setValue(value)
            })
            promise.catch(err =>
                console.log('useRxSubject => unexpected error:', err)
            )
        }
        const subscription = shouldSubscribe && _subject.subscribe(handleChange)

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [_subject])

    isFn(onUnmount) && useUnmount(() => onUnmount(subject))

    return [
        value,
        setValue,
        _subject,
        setValueDeferred
    ]
}
export default useRxSubject