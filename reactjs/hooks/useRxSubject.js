import {
    useEffect,
    useMemo,
    useState,
} from 'react'
import { BehaviorSubject, Subject } from 'rxjs'
import PromisE from '../../PromisE'
import {
    isFn,
    isObj,
    isSubjectLike,
} from '../../utils'
import { copyRxSubject } from '../../rx.js'

/**
 * @name    useRxSubject
 * @summary custom React hook for use with RxJS subject and auto update when value changes
 *
 * @param   {BehaviorSubject|Subject}   subject RxJS subject or subject like Object (with subscribe function)
 *              If not object or doesn't have subcribe function will assume subject to be a static value.
 * @param   {Boolean}   ignoreFirst whether to ignore first change.
 *              Setting `true`, will prevent an additional state update after first load.
 * @param   {Function}  valueModifier (optional) value modifier.
 *              If an async function is supplied, `ignoreFirst` will be assumed `false`.
 *              Args: `[newValue, oldValue, rxSubject]`
 * @param   {*}         initialValue (optional) initial value where appropriate
 * @param   {Boolean}   allowMerge (optional) only applicable if value is an object
 * @param   {Boolean}   allowSubjectUpdate (optional) whether to allow update of the subject or only state.
 *              CAUTION: if true and @subject is sourced from a DataStorage instance,
 *              it may override values in the LocalStorage values.
 *              Default: `false`
 *
 * @returns {Array}     [value, setvalue, subject]
 */
export const useRxSubject = (
    subject,
    valueModifier,
    initialValue,
    allowMerge = false,
    allowSubjectUpdate = false,
    debug = false
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
    const setValue = useMemo(() => newValue => _subject.next(newValue), [_subject])

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
        debug && console.log({
            firstValue: value,
            isBSub,
            value,
            subject,
        })

        return {
            firstValue: value,
            isBSub,
            value,
        }
    })

    useEffect(() => {
        let mounted = true
        let ignoreFirst = !isBSub
        const subscribed = _subject.subscribe((newValue) => {
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
                    ? { ...value, ...newValue }
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
                mounted && _setState({ isBSub, value })
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
    ]
}
// To prevent an update return this in valueModifier
useRxSubject.IGNORE_UPDATE = Symbol('ignore-rx-subject-update')

export default useRxSubject