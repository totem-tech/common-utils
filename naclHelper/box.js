import {
    bytesToHex,
    hexToBytes,
    u8aToStr,
    strToU8a,
} from '../convert'
import {
    keyDataFromEncoded,
    newNonce,
} from './utils'

/**
 * @name    decrypt
 * @summary decrypted a message encrypted using TweetNacl Box depryption (open) mechanism
 *
 * @param   {String|Uint8Array} sealed  data to encrypt
 * @param   {String|Uint8Array} nonce
 * @param   {String|Uint8Array} senderPublicKey
 * @param   {String|Uint8Array} recipientSecretKey
 * @param   {Boolean}
 *
 * @returns {String|Uint8Array} decrypted message
 */
export const decrypt = (sealed, nonce, senderPublicKey, recipientSecretKey, asString = true) => {
    const decrypted = require('tweetnacl').box.open(
        hexToBytes(sealed),
        hexToBytes(nonce),
        hexToBytes(senderPublicKey),
        hexToBytes(recipientSecretKey),
    )
    if (!decrypted) return decrypted
    return !asString
        ? decrypted
        : u8aToStr(decrypted)
}

/**
 * @name encrypt
 * @description encrypt a message using TweetNacl Box seal encryption
 *
 * @param   {String|Uint8Array} message             data to encrypt
 * @param   {String|Uint8Array} senderSecretKey     hex string or bytes array
 * @param   {String|Uint8Array} recipientPublicKey  hex string or bytes array
 * @param   {String|Uint8Array} nonce               (optional) if undefined, will generate new nonce
 * @param   {Boolean}           asHex               whether to convert to hex or reutrn Uint8Array
 *
 * @returns {{
 *  sealed: String|Uint8Array,
 *  nonce: String|Uint8Array,
 * }}
 */
export const encrypt = (message, senderSecretKey, recipientPublicKey, nonce, asHex = true) => {
    nonce = !!nonce
        ? hexToBytes(nonce)
        : newNonce(false)
    const result = require('tweetnacl').box(
        strToU8a(message),
        nonce,
        hexToBytes(recipientPublicKey),
        hexToBytes(senderSecretKey),
    )
    return {
        sealed: !asHex
            ? result
            : bytesToHex(result),
        nonce: asHex
            ? bytesToHex(nonce)
            : hexToBytes(nonce)
    }
}

/**
 * @name    encryptionKeypair
 * @summary generate encryption keypair from identity (oo7-substrate library's `keyData` or PolkadotJS's `encoded`)
 * 
 * @param   {String|Uint8Array}    keyData hex string (keyData or encoded)
 * @param   {Boolean}   asHex   whether to convert to `publicKey` and `secretKey` to hex string or keep as Uint8Array
 *  
 * @returns {{
 *  publicKey: String|Uint8Array,
 *  secretKey: String|Uint8Array,
 * }}
 */
export const encryptionKeypair = (keyData, asHex = true) => {
    const bytes = keyDataFromEncoded(keyData)
    const { fromSecretKey } = require('tweetnacl').box.keyPair
    const { blake2b } = require('blakejs')
    const pair = fromSecretKey(blake2b(bytes, null, 32))
    return !asHex
        ? pair
        : {
            publicKey: bytesToHex(pair.publicKey),
            secretKey: bytesToHex(pair.secretKey),
        }
}

export default {
    decrypt,
    encrypt,
    keypairFromIdentity: encryptionKeypair,
}