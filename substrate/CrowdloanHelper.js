import { bytesToHex, hexToBytes, ss58Decode, ss58Encode } from "../convert"
import { isArr, isHex, isUint8Arr } from "../utils"
import BlockchainHelper from './BlockchainHelper'

/**
 * @name    CrowdloanHelper
 * 
 * @param   {BlockchainHelper} blockchainHelper 
 */
export default class CrowdloanHelper {
    constructor(blockchainHelper, parachainId) {
        if (!(blockchainHelper instanceof BlockchainHelper)) throw new Error('Invalid BlockchainHelper!')
        this.blockchainHelper = blockchainHelper
        this.query = blockchainHelper.query
        this.parachainId = parachainId
    }

    /**
     * @name    getContributions
     * @summary fetch user contributions by identities
     * 
     * @param   {String|Array}  addresses 
     * @param   {Number}        parachainId Default: `this.parachainId`
     * @param   {Boolean}       asString    
     * @param   {Number}        decimals 
     * 
     * @returns {Number|Map}    
     */
    getContributions = async (addresses, asString, decimals, parachainId = this.parachainId) => {
        const multi = isArr(addresses)
        if (!multi) addresses = [addresses]

        const idHexes = addresses.map(
            address => isHex(address)
                ? address
                : bytesToHex(
                    isUint8Arr(address)
                        ? address
                        : ss58Decode(address)
                )
        )
        const contributions = await this.query(
            'api.derive.crowdloan.ownContributions',
            [parachainId, idHexes],
        )
        const result = new Map()
        // convert hex amounts to number and format to correct unit values
        Object
            .keys(contributions)
            .forEach((idHex, i) => {
                const amountHex = contributions[idHex]
                const amountFormatted = this.blockchainHelper.formatAmount(
                    parseInt(amountHex, 16),
                    asString,
                    decimals,
                )
                result.set(addresses[i], amountFormatted)
            })

        return multi
            ? result
            : Array.from(result)[0][1]
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