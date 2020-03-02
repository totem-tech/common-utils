/*
 * Date formatting etc.
 */
// prepend0 prepends '0' if number is less than 10
export const prepend0 = n => (n < 10 ? '0' : '') + n

// For todays date;
Date.prototype.today = function () {
    return prepend0(this.getDate()) + "/" + prepend0(this.getMonth() + 1) + "/" + this.getFullYear();
}

// For the time now
Date.prototype.timeNow = function () {
    return prepend0(this.getHours()) + ":" + prepend0(this.getMinutes()) + ":" + prepend0(this.getSeconds())
}

export const getNow = () => new Date().today() + " @ " + new Date().timeNow()


// formats string timestamp
//
// converts '2019-10-05T16:58:06.093Z' to '2019-10-05 16:58'
export const formatStrTimestamp = tsStr => !tsStr ? '' : tsStr.replace(/\T|\Z/g, ' ').substr(0, 16)

/*
 * rate related stuff
 */
export const BLOCK_DURATION_SECONDS = 15
export const BLOCK_DURATION_REGEX = /^(\d{2}):[0-5][0-9]:[0-5](0|5)$/ // valid duration up to 99:59:55

export const secondsToDuration = numSeconds => {
    numSeconds = parseInt(numSeconds || 0)
    const seconds = numSeconds % 60
    const totalMinutes = parseInt(numSeconds / 60)
    const hours = parseInt(totalMinutes / 60)
    return prepend0(hours) + ':' + prepend0(totalMinutes % 60) + ':' + prepend0(seconds)
}

export const durationToSeconds = duration => {
    const [hours, minutes, seconds] = duration.split(':')
    return parseInt(seconds) + parseInt(minutes) * 60 + parseInt(hours) * 60 * 60
}