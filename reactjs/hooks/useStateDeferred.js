import { useMemo, useState } from 'react'
import { deferred } from '../../utils'

/**
 * @name    useStateDeferred
 * @summary sugar for `useState` hook with delayed/deferred `setState` functionality by default
 *
 * @param   {*|Function} initialState
 * @param   {Number}     defer        duration in milliseconds
 *                                      Default: `100`
 *
 * @returns {Array}      [state, setStateDeferred, setState]
 */
export const useStateDeferred = (initialState, defer = 100) => {
    const [state, setState] = useState(initialState)
    const setStateDeferred = useMemo(() =>
        deferred(setState, defer),
        [setState, defer]
    )

    return [
        state,
        setStateDeferred,
        setState,
    ]
}
export default useStateDeferred

