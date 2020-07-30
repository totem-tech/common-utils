import { isArr, isBond, isStr, isObj, isUint8Arr } from '../utils/utils'
import { hexToString, hexToU8a, stringToU8a, u8aToString, u8aToHex } from '@polkadot/util'
import { checkAddress, decodeAddress, encodeAddress, setSS58Format } from '@polkadot/util-crypto'

// returns @fallbackValue if function call throws error
const fallbackIfFails = (func, args = [], fallbackValue = null) => {
    try {
        return func.apply(null, args)
    } catch (e) {
        return fallbackValue
    }
}
// convert identity/address from bytes to string
// 
// Params: 
// @address     Uint8Array
//
// Returns      string/null: null if invalid address supplied

export const ss58Encode = address => fallbackIfFails(encodeAddress, [address])
// convert identity/address from string to bytes
// 
// Params: 
// @address     string
//
// Returns      string/null: null if invalid address supplied

export const ss58Decode = address => fallbackIfFails(decodeAddress, [address])

export const hexToBytes = (hex, bitLength) => isUint8Arr(hex) ? hex : fallbackIfFails(hexToU8a, [
    isStr(hex) && !hex.startsWith('0x') ? '0x' + hex : hex,
    bitLength
])

export const bytesToHex = bytes => fallbackIfFails(u8aToHex, [bytes])
export const decodeUTF8 = stringToU8a // ToDo: deprecate
export const encodeUTF8 = u8aToString // ToDo: deprecate
export const u8aToStr = u8aToString
export const strToU8a = stringToU8a

// addressToStr checks if an address is valid. If valid, converts to string otherwise, returns empty string
//
// Params:
// @address     string/bytes
export const addressToStr = address => fallbackIfFails(
    ss58Encode, // first attempt to convert bytes to string
    [address],
    // if fails check if address is a valid string
    fallbackIfFails(ss58Decode, [address]) && address || '',
)

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
//                      If @columnTitles not supplied, first cell of each column will be used as key
//                      and be excluded from item value array.
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
//                      If @columnTitles not supplied, first cell of each column will be used as key 
//                      and be excluded from item value array.
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
}