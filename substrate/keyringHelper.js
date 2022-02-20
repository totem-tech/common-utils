import { bytesToHex, ss58Decode } from '../convert'
import { isObj, isStr, isUint8Arr, objHasKeys } from '../utils'

/**
 * @name    KeyringHelper
 * @summary A helper class with most commonly used functions for managing identities using the PolkadotJS Keyring.
 * 
 * @param   {String}    type    (optional) Default: 'sr25519'
 * @param   {Object}    keyring (optional) Default: new Keyring({type})
 */
export class KeyringHelper {
    constructor(type = 'sr25519', keyring) {
        const Keyring = require('@polkadot/keyring').default
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
                const pair = require('@polkadot/keyring')
                    .createPair(this.type, { secretKey, publicKey })
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
     * @param   {String} create
     * 
     * @returns {Object}
     */
    getPair = (address, create = false) => {
        try {
            // test if @secretKey is an address already added to the keyring
            return this.keyring.getPair(address)
        } catch (_) {
            if (create) return this.keyring.addFromAddress(address)
        }
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

    /**
     * @name    signature
     * @summary create a new signature using an idenitity from the keyring
     * 
     * @param   {String|Uint8Array} address 
     * @param   {String|Uint8Array} message 
     * 
     * @returns {String} hex signature
     */
    signature = async (address, message) => {
        const pair = this.getPair(address)
        if (!address) return null

        if (!isStr(message)) message = JSON.stringify(message)
        const signature = pair.sign(message)
        return bytesToHex(signature)
    }

    /**
     * @name    signatureVerify
     * @summary verify a signature created using any identity
     * 
     * @param   {String|Uint8Array} message 
     * @param   {String|Uint8Array} signature 
     * @param   {String|Uint8Array} address 
     * 
     * @returns {Boolean}
     */
    signatureVerify = async (message, signature, address) => {
        const publicKey = ss58Decode(address)

        if (!isStr(message)) message = JSON.stringify(message)
        return this
            .getPair(address, true)
            .verify(
                message,
                signature,
                publicKey,
            )
    }
}

// Default/global keyring
let instance = null
export default () => {
    instance = instance || new KeyringHelper()
    return instance
}
