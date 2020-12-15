import { blake2b } from 'blakejs'
import {
    // secret key encryption
    naclDecrypt as naclDecrypt1,
    naclEncrypt as naclEncrypt1,
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
import { isStr } from '../../../totem-ui/src/utils/utils'

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
    return !asString
        ? decrypted
        : u8aToStr(decrypted)
}

/**
 * @name encrypt
 * @description encrypt a message using TweetNacl Box seal encryption
 *
 * @param   {String|Uint8Array} message data to encrypt. String|Uint8Array
 * @param   {String|Uint8Array} senderSecretKey
 * @param   {String|Uint8Array} receiverPublicKey 
 * @param   {String|Uint8Array} nonce (optional) if undefined, will generate new nonce
 * @param   {Boolean}           asHex whether to convert to hex or reutrn Uint8Array
 *
 * @returns Object `{sealed, nonce}`
 */
export const encrypt = (message, senderSecretKey, receiverPublicKey, nonce, asHex = true) => {
    const result = naclSeal(
        isUint8Arr(message)
            ? message
            : strToU8a(message),
        hexToBytes(senderSecretKey),
        hexToBytes(receiverPublicKey),
        hexToBytes(nonce), // Nonce: auto generated with 24 bit length
    )
    return !asHex ? result : {
        sealed: bytesToHex(result.sealed),
        nonce: bytesToHex(result.nonce)
    }
}

/**
 * @name    encryptionKeypair
 * @summary generate encryption keypair from oo7-substrate library's `keyData` or PolkadotJS's `encoded`
 * 
 * @param   {String}    keyData hex string
 * @param   {Boolean}   asHex   whether to convert to `publicKey` and `secretKey` to hex string or keep as Uint8Array
 * 
 * @returns {Object}    { publicKey, secretKey }
 */
export const encryptionKeypair = (keyData, asHex = true) => {
    const bytes = keyDataFromEncoded(keyData)
    const pair = naclBoxKeypairFromSecret(blake2b(bytes, null, 32))
    return !asHex
        ? pair
        : {
            publicKey: bytesToHex(pair.publicKey),
            secretKey: bytesToHex(pair.secretKey),
        }
}

/**
 * @name    keyDateFromEncoded
 * @summary converts PolkadotJS keyring's `encoded` hex string to oo7-substrate style `keyData`, if required
 * 
 * @param   {String|Uint8Array} encoded hex string or bytes array. (Encoded: 117 bytes, KeyData: 96 bytes)
 * @param   {Boolean}           asHex   (optional) Default: false
 * 
 * @returns Uint8Array/String
 */
export const keyDataFromEncoded = (encoded, asHex = false) => {
    // convert to Uint8Array if required
    encoded = isUint8Arr(encoded)
        ? encoded
        : hexToBytes(encoded)
    
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
 *                                         Default: 0 (Polkadot)
 * @param   {Boolean}           asHex      (optional) if true, will convert `publicKey` and `secretKey` to hex string.
 *                                         Otherwise, will leave as Uint8Array.
 *                                         Default: false
 * 
 * @returns {Object}    { address, publicKey, secretKey }
 */
export const keyInfoFromKeyData = (keyData = '', ss58Format = 0, asHex = false) => {
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
 * @name    newSignature
 * @summary generate a new signature using keypair and a message
 * 
 * @param   {String}    message 
 * @param   {String}    publicKey 
 * @param   {String}    secretKey   
 * @param   {Boolean}   asHex       (optional) Default: true
 * 
 * @returns {String|Uint8Array} String Hex if `asHex = true`, otherwise, Uint8Array
 */
export const newSignature = (message, publicKey, secretKey, asHex = true) => {
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
    const bytes = randomAsU8a(length)
    return !asHex
        ? bytes
        : bytesToHex(bytes)
}

/**
 * @name    naclDecrypt
 * @summary decrypt an message that was encrytped using TweetNaclJS SecretBox (AKA secret key) encryption
 * 
 * @param   {*} encrypted 
 * @param   {*} nonce 
 * @param   {*} secret 
 * @param   {*} asString
 */
export const secretBoxDecrypt = (encrypted, nonce, secret, asString = true) => {
    const decrypted = naclDecrypt1(
        isUint8Arr(encrypted)
            ? encrypted
            : hexToBytes(encrypted),
        isUint8Arr(nonce)
            ? nonce
            : hexToBytes(nonce),
        isUint8Arr(secret)
            ? secret
            : hexToBytes(secret),
    )
    return !asString
        ? decrypted
        : u8aToStr(decrypted)
}

/**
 * @name    naclEncrypt
 * @summary encrypt a message using TweetNaclJS SecretBox (AKA secret key) encryption.
 *          All strings in the params are expected to be valid hex.
 * 
 * @param   {String|Uint8Array} message message to encrypt
 * @param   {String|Uint8Array} secret  secret key
 * @param   {String|Uint8Array} nonce   (optional) if falsy, a new nonce will be generated
 * @param   {Boolean}           asHex   (optional) whether to return encrypted message as bytes or hex string
 *                                      Default: true
 * 
 * @returns {Object}    `{ encrypted, nonce }`
 */
export const secretBoxEncrypt = (message, secret, nonce, asHex = true) => {
    nonce = nonce || newNonce(false) // generate new nonce
    const result = naclEncrypt1(
        isUint8Arr(message)
            ? message
            : strToU8a( // convert to Uint8Array
                isStr(message)
                    ? message
                    : JSON.stringify(message) // convert to string
            ),
        isUint8Arr(secret)
            ? secret
            : hexToBytes(secret),
        isUint8Arr(nonce)
            ? nonce
            : hexToBytes(nonce),
    )
    if (!asHex) return result
    return {
        encrypted: bytesToHex(result.encrypted),
        nonce: bytesToHex(result.nonce),
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
    const pair = naclKeypairFromSeed(blake2b(bytes, null, 32))
    return !asHex
        ? pair
        : {
            publicKey: bytesToHex(pair.publicKey),
            secretKey: bytesToHex(pair.secretKey),
        }
}

/**
 * @name    verifySignature
 * @summary verify if a signature is valid
 *
 * @param   {String|Uint8Array} message String|Uint8Array
 * @param   {String|Uint8Array} signature String|Uint8Array
 * @param   {String|Uint8Array} publicKey String|Uint8Array
 *
 * @returns {Boolean}
 */
export const verifySignature = naclVerify

export default {
    decrypt,
    encrypt,
    encryptionKeypair,
    keyDataFromEncoded,
    keyInfoFromKeyData,
    newNonce,
    newSignature,
    randomBytes,
    secretBoxDecrypt,
    secretBoxEncrypt,
    signingKeyPair,
    verifySignature,
}