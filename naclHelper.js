import { blake2b } from 'blakejs'
import {
    // secret key encryption
    naclDecrypt,
    naclEncrypt,
    naclKeypairFromString,
    naclKeypairFromSeed,
    naclKeypairFromSecret,
    // box encrypt
    naclBoxKeypairFromSecret,
    naclSeal,
    naclOpen,
    // singature
    naclSign,
    naclVerify,
    randomAsU8a,
} from '@polkadot/util-crypto'
import { isUint8Arr } from "./utils"
import {
    bytesToHex,
    hexToBytes,
    ss58Encode,
    u8aToStr,
    strToU8a,
} from "./convert"

/**
 * @name newNonce ununsed
 * @description generate a new random nonce of specific size
 * 
 * @param {Number} length default 24
 * @returns {Array} [Uint8Array, String]
 */
export const newNonce = (length = 24, asHex = true) => {
    const bytes = randomAsU8a(length)
    return !asHex ? bytes : bytesToHex(bytes)
}

/**
* @name encrypt
* @description encrypt a message using TweetNacl Box seal encryption
*
* @param {String} message data to encrypt. String|Uint8Array
* @param {String} senderSecretKey String|Uint8Array
* @param {String} receiverPublicKey String|Uint8Array
* @param {String} nonce (optional) String|Uint8Array
* @param {Boolean} asHex whether to convert to hex or reutrn Uint8Array
*
* @returns Object {sealed, nonce}
*/
export const encrypt = (message, senderSecretKey, receiverPublicKey, nonce, asHex = true) => {
    const result = naclSeal(
        isUint8Arr(message) ? message : strToU8a(message),
        hexToBytes(senderSecretKey),
        hexToBytes(receiverPublicKey),
        nonce, // Nonce: auto generated with 24 bit length
    )
    return !asHex ? result : {
        sealed: bytesToHex(result.sealed),
        nonce: bytesToHex(result.nonce)
    }
}

/**
* @name decrypt
* @description decrypted a message encrypted using TweetNacl Box depryption (open) mechanism
*
* @param {String} sealed String|Uint8Array. data to encrypt
* @param {String} nonce String|Uint8Array
* @param {String} senderPublicKey String|Uint8Array
* @param {String} receiverSecretKey String|Uint8Array
*
* @returns String decrypted message
*/
export const decrypt = (sealed = '', nonce = '', senderPublicKey = '', receiverSecretKey = '', asString = true) => {
    const decrypted = naclOpen(
        hexToBytes(sealed),
        hexToBytes(nonce),
        hexToBytes(senderPublicKey),
        hexToBytes(receiverSecretKey),
    )
    if (!decrypted) return decrypted
    return !asString ? decrypted : u8aToStr(decrypted)
}

/**
 * @name newSignature
 * @summary generate a new signature using key pair and a message
 * 
 * @param {String} message 
 * @param {String} publicKey 
 * @param {String} secretKey 
 * @param {Boolean} asHex default: true
 * 
 * @returns {String|Uint8Array} String Hex if `asHex = true`, otherwise, Uint8Array
 */
export const newSignature = (message = '', publicKey = '', secretKey = '', asHex = true) => {
    const signature = naclSign(
        message,
        {
            publicKey: hexToBytes(publicKey),
            secretKey: hexToBytes(secretKey),
        }
    )
    return !asHex ? signature : bytesToHex(signature)
}

/**
 * @name verifySignature
 * @summary verify if a signature is valid
 *
 * @param {String|Uint8Array} message String|Uint8Array
 * @param {String|Uint8Array} signature String|Uint8Array
 * @param {String|Uint8Array} publicKey String|Uint8Array
 *
 * @returns Boolean
 */
export const verifySignature = naclVerify

/**
 * @name    keyDateFromEncoded
 * @summary converts Polkadot keypair `encoded` hex to `oo7` style keyData, if required
 * 
 * @param {Uint8Array} encoded 
 * @param {Boolean} asHex default: false
 * 
 * @returns Uint8Array/String
 */
export const keyDataFromEncoded = (encoded, asHex = false) => {
    encoded = isUint8Arr(encoded) ? encoded : hexToBytes(encoded)
    if (encoded.length > 96) {
        // Polkadot keypair encoded identity
        encoded = new Uint8Array([
            ...encoded.slice(16, 80),
            ...encoded.slice(85)
        ])
    }
    return !asHex ? encoded : bytesToHex(encoded)
}

export const keyInfoFromKeyData = (keyData = '') => {
    let bytes = keyDataFromEncoded(keyData, false)
    return {
        address: ss58Encode(bytes.slice(64, 96)),
        publicKey: bytes.slice(64, 96),
        secretKey: bytes.slice(0, 64)
    }
}

export const encryptionKeypair = (keyData, asHex = true) => {
    const bytes = keyDataFromEncoded(keyData)
    const pair = naclBoxKeypairFromSecret(blake2b(bytes, null, 32))
    return !asHex ? pair : {
        publicKey: bytesToHex(pair.publicKey),
        secretKey: bytesToHex(pair.secretKey),
    }
}

export const signingKeyPair = (keyData, asHex = true) => {
    const bytes = keyDataFromEncoded(keyData)
    const pair = naclKeypairFromSeed(blake2b(bytes, null, 32))
    return !asHex ? pair : {
        publicKey: bytesToHex(pair.publicKey),
        secretKey: bytesToHex(pair.secretKey),
    }
}

export default {
    encrypt,
    decrypt,
    newSignature,
    verifySignature,
    keyInfoFromKeyData,
    encryptionKeypair,
    signingKeyPair,
}