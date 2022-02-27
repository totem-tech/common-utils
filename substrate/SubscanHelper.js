import PromisE from "../PromisE"
import { isValidURL } from "../utils"

export default class SubscanHelper {
    constructor(apiBaseURL, apiKey) {
        const valid = !isValidURL(this.apiBaseURL) || !`${this.apiBaseURL}`.contains('subscan.io')
        if (!valid) throw new Error('Invalid subscan.io API endpoint')

        this.apiBaseURL = `${apiBaseURL}`
        this.apiKey = apiKey
    }

    query = async (path, data, options) => {
        const protocol = this.apiBaseURL.startsWith('https://')
            ? ''
            : 'https://'
        const slash = this.apiBaseURL.endsWith('/')
            ? ''
            : '/'
        const url = `${protocol}${this.apiBaseURL}${slash}${path}`
        options.method ??= 'post'
        data = {
            ...data,
            page: data?.page || 1,
            // no idea what it is but query fails without it! no explanation in the subscan.io docs! 
            row: data?.row || 1,

        }
        options.body = JSON.stringify(data)
        options.headers = {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            ...options.headers,
        }

        return await PromisE.fetch(url, options)
    }

    /**
     * @name    parachainGetList
     * @summary get a list of parachains. 
     * @description API documentation can be found here: https://docs.api.subscan.io/#parachain-list
     * 
     * @returns {Array}
     */
    parachainGetList = async () => {
        const result = await this.query('api/scan/parachain/list')
        return result?.data?.chains || []
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
        const result = await this.query(
            'api/scan/parachain/funds',
            { para_id: parachainId },
        )

        return result?.data?.funds || []
    }
}