import {
    ss58Encode as ss58Encode1,
    ss58Decode as ss58Decode1
} from 'oo7-substrate/src/ss58'
import {
    hexToBytes as hexToBytes1,
    bytesToHex as bytesToHex1
} from 'oo7-substrate/src/utils.js'
import {
    decodeUTF8 as decodeUTF81,
    encodeUTF8 as encodeUTF81,
    encodeBase64 as encodeBase641,
    decodeBase64 as decodeBase641
} from "tweetnacl-util"
import { isArr, isBond, isUint8Arr, isStr } from '../utils/utils'

// For easy access and placeholder for some functions to be copied here
export const ss58Encode = ss58Encode1
export const ss58Decode = ss58Decode1
export const hexToBytes = hexToBytes1
export const bytesToHex = bytesToHex1
export const decodeUTF8 = decodeUTF81
export const encodeUTF8 = encodeUTF81
export const encodeBase64 = encodeBase641
export const decodeBase64 = decodeBase641


// addressToStr checks if an address is valid. If valid, converts to string otherwise, returns empty string
//
// Params:
// @address     string/bond
export const addressToStr = address => {
    if (isUint8Arr(address)) {
        address = ss58Encode(address)
        return address || ''
    }
    return isStr(address) && ss58Decode(address) ? address : ''
}
// Convert CSV/TSV (Comma/Tab Seprated Value) string to an Array
//
// Params:
// @str             string:
// @columnTitles    array: 
//                      if null, indicates no column title to be used
//                      if undefined, will use first line as column title
// @separator       string: line text separator 
//
// Returns          Map: exactly the same number of items as the number of columns.
//                      Each item will be an array consisting of all column cells.
//                      If @columnTitles not supplied, first cell of each column will be used as key and be excluded from item value array.
export const csvToArr = (str, columnTitles, separator = ',') => {
    const lines = str.split('\n')
    const ignoreFirst = !isArr(columnTitles) || columnTitles.length === 0
    const keys = !ignoreFirst ? columnTitles : (lines[0] || '').split(separator)
    return lines.filter(line => line.replace(separator, '').trim() !== '')
        .slice(ignoreFirst ? 1 : 0)
        .map(line => line.split(separator)
            .reduce((obj, str, i) => {
                obj[keys[i]] = str
                return obj
            }, {})
        )
}

// Convert CSV/TSV (Comma/Tab Seprated Value) string to Map
//
// Params:
// @str             string:
// @columnTitles    array: 
//                      if null, indicates no column title to be used
//                      if undefined, will use first line as column title
// @separator       string: line text separator 
//
// Returns          Map: exactly the same number of items as the number of columns.
//                      Each item will be an array consisting of all column cells.
//                      If @columnTitles not supplied, first cell of each column will be used as key and be excluded from item value array.
export const csvToMap = (str, columnTitles, separator = ',') => {
    const result = new Map()
    const lines = str.split('\n')
    const ignoreFirst = !isArr(columnTitles) || columnTitles.length === 0
    const titles = !ignoreFirst ? columnTitles : lines[0].split(separator)
    lines.filter(line => line.replace(separator, '').trim() !== '')
        .slice(ignoreFirst ? 1 : 0)
        .forEach(line => {
            const cells = line.split(separator)
            cells.forEach((text, i) => {
                if (!titles[i]) return
                const columnTexts = result.get(titles[i]) || []
                columnTexts.push(text)
                result.set(titles[i], columnTexts)
            })
        })
    return result
}

// hashToBytes converts hash to bytes array. Will return 0x0 if value is unsupported type.
//
// Params:
// @hash    string/Uint8Array/Bond
//
// Returns Uint8Array
export const hashToBytes = hash => isUint8Arr(hash) ? hash : hexToBytes(isBond(hash) ? hash._value : hash)

// hashToStr converts given hash to string prefixed by '0x'.  Will return '0x0', if not invalid hash.
//
// Params:
// @hash    string/Uint8Array/Bond
//
// Returns string
export const hashToStr = hash => {
    hash = isBond(hash) ? hash._value : hash
    try {
        if (isStr(hash) && hexToBytes(hash)) return (hash.startsWith('0x') ? '' : '0x') + hash
        return '0x' + bytesToHex(hash)
    } catch (e) {
        console.log(e)
        return '0x0'
    }
}