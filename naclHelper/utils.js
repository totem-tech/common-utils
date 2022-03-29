import { isArr, isHex, isObj, isUint8Arr, objCopy } from "../utils"
import {
    bytesToHex,
    hexToBytes,
    ss58Encode,
    u8aToStr,
    strToU8a,
} from "../convert"

/**
 * @name    keyDataFromEncoded
 * @summary converts PolkadotJS keyring's `encoded` hex string to oo7-substrate style `keyData`, if required
 * 
 * @param   {String|Uint8Array} encoded hex string or bytes array. (Encoded: 117 bytes, KeyData: 96 bytes)
 * @param   {Boolean}           asHex   (optional) Default: false
 * 
 * @returns Uint8Array/String
 */
export const keyDataFromEncoded = (encoded, asHex = false) => {
    // convert to Uint8Array if required
    encoded = hexToBytes(encoded)

    // Convert PolkadotJS keyring's `encoded` to oo7-substrate `keyData`
    if (encoded.length > 96) {
        encoded = new Uint8Array([
            ...encoded.slice(16, 80),
            ...encoded.slice(85)
        ])
    }
    return !asHex
        ? encoded
        : bytesToHex(encoded)
}

/**
 * @name    keyInfoFromKeyData
 * @summary generates keypair and Polkadot address from encoded or keyData.
 * @description FYI: the generated keypair is not an encryption or signing keypair.
 * 
 * @param   {String|Uint8Array} keyData 
 * @param   {Number}            ss58Format (optional) use to generate address for any supported parachain identity.
 *                                         Default: undefined (Substrate)
 * @param   {Boolean}           asHex      (optional) if true, will convert `publicKey` and `secretKey` to hex string.
 *                                         Otherwise, will leave as Uint8Array.
 *                                         Default: false
 * 
 * @returns {Object}    { address, publicKey, secretKey }
 */
export const keyInfoFromKeyData = (keyData = '', ss58Format = undefined, asHex = false) => {
    let bytes = keyDataFromEncoded(keyData, false)
    const publicKey = bytes.slice(64, 96)
    const secretKey = bytes.slice(0, 64)
    return {
        address: ss58Encode(publicKey, ss58Format),
        publicKey: asHex
            ? bytesToHex(publicKey)
            : publicKey,
        secretKey: asHex
            ? bytesToHex(secretKey)
            : secretKey
    }
}

/**
 * @name    newNonce
 * @summary generate a new random 24 bytes nonce
 * 
 * @param   {Boolean}   (optional) Default: true
 * 
 * @returns {Uint8Array|String}
 */
export const newNonce = (asHex = true) => randomBytes(24, asHex)

/**
 * @name    randomBytes
 * @summary generate random bytes for use as nonce or bytes for keypair generation
 * 
 * @param   {Number} length 
 * @param   {Boolean} asHex 
 * 
 * @returns {Uint8Array|String}
 * 
 * @example
 * ```javascript
 * // generate random bytes to be used to generate encryption or signing keypair
 * const keyData = randomBytes(96, true)  // equivalent to oo7-substrate's `keyData`
 * const encryptKP = encryptionKeypair(keyData, true)
 * console.log({ keyData, encryptKP })
 * 
 * const encoded = randomBytes(117) // equivalent to PolkadotJS keyring's `encoded`
 * const signKP = signingKeyPair(encoded, true)
 * console.log({ encoded, signKP})
 * ```
 */
export const randomBytes = (length, asHex = true) => {
    const bytes = require('tweetnacl').randomBytes(length)
    return !asHex
        ? bytes
        : bytesToHex(bytes)
}