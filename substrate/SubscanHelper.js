import PromisE from '../PromisE'
import { arrToMap, generateHash, isAddress, isArr, isStr, isValidNumber, isValidURL } from '../utils'

export default class SubscanHelper {
    constructor(
        chainId = 'polkadot',
        apiKey,
        maxItemsPerPage = 100
    ) {
        this.apiBaseURL = isValidURL(chainId)
            ? `${chainId}`.endsWith('/') // for legacy support
                ? chainId.slice(0, -1)
                : chainId
            : `https://${chainId}.api.subscan.io`
        this.apiKey = apiKey
        this.maxItemsPerPage = maxItemsPerPage
    }

    /**
     * @name    query
     * @summary execute a query using Subscan API
     * 
     * @param {String}  path 
     * @param {Object}  payload  (optional)
     * @param {Object}  options  (optional)
     * @param {Strng}   listKey  (optional)
     * @param {Number}  maxPages (optional)
     * 
     * @returns {*} result
     */
    query = async (
        path,
        payload = {},
        listKey = 'list', // list, funds, chains...
        options = {},
        maxPages = 1000,
        strict = false
    ) => {
        const url = [
            this.apiBaseURL,
            path.startsWith('/')
                ? ''
                : '/',
            path
        ].join('')
        payload = {
            row: this.maxItemsPerPage,
            page: 0,
            ...payload,
        }
        options.headers = {
            'X-API-Key': this.apiKey,
            ...options.headers,
        }
        let result = {}
        let nextPage
        let count = 1
        do {
            const pageResult = await PromisE.post(
                url,
                payload,
                options
            ).catch(err =>
                strict || count === 1
                    ? Promise.reject(err)
                    : {} // ignore error and resolve with previous pages retrieved
            )
            const { data = {} } = pageResult || {}
            const isList = listKey && isArr(data?.[listKey])
            if (!isList && count === 1) {
                result = pageResult
            } else {
                result.count = data?.count
                result[listKey] = [
                    ...result[listKey] || [],
                    ...data?.[listKey] || []
                ]
            }

            nextPage = isList
                && count < maxPages
                && data[listKey].length >= payload.row
            payload.page++
            count++
        } while (nextPage)

        return result
    }

    /**
     * @name    parachainGetList
     * @summary get a list of parachains. 
     * @description API documentation can be found here: https://docs.api.subscan.io/#parachain-list
     * 
     * @returns {Array}
     */
    parachainGetList = async (payload = {}) => {
        const data = await this.query(
            '/api/scan/parachain/list',
            payload,
            'chains'
        )
        return data?.chains || []
    }

    /**
     * @name    parachainGetFunds
     * @summary get contribution information including funds raised.
     * @description API documentation can be found here: https://docs.api.subscan.io/#funds
     * 
     * @param   {Number} parachainId 
     * 
     * @returns {Array}
     */
    parachainGetFunds = async (parachainId) => {
        const data = await this.query(
            '/api/scan/parachain/funds',
            { para_id: parachainId },
            'funds'
        )

        return data?.funds || []
    }

    referendaGetList = async (payload = {}, asMap = false) => {
        const data = await this.query(
            '/api/scan/referenda/referendums',
            payload,
            !isValidNumber(payload?.page) && 'list',
        )
        return !asMap
            ? data?.list || []
            : arrToMap(data?.list || [], 'referendum_index')
    }

    /**
     * @name    referendaGetVotes
     * @summary get list of votes by referenda index or user identity.
     * 
     * @param   {Number|String} referendaOrId 
     * @param   {Object}        payload         (optional)
     * 
     * @returns {Array|Map}
     */
    referendaGetVotes = async (referendaOrId, payload = {}, asMap = false) => {
        const query = isAddress(referendaOrId)
            ? 'account'
            : 'referendum_index'
        const data = await this.query(
            '/api/scan/referenda/votes',
            {
                ...payload,
                ...{ [query]: referendaOrId },
            },
            !isValidNumber(payload?.page) && 'list',
        )
        return !asMap
            ? data?.list || []
            : arrToMap(data?.list || [])
    }

    /**
     * @name    referendaGetVotes
     * @summary get list of votes by referenda index or user identity.
     * 
     * @param   {Array<Number|String>} arrReferendaOrId 
     * @param   {Boolean}        asMap         (optional) Default: true
     * 
     * @returns {Array|Map}
     */
    referendaGetVotesBatch = async (arrReferendaOrId, asMap = true) => {
        const results = []

        for (let i = 0;i < arrReferendaOrId.length;i++) {
            if (arrReferendaOrId.length > 1) console.log(
                'SubscanHelper: fetching votes for ', arrReferendaOrId[i]
            )
            results.push(
                await this.referendaGetVotes(
                    arrReferendaOrId[i]
                )
            )
        }
        return !asMap
            ? results
            : arrToMap(results)
    }
}