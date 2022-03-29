import { bytesToHex, hexToBytes, ss58Decode, strToHex } from '../convert'
import { isFn, isHex, isNodeJS, isStr, isUint8Arr } from '../utils'

/**
 * @name    ExtensionHelper
 * @summary class container commonly used helper functions to interact with PolkadotJS Browser Extension
 * 
 * @param   {String}    dAppName    A name for your DApp
 */
export default class ExtensionHelper {
    constructor(dAppName) {
        if (isNodeJS()) throw new Error('PolkadotJS ExtensionHelper can only be used from a browser!')

        this.dAppName = dAppName
        this.web3 = require('@polkadot/extension-dapp')
    }

    /**
     * @name    accounts
     * @summary retrieve or subscribe to PolkadotJS extension accounts/identities
     * 
     * @param   {Function} callback (optional) if function, will subscribe to changes on the list of PolkadotJS 
     *                              extension accounts.
     *                              Functions arguments:
     *                              - result
     * @returns {Array|Function}
     */
    accounts = async (callback) => {
        if (!isFn(callback)) return await this.web3.web3Accounts()

        return await this.web3.web3AccountsSubscribe(callback)
    }

    /**
     * @name    checkInjected
     * @summary check if PolkadotJS extension injection was successful
     * 
     * @returns {Boolean}
     */
    checkInjected = () => this.web3.isWeb3Injected

    /**
     * @name    enable
     * @summary enable PolkadotJS extension
     * 
     * @returns {*} result
     */
    enable = async () => await this.web3.web3Enable(this.dAppName || 'Unnamed DApp')

    /**
     * @name    fromAddress
     * @summary get injector from extension
     * 
     * @param   {String} address 
     * 
     * @returns {Object}
     */
    fromAddress = async (address) => {
        try {
            return await this.web3.web3FromAddress(address)
        } catch (err) {

        }
    }

    /**
     * @name    getSigner
     * @summary get transaction signer for an injected identity by address
     * 
     * @param   {String} address 
     * 
     * @returns {*} signer
     */
    getSigner = async (address) => {
        const { signer } = (await this.fromAddress(address)) || {}
        return signer
    }

    listRpcProviders = async () => await this.web3.web3ListRpcProviders()

    /**
     * @name    signature
     * @summary create a signature using an identity from PolkadotJS extension. (User approval required)
     * 
     * @param   {String|Uint8Array} address 
     * @param   {String|Uint8Array} message 
     * 
     * @returns {String} hex string
     */
    signature = async (address, message) => {
        const signer = await this.getSigner(address)
        const { signRaw } = signer || {}
        if (!signRaw) return null

        const { signature } = await signRaw({
            address,
            data: message,
        })

        return signature
    }
}