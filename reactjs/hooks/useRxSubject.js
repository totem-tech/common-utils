import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { BehaviorSubject, SubjectLike } from 'rxjs'
import { copyRxSubject } from '../../rx.js'
import {
    deferred,
    isFn,
    isObj,
    isPositiveInteger,
    isPromise,
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
 *                                            - oldValue (or initial value when first invoked)
 *                                            - rxSubject
 *                                            - unsubscribe: unsubscribe from all future updates
 *                                            If function returns a promise, it will be awaited.
 *                                            If function is `async`, `initialValue` will be the first value returned.
 *                                            Whatever result is returned from this will be returned as the final value.
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
 * ]}   [value, setValue, subject, setValueDeferred]
 */
export const useRxSubject = (
    subject,
    valueModifier,
    initialValue,
    allowMerge,
    allowSubjectUpdate,
    defer = 100,
    onUnmount,
    onError,
    debugTag
) => {
    const _valueModifier = useCallback((
        newValue,
        oldValue,
        subject,
        unsubscribe,
        wait = true
    ) => {
        try {
            if (!allowMerge && !isFn(valueModifier)) return newValue
            newValue = !isFn(valueModifier)
                ? newValue
                : valueModifier(
                    newValue,
                    oldValue,
                    subject,
                    unsubscribe
                )

            const isAPromise = isPromise(newValue)
            if (isAPromise && !wait) return oldValue

            const merge = newValue => {
                if (newValue === IGNORE_UPDATE_SYMBOL) return oldValue
                newValue = allowMerge
                    ? {
                        ...isObj(oldValue) && oldValue,
                        ...isObj(newValue) && newValue,
                    }
                    : newValue
                return newValue
            }
            debugTag && console.log(debugTag, '_valueModifier', { newValue, oldValue, allowMerge })
            return isAPromise
                ? newValue.then(merge)
                : merge(newValue)
        } catch (err) {
            isFn(onError) && onError(err)
            return oldValue
        }
    })
    const [
        _subject,
        setValue,
        setValueDeferred,
        data,
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
        const setValue = newValue => _subject.next(newValue)
        const isBSub = _subject instanceof BehaviorSubject
        let firstValue = _subject.value
        // subject doesn't have an oldValue. Use initial value instead.
        firstValue ??= initialValue
        let shouldSubscribe = true
        firstValue = _valueModifier(
            firstValue,
            initialValue,
            _subject,
            () => shouldSubscribe = false,
            false,
        )
        allowMerge ??= isObj(firstValue)

        debugTag && console.log(debugTag, 'useMemo', { firstValue, allowMerge })
        if (allowMerge) {
            // make sure value of the subject is always merged 
            const nextOrg = _subject.next.bind(_subject)
            _subject.next = newValue => {
                newValue = {
                    ...isObj(_subject.value) && _subject.value,
                    ...isObj(newValue) && newValue,
                }
                nextOrg(newValue)
            }
        }
        return [
            _subject,
            setValue,
            isPositiveInteger(defer)
                ? deferred(setValue, defer)
                : setValue,
            {
                firstValue,
                isBSub,
                oldValue: firstValue,
                shouldSubscribe,
            },
        ]
    }, [subject])

    const {
        firstValue,
        isBSub,
        shouldSubscribe
    } = data
    const [value, _setValue] = useState(firstValue)

    useEffect(() => {
        let mounted = true
        let ignoreFirst = !isBSub
        const unsubscribe = deferred(() => subscription?.unsubscribe?.(), 1)
        const handleChange = async (newValue) => {
            if (!mounted) return
            if (!ignoreFirst) {
                // BehaviorSubject subscription triggers a result immediately with the pre-existing value which is
                // already captured above and unnecessary to be evaluated again.
                // Ignoring first result reduces one extra state update.
                ignoreFirst = true
                return
            }
            const { oldValue } = data
            newValue = await _valueModifier(
                newValue,
                oldValue,
                _subject,
                unsubscribe,
                true,
            )
            // unchanged or `IGNORE_UPDATE_SYMBOL` was used
            if (!mounted || newValue === oldValue) return
            _setValue(newValue)
            data.oldValue = newValue
        }
        const subscription = shouldSubscribe && _subject.subscribe(handleChange)

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [_subject])

    isFn(onUnmount) && useUnmount(() => onUnmount(_subject, subject))

    return [
        value,
        setValue,
        _subject,
        setValueDeferred
    ]
}
export default useRxSubject