import { isArr, isArrLike, isHex, isObj, isStr, isUint8Arr } from './utils'
/*
 * List of optional node-modules and the functions used by them:
 * Module Name          : Function Name
 * ---------------------------
 * @polkadot/util       : bytesToHex, hexToBytes, strToU8a, u8aToStr
 * @polkadot/util-crypto: ss58Decode, ss58Encode
*/

// returns @fallbackValue if function call throws error
const fallbackIfFails = (func, args = [], fallbackValue = null) => {
    try {
        return func.apply(null, args)
    } catch (e) {
        return fallbackValue
    }
}

/**
 * @name    ss58Encode
 * @summary convert identity/address from bytes to string
 * 
 * @param   {Uint8Array} address 
 * @param   {Number}     ss58Format (optional) use to generate address for any supported parachain identity.
 *                                  Default: 0 (Polkadot)
 * 
 * @returns {String}     null if invalid address supplied
 */
export const ss58Encode = (address, ss58Format = 0) => {
    const { encodeAddress } = require('@polkadot/util-crypto')
    return fallbackIfFails(encodeAddress, [address, ss58Format])
}

/**
 * @name    ss58Decode
 * @summary convert identity/address from string to bytes
 * 
 * @param {String} address
 * 
 * @returns {Uint8Array}    null if invalid address supplied
 */
export const ss58Decode = (address, ignoreChecksum, ss58Format) => {
    const { decodeAddress } = require('@polkadot/util-crypto')
    return fallbackIfFails(decodeAddress, [
        address,
        ignoreChecksum,
        ss58Format,
    ])
}

/**
 * @name    hexToBytes
 * @summary convert hex string to bytes array
 * 
 * @param   {String} hex 
 * @param   {Number} bitLength 
 * 
 * @returns {Uint8Array}
 */
export const hexToBytes = (hex, bitLength) => {
    // no need to convert
    if (isUint8Arr(hex)) return hex

    const { hexToU8a } = require('@polkadot/util')
    return fallbackIfFails(hexToU8a, [
        isStr(hex) && !hex.startsWith('0x')
            ? '0x' + hex
            : hex,
        bitLength
    ])
}

export const bytesToHex = bytes => {
    // no need to convert
    if (isHex(bytes)) return bytes

    const { u8aToHex } = require('@polkadot/util')
    return fallbackIfFails(u8aToHex, [bytes])
}
export const u8aToStr = value => {
    const { u8aToString } = require('@polkadot/util')
    return u8aToString(value)
}
/**
 * @name    strToU8a
 * @summary converts any input Uint8Array
 * 
 * @param   {*} value any non-string value will be stringified.
 *                    Objects and Arrays will be stringified using `JSON.stringify(value)`.
 *                    Any Map or Set will be converted to Array first using `Array.from(value)`.
 */
export const strToU8a = value => {
    const { stringToU8a } = require('@polkadot/util')
    const str = isArrLike(value)
        ? JSON.stringify(Array.from(value))
        : isObj(value)
            ? JSON.stringify(value)
            : `${value}`
    return stringToU8a(str)
}
export const decodeUTF8 = strToU8a // ToDo: deprecate
export const encodeUTF8 = u8aToStr // ToDo: deprecate

/**
 * @name    addressToStr
 * @summary Converts to address bytes to string
 * 
 * @param   {String|Uint8Array} address 
 * 
 * @returns {String}    If invalid address returns empty string.
 */
export const addressToStr = address => fallbackIfFails(
    ss58Encode, // first attempt to convert bytes to string
    [address],
    // if fails check if address is a valid string
    fallbackIfFails(ss58Decode, [address]) && address || '',
)



/**
 * @name    csvToArrr
 * @summary Convert CSV/TSV (Comma/Tab Seprated Value) string to Array
 *  
 * @param   {String} str 
 * @param   {Array}  columnTitles (optional) 
 *                      if null, indicates no column title to be used
 *                      if undefined, will use first line as column title 
 * @param   {String} separator line text separator 
 * 
 * @returns {Map} exactly the same number of items as the number of columns.
 *                      Each item will be an array consisting of all column cells.
 *                      If `columnTitles` not supplied, first cell of each column will be used as key 
 *                      and be excluded from item value array.
 */
export const csvToArr = (str, columnTitles, separator = ',') => {
    const lines = str.split('\n').map(line => line.replace('\r', ''))
    const ignoreFirst = !isArr(columnTitles) || columnTitles.length === 0
    const keys = !ignoreFirst ? columnTitles : (lines[0] || '').split(separator)
    return lines
        .slice(ignoreFirst ? 1 : 0)
        .map(line => {
            const cells = line.split(separator)
            // ignore empty line
            if (cells.join('').trim() === '') return
            // convert array to object with column titles as respective keys
            return cells.reduce((obj, str, i) => {
                obj[keys[i]] = str
                return obj
            }, {})
        })
        .filter(Boolean)
}
/**
 * @name    csvToMap
 * @summary Convert CSV/TSV (Comma/Tab Seprated Value) string to Map
 *  
 * @param   {String} str 
 * @param   {Array}  columnTitles (optional) 
 *                      if null, indicates no column title to be used
 *                      if undefined, will use first line as column title 
 * @param   {String} separator line text separator 
 * 
 * @returns {Map} exactly the same number of items as the number of columns.
 *                      Each item will be an array consisting of all column cells.
 *                      If `columnTitles` not supplied, first cell of each column will be used as key 
 *                      and be excluded from item value array.
 */
export const csvToMap = (str, columnTitles, separator = ',') => {
    const result = new Map()
    const lines = str.split('\n').map(line => line.replace('\r', ''))
    const ignoreFirst = !isArr(columnTitles) || columnTitles.length === 0
    const titles = !ignoreFirst ? columnTitles : lines[0].split(separator)
    lines.slice(ignoreFirst ? 1 : 0)
        .forEach(line => {
            const cells = line.split(separator)
            // ignore empty line
            if (cells.join('').trim() === '') return
            cells.forEach((text, i) => {
                if (!titles[i]) return
                const columnTexts = result.get(titles[i]) || []
                columnTexts.push(text)
                result.set(titles[i], columnTexts)
            })
        })
    return result
}

export default {
    addressToStr,
    bytesToHex,
    csvToArr,
    csvToMap,
    decodeUTF8,
    encodeUTF8,
    hexToBytes,
    ss58Decode,
    ss58Encode,
    strToU8a,
    u8aToStr,
}