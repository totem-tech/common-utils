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
import { isArr, isHex, isObj, isStr, isUint8Arr, objCopy } from "./utils"
import {
    bytesToHex,
    hexToBytes,
    ss58Encode,
    u8aToStr,
    strToU8a,
} from "./convert"

/**
 * @name decrypt
 * @description decrypted a message encrypted using TweetNacl Box depryption (open) mechanism
 *
 * @param {String} sealed String|Uint8Array. data to encrypt
 * @param {String} nonce String|Uint8Array
 * @param {String} senderPublicKey String|Uint8Array
 * @param {String} recipientSecretKey String|Uint8Array
 *
 * @returns String decrypted message
 */
export const decrypt = (sealed = '', nonce = '', senderPublicKey = '', recipientSecretKey = '', asString = true) => {
    const decrypted = naclOpen(
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
 * @param   {String|Uint8Array} message data to encrypt. String|Uint8Array
 * @param   {String|Uint8Array} senderSecretKey
 * @param   {String|Uint8Array} recipientPublicKey 
 * @param   {String|Uint8Array} nonce (optional) if undefined, will generate new nonce
 * @param   {Boolean}           asHex whether to convert to hex or reutrn Uint8Array
 *
 * @returns Object `{sealed, nonce}`
 */
export const encrypt = (message, senderSecretKey, recipientPublicKey, nonce, asHex = true) => {
    const result = naclSeal(
        strToU8a(message),
        hexToBytes(senderSecretKey),
        hexToBytes(recipientPublicKey),
        !!nonce
            ? hexToBytes(nonce)
            : newNonce(false),
    )
    return !asHex ? result : {
        sealed: bytesToHex(result.sealed),
        nonce: bytesToHex(result.nonce)
    }
}

/**
 * @name    encryptObj
 * @summary recursively encrypt specified or all properties of an object.
 * 
 * @param   {Object}            obj 
 * @param   {Array}             keys (optional) if valid array, only specified object properties will be encrypted.
 * @param   {String|Uint8Array} secretKey 
 * @param   {String|Uint8Array} recipientPublicKey 
 * @param   {String|Uint8Array} nonce (optional) a single nonce to encrypt the entire object.
 *                                    If not 
 * 
 * 
 * @returns {Object} ```json
 *     {
 *         sealed: String, // if isBox === true
 *         encrypted: string, // if isBox === false
 *         nonce: String,  
 *         isBox: Boolean, // indicates whether encrypted using SecretBox or Box
 *     }
 * ```
 * 
 * 
 * @example ```javascript
 * // object to encrypt
 * const obj = {
 *     first: 'some text',
 *     second: 1,
 *     third: 'ignored property',
 *     nonce: 'special property will not be encrypted unless specifically included in `keys` array',
 * }
 * 
 * // secondary object for recursive encryption
 * obj.fourth = {
 *      a: [1, 2, 3],
 *      b: new Map([[1,1], [2,3]]),
 *      c: 'not to be encrypted',
 *  }
 * 
 * // specify which properties to encrypt. If `keys` is falsy, will encrypt everything.
 * const keys = [
 *  'first',
 *  'second',
 *  'fourth',
 *  // removing the below two items will encrypt the entire `fourth` object
 *  'fourth.a',
 *  'fourth.b',
 * ]
 * 
 * // generate random sender's encryption keypair
 * const keyPair = encryptionKeypair(randomBytes(117))
 * 
 * // generate random recipient's encryption keypair
 * const keyPairRecipient = encryptionKeypair(randomBytes(117))
 * 
 * // encrypt using Box encryption
 * const boxResult = encryptObj(
 *     obj,
 *     keys,
 *     keyPair.secretKey,
 *     keyPairRecipient.publicKey,
 * )
 * 
 * // encrypt using SecretBox/Secretkey encryption
 * const secretBoxResult = encryptObj(
 *     obj,
 *     keys,
 *     keyPair.secretKey,
 * )
 * 
 * // if sealed is nul encryption has failed
 * console.log({ boxResult, secretBoxResult })
 * ```
 */
export const encryptObj = (obj, keys, secretKey, recipientPublicKey, nonce) => {
    obj = objCopy(obj, {})
    const isBox = isHex(recipientPublicKey) || isUint8Arr(recipientPublicKey)
    const encryptFn = isBox
        ? encrypt
        : secretBoxEncrypt
    // generate nonce if not supplied
    nonce = nonce && bytesToHex(nonce) || newNonce(true) 
    const filteredKeys = Object.keys(obj)
        .filter(key => !isArr(keys)
            ? key !== 'nonce'
            : keys.includes(key)
        )
    filteredKeys.forEach(key => {
        const value = obj[key]
        let keyResult
        if (isObj(value)) {
            const childKeyPrefix = `${key}.`
            const childKeys = keys
                .filter(k => k.startsWith(childKeyPrefix))
                .map(k => k.split(childKeyPrefix).join(''))
            keyResult = encryptObj(
                value,
                childKeys.length > 0
                    ? childKeys // encrypt only specified child keys
                    : null,     // encrypt all child keys
                secretKey,
                recipientPublicKey,
                nonce,
            )
        } else {
            keyResult = encryptFn(
                value,
                secretKey,
                // only include recipient public key if not secretBox encrption
                ...[isBox && recipientPublicKey].filter(Boolean),
                nonce,
                true,
            )
        }
        obj[key] = isBox
            ? keyResult.sealed
            : keyResult.encrypted
    })
    const result = { nonce, isBox }
    result[isBox ? 'sealed' : 'encrypted'] = obj
    return result
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
        strToU8a(message),
        hexToBytes(secret),
        hexToBytes(nonce),
    )
    if (!asHex || !result.encrypted) return result
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
 * @param   {String|Uint8Array} message 
 * @param   {String|Uint8Array} signature
 * @param   {String|Uint8Array} publicKey
 *
 * @returns {Boolean}
 */
export const verifySignature = naclVerify

export default {
    decrypt,
    encrypt,
    encryptObj,
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