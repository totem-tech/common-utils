import { useEffect } from 'react'
import { fallbackIfFails } from '../../utils'

/**
 * @name    useMount
 * @summary simple React hook to trigger callback when component mounts and/or unmounts
 * 
 * @param {Function}         onMount   (optional) Callback to be triggered when component mounts.
 *                                     Args: boolean (true => mounted, false => unmounted)
 * @param {Function|Boolean} onUnmount (optional) Callback invoked when component unmounts.
 *                                     Alternatively, if `onUnmount === true`, `onMount` function will be #
 *                                     invoked when component is unmounted with.
 *                                     Args: same as `onMount`
 */
export const useMount = (onMount, onUnmount) => {
    useEffect(() => {
        fallbackIfFails(onMount, [true])
        if (onMount && onUnmount === true) onUnmount = onMount

        return () => fallbackIfFails(onUnmount, [false])
    }, [])
}

/**
 * @name    useUnmount
 * @summary sugar for `useMount` with only using the `onUnmount` callback
 * 
 * @param   {Function} onUnmount 
*/
export const useUnmount = onUnmount => useMount(null, onUnmount)

export default useMount