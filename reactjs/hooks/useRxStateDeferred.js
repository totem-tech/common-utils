import { useMemo } from 'react'
import { deferred } from '../../utils'
import useRxState from './useRxState'

/**
 * @name    useRxStateDeferred
 * @summary sugar for `useRxState` hook with delayed/deferred `setState` functionality by default
 *
 * @param   {*|Function}        initialState
 * @param   {Number}            defer               (optional) duration in milliseconds
 *                                                  Default: `100`
 * @param   {Object}            conf
 * @param   {Function}          conf.allowMerge     (optional) Default: `true` if initial state is an object.         
 * @param   {Function}          conf.onMount        (optional)
 * @param   {Function}          conf.onUnmount      (optional)
 * @param   {BehaviorSubject}   conf.subject        (optional)
 * @param   {Function}          conf.valueModifier  (optional)
 *
 * @returns {Array}      [state, setStateDeferred, setState, rxSate]
 */
export const useRxStateDeferred = (initialState, defer = 100, conf) => {
    const [
        state,
        setState,
        rxState,
        setStateDeferred,
    ] = useRxState(initialState, { ...conf, defer })

    return [
        state,
        setStateDeferred,
        rxState,
        setState,
    ]
}
export default useRxStateDeferred

