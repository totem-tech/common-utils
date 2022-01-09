import Keyring, { createPair } from '@polkadot/keyring'
import { bytesToHex } from '../convert'
import { isObj, isUint8Arr, objHasKeys } from '../utils'

/**
 * @name    KeyringHelper
 * @summary A helper class with most commonly used functions for managing identities using the PolkadotJS Keyring.
 * 
 * @param   {String}    type    (optional) Default: 'sr25519'
 * @param   {Keyring}   keyring (optional) Default: new Keyring({type})
 */
export class KeyringHelper {
    constructor(type = 'sr25519', keyring) {
        //Instantiate a new keyring instance if not provided
        this.keyring = keyring || new Keyring({ type })
        this.type = type
    }
    /**
     * @name    add
     * @summary add identities to the keyring
     * 
     * @param   {Array} seeds   array of uri/seeds or objects with properties: secretKey & publicKey
     * 
     * @returns {Array} array of keypairs
     */
    add = (seeds = []) => seeds.map(seed => {
        try {
            if (isUint8Arr(seed)) {
                seed = bytesToHex(seed)
            } else if (isObj(seed) && objHasKeys(seed, ['secretKey', 'publicKey'])) {
                const { secretKey, publicKey } = seed
                const pair = createPair(this.type, { secretKey, publicKey })
                return this.keyring.addPair(pair)
            }
            return this.keyring.addFromUri(seed)
        } catch (error) {
            console.log('Failed to add seed to keyring', error)
        }
    })

    /**
     * @name    contains
     * @summary contains checks if identity exists in the keyring
     *
     * @param   {String|Uint8Array} address 
     *
     * @returns {Boolean}
     */
    contains = address => !!this.getPair(address)

    /**
     * @name    getPair
     * @summary get keypair from address without throwing error if not found
     * 
     * @param   {String} address 
     * 
     * @returns {Object}
     */
    getPair = address => {
        try {
            // test if @secretKey is an address already added to the keyring
            return this.keyring.getPair(address)
        } catch (_) { }
    }

    /**
     * @name    remove
     * @summary remove a pair from the keyring
     * 
     * @param   {String} address 
     * 
     * @returns {Boolean}   indicates success/failure
     */
    remove = address => this.contains(address) && !this.keyring.removePair(address)
}

// Default/global keyring
export default new KeyringHelper()
