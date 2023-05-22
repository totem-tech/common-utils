import {
    bytesToHex,
    hexToBytes,
    strToU8a,
} from '../convert'
import { keyDataFromEncoded } from './utils'

/**
 * @name    newSignature
 * @summary generate a new detached signature using keypair and a message
 * 
 * @param   {String}    message 
 * @param   {String}    secretKey   
 * @param   {Boolean}   asHex       (optional) Default: true
 * 
 * @returns {String|Uint8Array} String Hex if `asHex = true`, otherwise, Uint8Array
 */
export const newSignature = (message, secretKey, asHex = true) => {
    const signature = require('tweetnacl').sign.detached(
        strToU8a(message),
        hexToBytes(secretKey),
    )
    return !asHex
        ? signature
        : bytesToHex(signature)
}

/**
 * @name    randomKeypair
 * @summary generate a random signing keypair
 * 
 * @param   {Boolean}   asHex   (optional) Default: `true`
 * 
 * @returns {Object}    `{ publicKey, secretKey }`
 */
export const randomKeypair = (asHex = true) => {
    const { keyPair } = require('tweetnacl').sign
    const pair = keyPair()
    return !asHex
        ? pair
        : {
            publicKey: bytesToHex(pair.publicKey),
            secretKey: bytesToHex(pair.secretKey),
        }
}

/**
 * @name    signingKeyPair
 * @summary generate TweetNacl signing keypair using `keyData` (oo7-substrate) or `encoded` (PolkadotJS) hex string.
 * 
 * @param   {String|Uint8Array} keyData 
 * @param   {Boolean}           asHex   (optional) Default: true
 * 
 * @returns {Object}            `{ publicKey, secretKey }`
 */
export const signingKeyPair = (keyData, asHex = true) => {
    const bytes = keyDataFromEncoded(keyData)
    const { blake2b } = require('blakejs')
    const { fromSeed } = require('tweetnacl').sign.keyPair
    const pair = fromSeed(blake2b(bytes, null, 32))
    return !asHex
        ? pair
        : {
            publicKey: bytesToHex(pair.publicKey),
            secretKey: bytesToHex(pair.secretKey),
        }
}

/**
 * @name    verifySignature
 * @summary verify a detached signature
 *
 * @param   {String|Uint8Array} message 
 * @param   {String|Uint8Array} signature
 * @param   {String|Uint8Array} publicKey
 *
 * @returns {Boolean}
 */
export const verifySignature = (message, signature, publicKey) => {
    const { verify } = require('tweetnacl').sign.detached
    return verify(
        strToU8a(message),
        hexToBytes(signature),
        hexToBytes(publicKey),
    )
}

export default {
    keypairFromEncoded: signingKeyPair,
    randomKeypair,
    signDetached: newSignature,
    verifyDetached: verifySignature,
}