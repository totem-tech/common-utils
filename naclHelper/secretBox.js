import {
    bytesToHex,
    hexToBytes,
    u8aToStr,
    strToU8a,
} from '../convert'
import { generateHash } from '../utils'
import { newNonce } from './utils'

/**
 * @name    naclDecrypt
 * @summary decrypt an message that was encrytped using TweetNaclJS SecretBox (AKA "secret key") encryption
 * 
 * @param   {String|Uint8Array} encrypted 
 * @param   {String|Uint8Array} nonce 
 * @param   {String|Uint8Array} secret
 * @param   {Boolean}           asString (optional) Default: `true`
 */
export const secretBoxDecrypt = (encrypted, nonce, secret, asString = true) => {
    const decrypt = require('tweetnacl').secretbox.open
    const decrypted = decrypt(
        hexToBytes(encrypted),
        hexToBytes(nonce),
        hexToBytes(secret),
    )
    return !asString
        ? decrypted
        : u8aToStr(decrypted)
}

/**
 * @name    naclEncrypt
 * @summary encrypt a message using TweetNaclJS SecretBox (AKA "secret key") encryption.
 *          All strings in the params are expected to be valid hex.
 * 
 * @param   {String|Uint8Array} message message to encrypt
 * @param   {String|Uint8Array} secret  32 bytes secret key (hex or bytes array)
 * @param   {String|Uint8Array} nonce   (optional) if falsy, a new nonce will be generated
 * @param   {Boolean}           asHex   (optional) whether to return encrypted message as bytes or hex string
 *                                      Default: true
 * 
 * @returns {Object}    `{ encrypted, nonce }`
 */
export const secretBoxEncrypt = (message, secret, nonce, asHex = true) => {
    nonce = nonce || newNonce(false) // generate new nonce
    const encrypt = require('tweetnacl').secretbox
    const result = encrypt(
        strToU8a(message),
        hexToBytes(nonce),
        hexToBytes(secret),
    )
    if (!result) return result

    return {
        encrypted: asHex
            ? bytesToHex(result)
            : hexToBytes(result),
        nonce: asHex
            ? bytesToHex(nonce)
            : hexToBytes(nonce),
    }
}

/**
 * @name    secretBoxKeyFromPW
 * @summary generates a TweetNacl SecretBox compatible secret key (hex string) from supplied seed/password
 * 
 * @param   {String}    password
 * 
 * @returns {String}    hex string
 */
export const secretBoxKeyFromPW = password => generateHash(
    password,
    'blake2',
    256, // DO NOT CHANGE
)

export default {
    decrypt: secretBoxDecrypt,
    encrypt: secretBoxEncrypt,
    keyFromPW: secretBoxKeyFromPW,
}