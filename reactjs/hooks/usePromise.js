import { useMemo, useState } from 'react'
import PromisE from '../../PromisE'
import { isFn } from '../../utils'

/**
 * @name        usePromise
 * @summary     a custom React hook for use with a Promise
 * @description state update will occur only once when then @promise is either rejected or resolved.
 *
 *
 * @param   {Promise|Function}  promise
 * @param   {Function}          resultModifier
 * @param   {Function}          errorModifier
 *
 * @returns {Array} [
 *                      0. @result : anyting the promise resolves with
 *                      1. @error  : anything the promise rejects with
 *                  ]
 *
 * @example
 * ```javascript
 * const [result, error] = usePromise(Promise.resolve(1))
 * ```
 */
export const usePromise = (promise, resultModifier, errorModifier) => {
    promise = useMemo(
        () => new PromisE(isFn(promise)
            ? promise()
            : promise),
        [],
    )
    const [state, setState] = useState({})

    useState(() => {
        let mounted = true
        const handler = (key, modifier, setState) => value => {
            if (!mounted) return
            const newState = {}
            newState[key] = isFn(modifier)
                ? modifier(value)
                : value
            setState(newState)
        }

        promise.then(handler('result', resultModifier, setState))
            .catch(handler('error', errorModifier, setState))
        return () => mounted = false
    }, [promise])//[setState, promise]

    return [state.result, state.error]
}
export default usePromise