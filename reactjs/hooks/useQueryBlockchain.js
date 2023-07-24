import { useEffect, useMemo } from 'react'
import { translated } from '../../languageHelper'
import { query } from '../../polkadotHelper'
import PromisE from '../../PromisE'
import {
    isArr,
    isFn,
    isObj,
    isStr,
} from '../../utils'
import useRxStateDeferred from './useRxStateDeferred'
import useRxSubjectOrValue from './useRxSubjectOrValue'
import { BehaviorSubject } from 'rxjs'
import useRxState from './useRxState'
import useRxSubject from './useRxSubject'

const textsCap = {
    loading: 'loading...'
}
translated(textsCap, true)

/**
 * @name    useQueryBlockchain
 * @summary a React Hook to query (and optionally subscribe) blockchain storage.
 * CAUTION: make sure to store query (`q`) object in a state to prevent infinite loop
 *
 * @param {Object}                q
 * @param {BehaviorSubject|Array} q.args     (optional) If last item is a function, `q.subscribe` will be set to `true`.
 * @param {Object|Promise}        q.connection  not requried if `useQueryBlockchain.defaultConnection` is already set.
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
    func,
    loadingText = textsCap.loading,
    multi,
    onError,
    print,
    subject,
    subjectOnly = false,
    subscribe = true,
    valueModifier,
}) => {
    args = useRxSubjectOrValue(args)
    func = useRxSubjectOrValue(func)
    multi = useRxSubjectOrValue(multi)
    const rxQuery = useMemo(() => subject || new BehaviorSubject({
        message: !func || loadingText === null || !connection
            ? null
            : {
                content: loadingText,
                icon: true,
                status: 'loading',
            }
    }), [subject])

    useEffect(() => {
        if (!func || !connection) return () => { }

        let mounted = true
        let unsubscribed = false
        let unsubscribe
        const queryArgs = [...args || []]
        const callback = isFn(queryArgs.slice(-1)[0]) && queryArgs.splice(-1)
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
            // once-off query
            if (!isFn(result)) return handleResult(result)

            // subscription
            unsubscribe = result
        }

        const handleError = err => {
            if (unsubscribed || !mounted) return

            rxQuery.next({
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
            rxQuery.next({
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

        if (subscribe) queryArgs.push(handleResult)

        loadingText !== null
            && !!rxQuery.value?.message
            && rxQuery.next({
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
            subscribe && handleUnsubscribe()
        }
    }, [func, args, multi])

    if (subjectOnly) return rxQuery

    return useRxSubject(rxQuery)[0] //{ message, result, unsubscribe } 
}
useQueryBlockchain.defaultConnection = null
export default useQueryBlockchain

// WIP: needs testing
useQueryBlockchain.multi = ({
    connection = useQueryBlockchain.defaultConnection,
    loadingText,
    print,
    queries,
    // common props
    subscribe = false,
    valuesModifier,
} = {}) => {
    console.log('mulit', queries)
    if (!isArr(queries)) return []

    const values = queries.map(query =>
        useQueryBlockchain({
            connection,
            loadingText,
            print,
            subscribe,
            ...!isObj(query)
                ? { func: query }
                : query,
        })
    )

    return !isFn(valuesModifier)
        ? values
        : valuesModifier(values, queries)
}