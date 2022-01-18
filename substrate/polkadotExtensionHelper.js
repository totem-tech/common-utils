import { isFn } from '../utils'

export default class PolkadotExtension {
    constructor(dAppName) {
        this.ext = require('@polkadot/extension-dapp')
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
        if (!isFn(callback)) return await this.ext.web3Accounts()

        return await this.ext.web3AccountsSubscribe(callback)
    }

    /**
     * @name    enable
     * @summary enable PolkadotJS extension
     * 
     * @returns {*} result
     */
    enable = async () => await this.ext.web3Enable(this.dAppName || 'Unnamed dapp')

    fromAddress = async (address) => await this.ext.web3FromAddress(address)

    listRpcProviders = async () => await this.ext.web3ListRpcProviders()
}