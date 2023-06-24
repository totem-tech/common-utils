import { useEffect } from 'react'
import { translated } from '../../languageHelper'
import { query } from '../../polkadotHelper'
import PromisE from '../../PromisE'
import {
    isArr,
    isFn,
    isStr,
} from '../../utils'
import useRxStateDeferred from './useRxStateDeferred'

const textsCap = {
    loading: 'loading...'
}
translated(textsCap, true)

/**
 * @name    useQueryBlockchain
 * @summary a React Hook to query (and optionally subscribe) blockchain storage.
 *
 * @param   {Object|Promise}    connection
 * @param   {Object}            connection.api  ApiPromise
 * @param   {String|Function}   func
 * @param   {Array|*}           args    (optional)
 * @param   {Boolean}           multi   (optional)
 * @param   {Function}          resultModifier (optional)
 * @param   {Boolean}           subscribe (optional)
 * @param   {Boolean}           print   (optional)
 *
 * @returns {Object} { message, result, unsubscribe }
 * 
 * @example `javascript
 * // make sure to use `useMemo` to prevent making redundant queries
 * const queryArgs = useMemo(() => [
 *     getConnection(),
 *     'api.rpc.chain.subscribeFinalizedHeads',
 *     [],
 *     false,
 *     result => result,
 *     true
 * ], [])
 * const result = useQueryBlockchain(...queryArgs)
 * `
 */
export const useQueryBlockchain = (
    connection,
    func,
    args,
    multi,
    resultModifier,
    subscribe = true,
    defer = 100,
    loadingText = textsCap.loading,
    print,
) => {
    const [state, setState] = useRxStateDeferred({}, defer)

    useEffect(() => {
        if (!func) return

        let mounted = true
        let unsubscribed = false
        let unsubscribe
        const _args = args || []
        const callback = _args.slice(-1)
        const handleConnection = async ({ api }) => {
            unsubscribed = false
            const result = await query(
                api,
                func,
                _args,
                multi,
                print,
            )
            // once-off query
            if (!isFn(result)) return handleResult(result)

            // subscription
            unsubscribe = result
        }
        const handleError = err => mounted && setState({
            message: err && {
                content: `${err}`,
                icon: true,
                status: 'error',
            }
        })
        const handleResult = (resultSanitised, resultOriginal) => {
            mounted && setState({
                message: null,
                result: isFn(resultModifier)
                    ? resultModifier(resultSanitised, resultOriginal)
                    : resultSanitised,
                unsubscribe: handleUnsubscribe,
            })
            isFn(callback) && callback(resultSanitised, resultOriginal)
        }
        const handleUnsubscribe = () => {
            if (!isFn(unsubscribe)) return

            unsubscribed = true
            unsubscribe()
        }

        if (!isFn(callback)) {
            subscribe && _args.push(handleResult)
        } else {
            args[args.indexOf(callback)] = handleResult
        }
        loadingText !== null && setState({
            message: {
                content: loadingText,
                icon: true,
                status: 'loading',
            }
        })
        PromisE(connection)
            .then(handleConnection)
            .catch(handleError)

        return () => {
            mounted = false
            handleUnsubscribe()
        }
    }, [func, args, multi])

    const { message, result, unsubscribe } = state || {}
    return { message, result, unsubscribe }
}
export default useQueryBlockchain

// WIP: needs testing
useQueryBlockchain.multi = (
    connection,
    queries,
    resultsModifier,
    // common props
    subscribe = false,
    defer,
    loadingText,
    print
) => {
    console.log('mulit', queries)
    if (!isArr(queries)) return []

    const results = queries.map(query =>
        useQueryBlockchain(
            connection,
            isStr(query)
                ? query
                : query?.func,
            query?.args,
            query?.multi,
            query?.resultModifier,
            query?.subscribe ?? subscribe,
            query?.defer ?? defer,
            query?.loadingText ?? loadingText,
            query?.print ?? print,
        )
    )

    return !isFn(resultsModifier)
        ? results
        : resultsModifier(results, queries)
}