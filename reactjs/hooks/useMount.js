import { useEffect } from 'react'
import { fallbackIfFails, isArr } from '../../utils'
import { BehaviorSubject } from 'rxjs'

/**
 * @name    useMount
 * @summary simple React hook to trigger callback when component mounts and/or unmounts
 * 
 * @param {Function}         onMount   (optional) Callback to be triggered when component mounts.
 *                                     Args: `{ isMounted }`
 * @param {Function|Boolean} onUnmount (optional) Callback invoked when component unmounts.
 *                                     Alternatively, if `onUnmount === true`, `onMount` function will be #
 *                                     invoked when component is unmounted with.
 *                                     Args: same as `onMount`
 */
export const useMount = (onMount, onUnmount) => {
    useEffect(() => {
        const x = { isMounted: true }
        onMount && fallbackIfFails(onMount, [x])
        if (onMount && onUnmount === true) onUnmount = onMount

        return () => {
            x.isMounted = false
            onUnmount && fallbackIfFails(onUnmount, [x])
        }
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