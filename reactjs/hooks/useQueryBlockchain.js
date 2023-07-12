import { useEffect, useMemo } from 'react'
import { translated } from '../../languageHelper'
import { query } from '../../polkadotHelper'
import PromisE from '../../PromisE'
import {
    isArr,
    isFn,
    isStr,
} from '../../utils'
import useRxStateDeferred from './useRxStateDeferred'
import useRxSubjectOrValue from './useRxSubjectOrValue'
import { BehaviorSubject } from 'rxjs'

const textsCap = {
    loading: 'loading...'
}
translated(textsCap, true)

/**
 * @name    useQueryBlockchain
 * @summary a React Hook to query (and optionally subscribe) blockchain storage.
 *
 * @param {Object}                q
 * @param {BehaviorSubject|Array} q.args     (optional) If last item is a function, `q.subscribe` will be set to `true`.
 * @param {Object|Promise}        q.connection
 * @param {Number}                q.defer       (optional)
 *                                              Default: `100`
 * @param {BehaviorSubject|String|Function} q.func blockchain query function. Eg: 'api.query.blances.freeBalance'
 * @param {String}                q.loadingText
 * @param {BehaviorSubject|Boolean} q.multi     (optional)
 * @param {Boolean}               q.print       (optional)
 * @param {Boolean}               q.subjectOnly (optional) if true, will return `rxState` instaed of the `state` object
 * @param {Boolean}               q.subscribe   (optional)
 *                                              Defualt: `true`                                          
 * @param {Function}              q.valueModifier (optional) callback to modify the query result
 *
 * @returns {Object} { message, result, unsubscribe }
 * 
 * @example `javascript
 * // make sure to use `useMemo` to prevent making redundant queries
 * const query = useMemo(() => ({
 *     args: [],
 *     connection: getConnection(),
 *     func: 'api.rpc.chain.subscribeFinalizedHeads',
 *     multi: false,
 *     subscribe: true
 *     valueModifier: result => result,
 * }), [])
 * const result = useQueryBlockchain(query)
 * `
 */
export const useQueryBlockchain = ({
    args,
    connection = useQueryBlockchain.defaultConnection,
    defer = 100,
    func,
    loadingText = textsCap.loading,
    multi,
    onError,
    print,
    subscribe = true,
    valueModifier,
    subjectOnly = false,
} = {}) => {
    args = useRxSubjectOrValue(args)
    func = useRxSubjectOrValue(func)
    multi = useRxSubjectOrValue(multi)
    const rxState = useMemo(() => new BehaviorSubject({}), [])

    useEffect(() => {
        if (!func) return

        let mounted = true
        let unsubscribed = false
        let unsubscribe
        const queryArgs = [...args || []]
        const callback = queryArgs.slice(-1)
        if (isFn(callback)) subscribe = true

        const handleConnection = async ({ api }) => {
            if (unsubscribed || !mounted) return

            const result = await query(
                api,
                func,
                queryArgs,
                multi,
                print,
            )
            if (unsubscribed || !mounted) return
            // once-off query
            if (!isFn(result)) return handleResult(result)

            // subscription
            unsubscribe = result
        }

        const handleError = err => {
            if (unsubscribed || !mounted) return

            rxState.next({
                message: err && {
                    content: `${err}`,
                    icon: true,
                    status: 'error',
                }
            })
            isFn(onError) && onError(err)
        }

        const handleResult = (resultSanitised, resultOriginal) => {
            if (unsubscribed || !mounted) return

            const result = isFn(valueModifier)
                ? valueModifier(resultSanitised, resultOriginal)
                : resultSanitised
            rxState.next({
                message: null,
                result,
                unsubscribe: handleUnsubscribe,
            })
            isFn(callback) && callback(resultSanitised, resultOriginal)
        }
        const handleUnsubscribe = () => {
            if (!isFn(unsubscribe) || unsubscribed) return

            unsubscribed = true
            unsubscribe()
        }

        if (subscribe) {
            queryArgs.push(handleResult)
            const cbIndex = isFn(callback)
                ? queryArgs.indexOf(callback)
                : queryArgs.length
            queryArgs[cbIndex] = handleResult
        }
        loadingText !== null
            && !rxState.value.message?.status !== 'loading'
            && rxState.next({
                message: {
                    content: loadingText,
                    icon: true,
                    status: 'loading',
                }
            })
        connection && PromisE(connection)
            .then(handleConnection)
            .catch(handleError)

        return () => {
            mounted = false
            subscribe && handleUnsubscribe()
        }
    }, [func, args, multi])

    if (subjectOnly) return rxState

    const [state] = useRxStateDeferred(
        {
            message: !func || loadingText === null
                ? null
                : {
                    content: loadingText,
                    icon: true,
                    status: 'loading',
                }
        },
        defer,
        { subject: rxState }
    )

    return state //{ message, result, unsubscribe } 
}
useQueryBlockchain.defaultConnection = null
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