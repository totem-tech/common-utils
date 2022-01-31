import { isFn } from '../utils'

/**
 * @name    ExtensionHelper
 * @summary class container commonly used helper functions to interact with PolkadotJS Browser Extension
 * 
 * @param   {String}    dAppName    A name for your DApp
 */
export default class ExtensionHelper {
    constructor(dAppName) {
        this.web3 = require('@polkadot/extension-dapp')
        this.dAppName = dAppName
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
     * @name    enable
     * @summary enable PolkadotJS extension
     * 
     * @returns {*} result
     */
    enable = async () => await this.web3.web3Enable(this.dAppName || 'Unnamed dapp')

    fromAddress = async (address) => {
        try {
            return await this.web3.web3FromAddress(address)
        } catch (err) {

        }
    }

    /**
     * @name    get
     * @summary get injector from extension
     * @param {*} address 
     * @returns 
     */
    get = async (address) => await this.fromAddress(address)

    listRpcProviders = async () => await this.web3.web3ListRpcProviders()
}