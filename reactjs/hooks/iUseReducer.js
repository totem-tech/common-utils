import {
    useEffect,
    useReducer,
    useState,
} from 'react'
import { BehaviorSubject } from 'rxjs'
import { isFn } from '../../utils'

/** ToDo: deprecate or simply use `useRxSubject` with an object as initial value
 * @name    iUseReducer
 * @summary A sugar for React `userReducer` with added benefit of tracking of component mounted status.
 *          Prevents state update if component is not mounted.
 *
 * @param   {Function}          reducerFn
 * @param   {Object|Function}   initialState    if function, a RxJS Subject will be supplied as argument
 *                                              as an alternative to setState
 *
 * @returns {Array}     [@state {Object}, @setState {Function}]
 */
export const iUseReducer = (reducerFn, initialState = {}, onUnmount) => {
    const [[rxSetState, iniState]] = useState(() => {
        const rxSetState = isFn(initialState) && new BehaviorSubject({})
        initialState = !rxSetState
            ? initialState
            : initialState(rxSetState)

        return [
            rxSetState,
            {
                ...initialState,
                ...rxSetState && rxSetState.value || {},
            }
        ]
    })
    const [state, setStateOrg] = useReducer(
        isFn(reducerFn)
            ? reducerFn
            : reducer,
        iniState,
    )
    // ignores state update if component is unmounted
    const [setState] = useState(() =>
        (...args) => setStateOrg.mounted && setStateOrg(...args)
    )

    useEffect(() => {
        setStateOrg.mounted = true
        const subscription = rxSetState && rxSetState.subscribe(setState)

        return () => {
            setStateOrg.mounted = false
            isFn(onUnmount) && onUnmount()
            subscription && subscription.unsubscribe()
        }
    }, [setStateOrg, rxSetState])

    return [state, setState]
}

/**
 * @name    reducer
 * @summary simple reducer to mimic Class component setState behavior
 *
 * @param   {Object}    state
 * @param   {Object}    newValue
 *
 * @returns {Object}
 */
export const reducer = (state = {}, newValue = {}) => ({ ...state, ...newValue })

export default iUseReducer