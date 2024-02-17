import {
    bytesToHex,
    hexToBytes,
} from '../convert'
import {
    isArr,
    isHex,
    isObj,
    isUint8Arr,
    objCopy,
} from '../utils'
import box from './box'
import secretBox from './secretBox'
import { newNonce } from './utils'

/**
 * @name    decryptObj
 * @summary recursively decrypt objects encrypted using the `encryptObj()` function. 
 * 
 * @param   {Object}            obj         data object to decrypt
 * @param   {String|Uint8Array} senderPublicKey (optional) if not supplied, will attempt to decrypt using SecretBox. 
 *                                          Otherwise, will use Box encryption.
 * @param   {String|Uint8Array} secretKey   recipient secret key (box encrypted) or shared secret (secret box encrypted)
 * @param   {Array}             keys        (optional) `obj` property names, to be decrypted. 
 *                                          If valid array, unlisted properties will not be decrypted.
 *                                          Otherwise, will attempt to decrypt all String (hex) or Uint8Array values.
 *                                          See examples for different usage cases.
 * @param   {Boolean}           asString    (optional) whether to convert result bytes to string. The Object will still needs to be parsed externally.
 *                                          Default: `true`
 * 
 * @returns {Object} decrypted object
 * 
 * @example see see `encryptObj()` function documentation for examples
 */
export const decryptObj = (obj, senderPublicKey, secretKey, keys, asString = true) => {
    if (!isObj(obj)) return

    const result = { ...obj }
    const isBox = !!senderPublicKey
    const decrypt = isBox
        ? box.decrypt
        : secretBox.decrypt
    const validKeys = !isArr(keys)
        // decrypt all properties
        ? Object.keys(result)
        // decrypt only specified properties
        : keys.filter(k => result.hasOwnProperty(k))

    for (let i = 0;i < validKeys.length;i++) {
        const key = validKeys[i]
        const value = result[key]
        if (!obj.hasOwnProperty(key)) continue
        // ignore unencrytped keys
        if (!isHex(value) && !isUint8Arr(value)) continue

        // value is an object => recursively decrypt
        if (isObj(value)) {
            const childKeyPrefix = `${key}.`
            const childKeys = validKeys
                .filter(k => k.startsWith(childKeyPrefix))
                // get rid of prefix
                .map(k => k.replace(new RegExp(childKeyPrefix), ''))

            result[key] = decryptObj(
                value,
                senderPublicKey,
                secretKey,
                childKeys.length > 0
                    ? childKeys // decrypt only specified child keys
                    : null,     // decrypt all child keys
                asString,
            )
            continue
        }

        const bytes = hexToBytes(value)
        if (!bytes || bytes.length <= 24) throw new Error('Decryption failed')
        const args = [
            new Uint8Array(bytes.slice(24)),
            new Uint8Array(bytes.slice(0, 24)),
            ...[isBox && senderPublicKey].filter(Boolean),
            secretKey,
            asString,
        ]
        result[key] = decrypt(...args)
    }

    return result
}

