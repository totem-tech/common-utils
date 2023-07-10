import { isValidElement, useMemo } from 'react'
import { BehaviorSubject, SubjectLike } from 'rxjs'
import { isFn, isObj, isSubjectLike } from '../../utils'
import useRxSubject from './useRxSubject'
import useMount from './useMount'
import { copyRxSubject } from '../../rx'

/**
 * @name    useRxState
 * @summary React hook to maintain state utilizing RxJS
 * 
 * @param   {*|Function}        initialState    (optional)
 *                                          Function arguments: rxState BehaviorSubject
 *                                          Default: `{}`
 * @param   {Object|Function}      conf             if function, it will be used as `valueModifier`
 * @param   {Function}             conf.allowMerge  (optional) whether to merge old and new values into an object.
 *                                                  If `valueModifier` is used, it needs to merge the first
 *                                                  argument with the returned value otherwise `allowMerge` won't work.
 *                                                  Default: `true` if initial state is an object.         
 * @param   {Function}             conf.onMount     (optional)
 * @param   {Function}             conf.onUnmount   (optional)
 * @param   {SubjectLike|Function} conf.subject     (optional)
 * @param   {Function}             conf.valueModifier (optional)
 * 
 * @returns {[*, Function, BehaviorSubject, Function]} [state, setState, rxState, setStateDeferred]
 */
export const useRxState = (
    initialState = {},
    conf = {},
    debugTag
) => {
    let {
        allowMerge,
        allowSubjectUpdate = true,
        defer,
        onUnmount,
        subject,
        valueModifier,
    } = conf
    if (isFn(conf)) valueModifier = conf
    const [rxState, iniState] = useMemo(() => {
        subject = isFn(subject)
            ? subject()
            : subject
        const rxState = isSubjectLike(subject)
            ? subject
            : new BehaviorSubject({})
        initialState = !isFn(initialState)
            ? initialState
            : initialState(rxState)
        rxState.next(initialState)
        return [
            rxState,
            initialState
        ]
    }, [])
    allowMerge ??= !!iniState
        && !isValidElement(iniState)
        && isObj(iniState)
    const [state, setState, _, setStateDeferred] = useRxSubject(
        rxState,
        valueModifier,
        iniState,
        allowMerge,
        allowSubjectUpdate,
        defer,
        onUnmount,
    )

    debugTag && console.log(debugTag, state)

    return [
        state,
        setState,
        rxState,
        setStateDeferred
    ]
}
export default useRxState