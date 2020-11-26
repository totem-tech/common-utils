import PromisE from './PromisE'
import { isAddress, isArr, isObj, objToFormData, objToUrlParams } from "./utils"

let messages = {
    invalidEthereumAddress: 'Invalid Ethereum address',
    invalidRequest: 'invalid request'
}
// chains supported by client.getBalance()
export const getBalance_chains = {
    bitcoin: 'bitcoin',
    bitcoinCash: 'bitcoin-cash',
    bitcoinSV: 'bitcoin-sv',
    bitcoinTestnet: 'bitcoin/testnet',
    dash: 'dash',
    dogecoin: 'dogecoin',
    groestlcoin: 'groestlcoin',
    litecoin: 'litecoin',
    zcash: 'zcash',
}
export default class BlockchairClient {
    constructor(apiKey, baseUrl = 'https://api.blockchair.com', timeout = 10000) {
        this.baseUrl = baseUrl
        this.apiKey = apiKey
        this.timeout = timeout
    }

    /**
     * @name    getAPIKeyStats
     * @summary get API key related data
     * 
     * @returns {Object}
     */
    async getAPIKeyStats() {
        const params = objToUrlParams({ key: this.apiKey })
        const url = `${this.baseUrl}/premium/stats?${params}`
        return await blockchairFetch(
            url,
            { method: 'get' },
            this.timeout,
        )
    }

    /**
     * @name        getBalance
     * @summary     retrieve balances in a single batch request
     * @description See https://blockchair.com/api/docs#link_390 for list of supported chains and expected result.
     * 
     * @param   {Array}     addresses   list of string addresses
     * @param   {String}    chain       (optional) Default: bitcoin
     * 
     * 
     * @returns {Object}
     * 
     * @example
     * ```javascript
     *  const client = new BlockchairClient()
     *  client.getBalance(
     *      ['35hK24tcLEWcgNA4JxpvbkNkoAcDGqQPsP', '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo'],
     *      'bitcoin',
     *  ).then(console.log)
     *  // Example result:
     *  // {
     *  //      "35hK24tcLEWcgNA4JxpvbkNkoAcDGqQPsP": 25550215769897,
     *  //      "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo": 4053399981517
     *  // }
     * ```
     */
    async getBalance(addresses = [], chain = 'bitcoin') {
        const options = {
            body: objToFormData({
                addresses,
                key: this.apiKey,
            }),
            method: 'post',
        }
        const url = `${this.baseUrl}/${chain}/addresses/balances`
        return await blockchairFetch(
            url,
            options,
            this.timeout,
        )
    }

    /**
     * @name        getERC20HolderInfo
     * @summary     get Ethereum ERC20 token balance, transaction history etc information for account holder
     * @description See https://blockchair.com/api/docs#link_504
     * 
     * @param {Array|String} addresses    token holder address
     * @param {String}       tokenAddress token contract address
     * @param {Number}       limit        (optional) maximum number of recent transactions to retrieve. 
     *                                        Default: 100
     * @param {Number}       offset       (optional) number of recent transactions to skip.
     *                                        Default: 0
     * @param {Boolean}      mainnet      (optional) whether to make the request on mainnet or testnet.
     *                                        Default: true
     * @param {Boolean}      combine      (optional) whether to combine multi-query results into a single object.
     *                                        Default: true
     * 
     * @returns {Object}
     * 
     * @example
     * ```javascript
     *  const client = new BlockchairClient()
     *  client.getERC20HolderInfo(
     *      ['0x3282791d6fd713f1e94f4bfd565eaa78b3a0599d'],
     *      '0x68e14bb5a45b9681327e16e528084b9d962c1a39',
     *  ).then(console.log)
     *  // Example result: (for both single and multi-query)
     *  // {
     *  //   "0x3282791d6fd713f1e94f4bfd565eaa78b3a0599d": {
     *  //     "address": {
     *  //       "balance": "5000000000000000000",
     *  //       "balance_approximate": 5,
     *  //       "received": "5000000000000000000",
     *  //       "received_approximate": 5,
     *  //       "spent": "0",
     *  //       "spent_approximate": 0,
     *  //       "receiving_transaction_count": 1,
     *  //       "spending_transaction_count": 0,
     *  //       "transaction_count": 1,
     *  //       "first_seen_receiving": "2017-11-26 23:17:02",
     *  //       "last_seen_receiving": "2017-11-26 23:17:02",
     *  //       "first_seen_spending": null,
     *  //       "last_seen_spending": null
     *  //     },
     *  //     "transactions": [
     *  //       {
     *  //         "block_id": 4628318,
     *  //         "id": 17166097,
     *  //         "transaction_hash": "0xd3aeac286c429f581f056388e523726e7b42caeba1d6a8df591ea2ec30daad48",
     *  //         "time": "2017-11-26 23:17:02",
     *  //         "token_address": "0x68e14bb5a45b9681327e16e528084b9d962c1a39",
     *  //         "token_name": "en",
     *  //         "token_symbol": "CAT",
     *  //         "token_decimals": 18,
     *  //         "sender": "0x9f89388141c632c4c6f36d1060d5f50604ee3abc",
     *  //         "recipient": "0x3282791d6fd713f1e94f4bfd565eaa78b3a0599d",
     *  //         "value": "5000000000000000000",
     *  //         "value_approximate": 5
     *  //       }
     *  //     ]
     *  //   },
     *  // }
     * ```
     */
    async getERC20HolderInfo(addresses, tokenAddress, limit = 100, offset = 0, mainnet = true, combine = true) {
        const isMultiQuery = isArr(addresses)
        addresses = !isMultiQuery ? [addresses] : addresses
        const isAddressesValid = addresses.every(address => isAddress(
            address,
            isAddress.validTypes.ethereum,
        ))
        if (!isAddressesValid) throw messages.invalidEthereumAddress

        const options = { method: 'get' }
        const params = objToUrlParams({
            key: this.apiKey,
            limit,
            offset,
        })
        
        const network = mainnet ? '' : 'testnet/'
        const url = `${this.baseUrl}/ethereum/erc-20/${network}${tokenAddress}/dashboards/address`
        let results = await Promise.all(
            addresses.map(address =>
                blockchairFetch(
                    `${url}/${address}?${params}`,
                    options,
                    this.timeout,
                )
            )
        )
        if (!isMultiQuery) return results[0]
        if (!combine) return results
        return results.reduce((obj, next) => ({
            ...obj,
            ...(next && next.data),
        }), {})
    }
}

/**
 * @name    blockchairFetch
 * @summary simplifies `Blockchair` requests and  catches `context.error` if available
 * 
 * @param   {...}   args arguments supported by `PromisE.fetch`
 * 
 * @returns {*}
 */
const blockchairFetch = async (...args) => {
    try {
        const result = await PromisE.fetch(...args)
        const { context } = result
        if (context && context.error) throw result
        return result
    } catch (err) {
        // capture Blockchair error message if available
        const { context } = err
        const hasContextError = isObj(context)
            && context
            && context.error
        if (hasContextError) throw context.error
        throw err
    }
}

/**
 * @name    setErrorMessages
 * @summary allows to override default error messages. ie: for translation.
 * 
 * @param   {Object} obj 
 * 
 * @returns {Object} all error messages after merge
 */
export const setErrorMessages = (obj = {}) => messages = { ...messages, obj }