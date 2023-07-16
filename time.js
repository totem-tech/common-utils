/*
 * Date formatting etc.
 */
import { isDate, isStr, strFill } from './utils'

export const BLOCK_DURATION_SECONDS = 4
export const BLOCK_DURATION_REGEX = /^(\d{2}):[0-5][0-9]:[0-5][0-9]$/ // valid duration up to 99:59:59

/**
 * @name    blockToDate
 * @summary converts block number to date relative to the supplied @currentBlock
 * 
 * @param   {Number}    block           block number to get the timestamp of
 * @param   {Number}    currentBlock    current block number
 * @param   {Boolean}   asString        (optional) whether to return formatted ISO date string or Date object
 *                                      Default: true
 * @param   {Number}    strLength       (optional) only when asString is true
 * 
 * @returns {String|Date}
 */
export const blockToDate = (block, currentBlock, asString = true, strLength) => {
    const numSeconds = (block - currentBlock) * BLOCK_DURATION_SECONDS
    const date = new Date()
    // add or substract duration to the @date to get to the timestamp of the @block
    date.setSeconds(date.getSeconds() + numSeconds)
    return !asString
        ? date
        : `${format(date)}`
            .substring(0, strLength)
}

/**
 * @name    dateToBlock
 * @summary convert date to (estimated) block number
 * 
 * @param   {Date|String}   date
 * @param   {Number}        currentBlock 
 * 
 * @returns {Number}
 */
export const dateToBlock = (date, currentBlock) => {
    const dateMS = new Date(date) - new Date()
    const blockNum = Math.ceil(dateMS / 1000 / BLOCK_DURATION_SECONDS) + currentBlock
    return blockNum
}

export const durationToSeconds = (duration = '') => {
    const [
        hours = 0,
        minutes = 0,
        seconds = 0
    ] = duration.split(':')
    return parseInt(seconds) + parseInt(minutes) * 60 + parseInt(hours) * 60 * 60
}

// prepends '0' if number is less than 10
const fill = n => strFill(n, 2, '0')

/**
 * @name format
 * @summary formats date to ISO Date string. Converts '2019-10-05T16:58:06.093Z' to '2019-10-05 16:58'
 * 
 * @param {Date|String} date Date object or UNIX timestamp ('2099-11-11T11:11:11.111Z')
 * @param {Boolean}     seconds whether to inlcude seconds
 * @param {Boolean}     ms whether to include milliseonds
 * 
 * @returns {String} formatted string
 */
export const format = (date, seconds = false, ms = false, amPm = false) => {
    if (isDate(date)) {
        date = date.toISOString()
    }
    if (!isStr(date)) return ''
    const xDate = new Date(date)
    let formatted = [
        xDate.getFullYear(),
        xDate.getMonth() + 1,
        xDate.getDate(),
    ]
        .map(fill)
        .join('-')

    const hours = xDate.getHours()
    formatted += ' ' + [
        hours,
        xDate.getMinutes(),
        seconds && xDate.getSeconds(),
    ]
        .filter(x => x !== false)
        .map(fill)
        .join(':')
    if (amPm) formatted += ` ${hours >= 12 ? 'PM' : 'AM'}`

    return !seconds || !ms
        ? formatted
        : `${formatted}.${xDate.getMilliseconds()}`
}

export const secondsToDuration = numSeconds => {
    numSeconds = parseInt(numSeconds || 0)
    const seconds = numSeconds % 60
    const totalMinutes = parseInt(numSeconds / 60)
    const hours = parseInt(totalMinutes / 60)
    return fill(hours) + ':' + fill(totalMinutes % 60) + ':' + fill(seconds)
}