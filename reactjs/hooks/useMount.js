import { useEffect } from 'react'
import { fallbackIfFails } from '../../utils'
import { unsubscribe } from '../../rx'

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

/**
 * @name    useUnsubscribe
 * @summary unsubscribe from subscriptions when unmounting a component.
 * 
 * @param   {Array|Object|Function} subscriptions
 */
export const useUnsubscribe = subscriptions => useUnmount(() => unsubscribe(subscriptions))

export default useMount