/*
 * Date formatting etc.
 */

import { isDate, isStr, strFill } from "./utils";


// prepends '0' if number is less than 10
const fill = n => strFill(n, 2, '0')

// formats string timestamp
//
// converts '2019-10-05T16:58:06.093Z' to '2019-10-05 16:58'
export const format = date => {
    if (isDate(date)) {
        date = date.toISOString()
    }
    return isStr(date) ? date.replace(/\T|\Z/g, ' ').substr(0, 16) : ''
}

export const BLOCK_DURATION_SECONDS = 15
export const BLOCK_DURATION_REGEX = /^(\d{2}):[0-5][0-9]:[0-5][0-9]$/ // valid duration up to 99:59:55 
//old: /^(\d{2}):[0-5][0-9]:[0-5](0|5)$/

/**
 * @name    blockNumberToTS
 * @summary converts block number to date relative to the supplied @currentBlock
 * 
 * @param {Number}  block block number to get the timestamp of
 * @param {Number}  currentBlock current block number
 * @param {Boolean} asString whether to return formatted ISO date string or Date object
 * 
 * @returns {String|Date}
 */
export const blockNumberToTS = (block, currentBlock, asString = true) => {
    const numSeconds = (block - currentBlock) * BLOCK_DURATION_SECONDS
    const date = new Date()
    // add or substract duration to the @date to get to the timestamp of the @block
    date.setSeconds(date.getSeconds() + numSeconds)
    return !asString ? date : format(date)
}

export const secondsToDuration = numSeconds => {
    numSeconds = parseInt(numSeconds || 0)
    const seconds = numSeconds % 60
    const totalMinutes = parseInt(numSeconds / 60)
    const hours = parseInt(totalMinutes / 60)
    return fill(hours) + ':' + fill(totalMinutes % 60) + ':' + fill(seconds)
}

export const durationToSeconds = duration => {
    const [hours = 0, minutes = 0, seconds = 0] = duration.split(':')
    return parseInt(seconds) + parseInt(minutes) * 60 + parseInt(hours) * 60 * 60
}

window.strFill = strFill