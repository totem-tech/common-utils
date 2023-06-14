import { useMemo } from 'react'
import { useUnmount } from './useMount'

/**
 * @name    useMutationObserver
 * @summary React hook for observing mutation in child components using `MutationObserver`
 * 
 * @param   {*}         ref         React.Ref instance
 * @param   {Function}  callback
 * @param   {Object}    conf        (optional) MutationObserver config.
 *                                  Default: `{ childList: true }`
 * 
 * @returns {*}   return the ref
 */
export const useMutationObserver = (ref, callback, conf) => {
    let observer
    useMemo(() => {
        observer = new MutationObserver(callback)
        const el = ref?.current
        conf ??= { childList: true }
        el && conf && observer.observe(el, conf)
    }, [ref, callback])

    // stop observing
    useUnmount(() => observer?.disconnect())

    return ref
}
export default useMutationObserver