/**
 * @name    encryptObj
 * @summary recursively encrypt specified or all properties of an object using TweetNacl Box or SecretBox encryption.
 * @description For Box encryption `recipientPublicKey` is required. All values are stringified before encryption. 
 * Make sure to parse into appropriate types after decryption. Encryption examples available below.
 * 
 * @param   {Object}            result  object to encrypt
 * @param   {String|Uint8Array} secretKey sender secret key (box encrypted) or shared secret (secret box encrypted)
 * @param   {String|Uint8Array} recipientPublicKey (optional) if not supplied, will encrypt using SecretBox. 
 *                                      Otherwise, will use Box encryption.
 * @param   {Array}             propsToEncrypt    (optional) to encrypt only specified object properties. 
 *                                      If valid array, unlisted properties will not be encrypted.
 *                                      If not a valid array, will attempt to encrypt all properties.
 *                                      See examples for different usage cases.
 * @param   {Boolean}           asHex   (optional) Default: `true`
 * 
 * @returns {[
 *  result: Object,
 *  isBox: boolean,
 * ]} result:  encrypted object, isBox: indicates whether TweetNacl box or secretBox encrypted is used
 * 
 * @example ```javascript
 * // object to encrypt
 * const obj = {
 *     first: 'some text',
 *     second: 1, // will be converted to string: '1'
 *     third: 'ignored property',
 *     fifth: null, // will be converted to string: 'null'
 * }
 * 
 * // secondary object for recursive encryption
 * obj.fourth = {
 *     a: [1, 2, 3], // will be converted to string
 *     b: new Map([[1,1], [2,3]]), // will be converted to 2D Array and then to string
 *     c: 'not to be encrypted', // will not be touched
 *  }
 * 
 * // specify which properties to encrypt. If `keys` is falsy, will encrypt everything.
 * const keys = [
 *     'first',
 *     'second',
 *     'fifth',
 *     'fourth',
 *     // removing the below two items will encrypt the entire `fourth` object
 *     'fourth.a',
 *     'fourth.b',
 * ]
 * 
 * // generate random sender's encryption keypair
 * const keyPair = encryptionKeypair(randomBytes(117))
 * 
 * // generate random recipient's encryption keypair
 * const keyPairRecipient = encryptionKeypair(randomBytes(117))
 * 
 * // encrypt using Box encryption
 * const [ box ] = encryptObj(
 *     obj,
 *     keyPair.secretKey,
 *     keyPairRecipient.publicKey,
 *     keys,
 * )
 * 
 * // now attempt to decrypt the encrypted `box` object
 * const boxDecrypted = decryptObj(
 *     box,
 *     keyPairRecipient.publicKey,
 *     keyPair.secretKey,
 *     keys,
 * )
 * 
 * // encrypt using SecretBox/Secretkey encryption
 * const [ secretBox ] = encryptObj(
 *     obj,
 *     keyPair.secretKey,
 *     null,
 *     keys,
 * )
 * 
 * // now attempt to decrypt the encrypted `box` object
 * const secretBoxDecrypted = decryptObj(
 *     secretBox,
 *     null,
 *     keyPair.secretKey,
 *     keys,
 * )
 * 
 * // if sealed is null encryption has failed
 * console.log({ 
 *     box,
 *     boxDecrypted,
 *     secretBox,
 *     secretBoxDecrypted,
 * })
 * ```
 */
export const encryptObj = (
    obj,
    secretKey,
    recipientPublicKey,
    propsToEncrypt,
    asHex = true
) => {
    if (!isObj(obj)) return

    const result = objCopy(obj, {}, [])
    const isBox = isHex(recipientPublicKey) || isUint8Arr(recipientPublicKey)
    const encrypt = isBox
        ? box.encrypt
        : secretBox.encrypt
    const validKeys = !isArr(propsToEncrypt)
        // encrypt all properties
        ? Object.keys(result)
        //  encrypt only specified properties
        : propsToEncrypt.filter(k => result.hasOwnProperty(k))

    for (let i = 0;i < validKeys.length;i++) {
        const key = validKeys[i]
        const value = result[key]
        if (!obj.hasOwnProperty(key)) continue

        // value is an object => recursively encrypt
        if (isObj(value)) {
            const childKeyPrefix = `${key}.`
            const childKeys = validKeys
                .filter(k => k.startsWith(childKeyPrefix))
                // get rid of prefix
                .map(k => k.replace(new RegExp(childKeyPrefix), ''))

            result[key] = encryptObj(
                value,
                secretKey,
                recipientPublicKey,
                childKeys.length > 0
                    ? childKeys // encrypt only specified child keys
                    : null,     // encrypt all child keys
            )[0]
            continue
        }

        const { encrypted, nonce, sealed } = encrypt(
            value,
            secretKey,
            // only include recipient public key if not secretBox encrption
            ...[isBox && recipientPublicKey].filter(Boolean),
            newNonce(false), // generate new nonce
            false,
        )
        if (!encrypted && !sealed) {
            console.log('Encryption failed', { value })
            throw new Error('Encryption failed')
        }

        const bytes = new Uint8Array([...nonce, ...(encrypted || sealed)])
        result[key] = !asHex
            ? bytes
            : bytesToHex(bytes)
    }
    return [
        result,
        isBox,
    ]
}

export default {
    decrypt: decryptObj,
    encrypt: encryptObj,
}