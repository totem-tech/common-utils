import { useEffect, useState } from 'react'
import { translated } from '../../languageHelper'
import { query } from '../../polkadotHelper'
import PromisE from '../../PromisE'
import { isFn } from '../../utils'

const textsCap = {
    loading: 'loading...'
}
translated(textsCap, true)

/**
 * @name    useQueryBlockchain
 * @summary a React Hook to query (and optionally subscribe) blockchain storage
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
 */
export const useQueryBlockchain = (
    connection,
    func,
    args = [],
    multi,
    resultModifier,
    subscribe = true,
    loadingText = textsCap.loading,
    print,
) => {
    const [data, setData] = useState({})

    useEffect(() => {
        let mounted = true
        let unsubscribed = false
        let unsubscribe
        const callback = args.slice(-1)
        const handleConnection = async ({ api }) => {
            unsubscribed = false
            const result = await query(
                api,
                func,
                args,
                multi,
                print,
            )
            // once-off query
            if (!isFn(result)) return handleResult(result)

            // subscription
            unsubscribe = result
        }
        const handleError = err => mounted && setData({
            message: err && {
                content: `${err}`,
                icon: true,
                status: 'error',
            }
        })
        const handleResult = (resultSanitised, resultOriginal) => {
            mounted && setData({
                message: null,
                result: isFn(resultModifier)
                    ? resultModifier(resultSanitised, resultOriginal)
                    : resultSanitised,
                unsubscribe: handleUnsubscribe,
            })
            isFn(callback) && callback(resultSanitised, resultOriginal)
        }
        const handleUnsubscribe = () => {
            if (!isFn(unsubscribe)) return // || unsubscribed

            unsubscribed = true
            unsubscribe()
        }

        if (!isFn(callback)) {
            subscribe && args.push(handleResult)
        } else {
            // args[args.indexOf(callback)] = handleResult
        }
        if (func) {
            setData({
                message: {
                    content: loadingText,
                    icon: true,
                    status: 'loading',
                }
            })
            PromisE(connection)
                .then(handleConnection)
                .catch(handleError)
        }

        return () => {
            mounted = false
            handleUnsubscribe()
        }
    }, [func, args, multi])

    const { message, result, unsubscribe } = data || {}
    return { message, result, unsubscribe }
}