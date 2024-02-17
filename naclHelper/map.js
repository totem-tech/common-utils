import { isMap, isObj } from '../utils'
import { decryptObj, encryptObj } from './object'

/**
 * @name    mapDecrypt
 * @summary recursively decrypt objects encrypted using the `encryptObj()` function. 
 * 
 * @param   {Map}               data         data to decrypt
 * @param   {String|Uint8Array} senderPublicKey (optional) if not supplied, will decrypt using SecretBox. 
 *                                          Otherwise, will use Box encryption.
 * @param   {String|Uint8Array} secretKey   recipient secret key (box encrypted) or shared secret (secret box encrypted)
 * @param   {Array}             keys        (optional) `obj` property names, to be decrypted. 
 *                                          If valid array, unlisted properties will not be decrypted.
 *                                          Otherwise, will attempt to decrypt all String (hex) or Uint8Array values.
 *                                          See examples for different usage cases.
 * 
 * @returns {Map|Boolean} Map with decrypted values or false if data is not a Map.
 * 
 * @example see see `encryptObj()` function documentation for examples
 */
export const mapDecrypt = (data, senderPublicKey, recipientSecretKey, keys) => isMap(data)
    && new Map(
        Array
            .from(data)
            .map(([key, value]) => {
                value = !isObj(value)
                    ? value
                    : decryptObj(
                        value,
                        senderPublicKey,
                        recipientSecretKey,
                        keys,
                        true,
                    )
                return [key, value]
            })
    )

/**
 * @name    mapEncrypt
 * @summary recursively encrypt specified or all properties of an object using TweetNacl Box or SecretBox encryption.
 * @description For Box encryption `recipientPublicKey` is required. All values are stringified before encryption. 
 * Make sure to parse into appropriate types after decryption. Encryption examples available below.
 * 
 * @param   {Map}               data       data to encrypt
 * @param   {String|Uint8Array} secretKey sender secret key (box encrypted) or shared secret (secret box encrypted)
 * @param   {String|Uint8Array} recipientPublicKey (optional) if not supplied, will encrypt using SecretBox. 
 *                                      Otherwise, will use Box encryption.
 * @param   {Array}             keys    (optional) to encrypt only specified object properties. 
 *                                      If valid array, unlisted properties will not be encrypted.
 *                                      If not a valid array, will attempt to encrypt all properties.
 *                                      See examples for different usage cases.
 * @param   {Boolean}           asHex   (optional) Default: `true`
 * 
 * @returns {Map}   Map with encrypted values
 */
export const mapEncrypt = (data, secretKey, recipientPublicKey, keys, asHex = true) => isMap(data)
    && new Map(
        Array
            .from(data)
            .map(([key, value]) => {
                value = !isObj(value)
                    ? value
                    : encryptObj(
                        value,
                        secretKey,
                        recipientPublicKey,
                        keys,
                        asHex
                    )[0]
                return [key, value]
            })
    )


export default {
    decrypt: mapDecrypt,
    encrypt: mapEncrypt,
}