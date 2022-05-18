import { bytesToHex, hexToBytes, ss58Decode, ss58Encode } from "../convert"
import PromisE from "../PromisE"
import { isArr, isFn, isHex, isPositiveInteger, isUint8Arr, isValidURL } from "../utils"
import BlockchainHelper from './BlockchainHelper'

/**
 * @name    CrowdloanHelper
 * 
 * @param   {BlockchainHelper} blockchainHelper 
 */
export default class CrowdloanHelper {
    constructor(blockchainHelper, parachainId, title) {
        if (!(blockchainHelper instanceof BlockchainHelper)) throw new Error('Invalid BlockchainHelper!')
        this.blockchainHelper = blockchainHelper
        this.formatAmount = blockchainHelper.formatAmount
        this.query = blockchainHelper.query
        this.parachainId = parachainId
        this.title = title
    }

    /**
     * @name    getFunds
     * @summary get total funds raised by the parachain and other info
     * 
     * @param   {Boolean}   formatted whether to convert amounts to correct units.
     *                      Default: `true`
     * 
     * @returns {Object} result
     * 
     * @example ```javascript
     * 
     * // Example result: (unformatted)
     * {
     *     "depositor": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
     *     "verifier": null,
     *     "deposit": 100000000000000,
     *     "raised": 233000000000000,
     *     "end": 70000,
     *     "cap": "0x0000000000000000008e1bc9bf040000",
     *     "lastContribution": {
     *         "preEnding": 0
     *     },
     *     "firstPeriod": 5,
     *     "lastPeriod": 13,
     *     "trieIndex": 0
     * }
     * 
     * // Example result: (formatted)
     * {
     *     "depositor": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
     *     "verifier": null,
     *     "deposit": 100,
     *     "raised": 233,
     *     "end": 70000,
     *     "cap": 40000,
     *     "lastContribution": {
     *         "preEnding": 0
     *     },
     *     "firstPeriod": 5,
     *     "lastPeriod": 13,
     *     "trieIndex": 0
     * }
     * ```
     */
    getFunds = async (callback, formatted = true) => {
        const isSubscribe = isFn(callback)
        const handleResult = (result = {}) => {
            if (result && formatted) {
                ['cap', 'deposit', 'raised']
                    .forEach(key => {
                        result[key] = this.formatAmount(
                            Number(result[key]),
                            false,
                            this.blockchainHelper?.unit?.decimals || 4,
                        )
                    })
            }
            isSubscribe && callback(result)
            return result
        }
        const result = await this.query(
            'api.query.crowdloan.funds',
            [
                this.parachainId,
                isSubscribe && handleResult,
            ].filter(Boolean),
        )
        return isSubscribe
            ? result // unsubscribe function
            : handleResult(result)
    }

    /**
     * @name    getContributions
     * @summary fetch user contributions by identities
     * 
     * @param   {String|Array}  addresses 
     * @param   {Boolean}       asString        (optional) Defaut: `false`
     * @param   {Number}        decimals        (optional) Default: `this.blockchainHelper.unit.decimals`
     * @param   {Number}        parachainId     (optional) Default: `this.parachainId`
     * @param   {Function}      callback        (optional)
     * @param   {Boolean}       includeParallel (optional) whether to include contributions made through Parallel
     *                                          Finance Crowdloan DApp.
     *                                          Default: `true`
     * 
     * @returns {Number|Map}    
     */
    getUserContributions = async (addresses, asString, decimals, parachainId, callback, includeParallel = true) => {
        const multi = isArr(addresses)
        parachainId ??= this.parachainId
        if (!multi) addresses = [addresses]

        // fetch user contributions made through Parallel Finance
        const resultsParallel = !includeParallel
            ? []
            : await Promise.all(
                addresses.map(address =>
                    this.getUserContributionsParallel(address, parachainId)
                        .then(([_, amount]) => amount)
                        .catch(err => {
                            console.error(`Failed to retreive contributions from parallel for ${address}.`, err)
                            return 0
                        })
                )
            )

        // convert addresses to hexes
        const idHexes = addresses.map(
            address => isHex(address)
                ? address
                : bytesToHex(
                    isUint8Arr(address)
                        ? address
                        : ss58Decode(address)
                )
        )

        const handleResult = contributions => {
            let result = new Map(
                resultsParallel.map((amount = 0, i) => [addresses[i], amount])
            )
            // convert hex amounts to number and format to correct unit values
            Object
                .keys(contributions)
                .forEach((idHex, i) => {
                    const amountHex = contributions[idHex]
                    const amountFormatted = this.formatAmount(
                        Number(amountHex),
                        asString,
                        decimals,
                    )
                    const address = addresses[i]
                    const amount = + amountFormatted
                    result.set(address, amount)
                })

            result = multi
                ? result
                : (Array.from(result)[0] || {})[1]

            return isFn(callback)
                ? callback(result)
                : result

        }
        // fetch user contributions made directly to the relay chain
        const result = await this.query(
            'api.derive.crowdloan.ownContributions',
            [
                parachainId,
                idHexes,
                isFn(callback) && handleResult,
            ].filter(Boolean),
        )

        return isFn(callback)
            ? result
            : handleResult(result)
    }

    /**
     * @name    getUserContributionsParallel
     * @summary fetch user contributions made through Parallel Finance crowdloan DApp
     * 
     * @param   {String} address 
     * @param   {Nubmer} parachainId 
     * 
     * @returns {Array} [Array, Number]
     */
    getUserContributionsParallel = async (address, parachainId, formatted = true) => {
        parachainId ??= this.parachainId
        // convert address to Polkadot format (required for the API to work)
        address = ss58Encode(address, 0)
        const apiUrl = 'https://api.subquery.network/sq/parallel-finance/auction-subquery'
        const body = {
            query: `query {
                dotContributions(filter: {
                    account: { equalTo: "${address}" },
                    paraId: { equalTo: ${parachainId} }
                }) {
                    nodes {
                        id
                        blockHeight
                        paraId
                        account
                        amount
                    } 
                } 
            }`
        }
        const options = {
            body: JSON.stringify(body),
            method: 'post',
        }
        const result = await PromisE.fetch(apiUrl, options)
        const contributions = result?.data?.dotContributions?.nodes || []
        const sum = contributions
            .reduce((sum, next) => {
                if (formatted) next.amount = this.formatAmount(next.amount, false)
                return sum + next.amount
            }, 0)
        return [contributions, sum]
    }

    /**
     * @name    getContributors
     * @summary fetch list of all contributors of a specific parachain
     * 
     * @param   {Nubmer} parachainId    Default: `this.parachainId`
     * 
     * @returns {Array} addresses
     */
    getContributors = async (parachainId = this.parachainId) => {
        let { contributorsHex = [] } = await this.query('api.derive.crowdloan.contributions', parachainId)
        return contributorsHex.map(idHex => ss58Encode(ss58Encode(idHex)))
    }
}