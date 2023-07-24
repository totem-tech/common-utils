import { useCallback } from 'react'
import { deferred } from '../../utils'

/**
 * @name    useCallbackDeferred
 * @summary combines React `useCallback` hook and `deferred` together
 * 
 * @param   {Function}  callback    
 * @param   {Number}    defer       (optional) Default: `50`
 * 
 * @returns {Function}
 */
export const useCallbackDeferred = (callback, defer) => useCallback(deferred(callback, defer))
export default useCallbackDeferred