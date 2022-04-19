/**
 * @name	formatNumber
 * @summary formats number to locale while keeping the specified decimals
 * 
 * @param	{Number}	value 
 * @param	{Number}	decimals	(optional) number of decimal places
 * @param	{String}	locale		(optional) 2 letter country code
 * 									Default: system default
 * @param	{String}	separator	(optional) decimal separator.
 * 									Default: system default 
 * 
 * @returns {String}
 */
export const formatNumber = (value, decimals, locale, separator) => {
	separator = separator || (1.1).toLocaleString(locale).replace(/[0-9]/g, '')
	const int = parseInt(value)
	let reminder = Math.abs(value - int)
	const reminderX = reminder
	if (reminder > 0) {
		reminder = separator + `${reminder}`.split('.')[1]
		reminder = decimals === 0
			? ''
			: decimals > 0
				? reminder.slice(0, decimals + 1)
				: reminder
	} else {
		reminder = ''
	}
	return `${int.toLocaleString(locale)}${reminder}`
}

/**
 * @name	round
 * @summary rounds a number to a fixed decimal places and avoids unintentional use of exponents
 * 
 * @param	{Number}	value 
 * @param	{Number}	decimals 
 * 
 * @returns {String}
 */
export const round = (value = 0, decimals = 0) => {
	value = Number(value)
	return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals).toFixed(decimals)
}

/**
 * @name	shorten
 * @summary formats number in short form. Eg: converts `1000` to `"1K"`
 * 
 * @param	{Number} value 
 * @param	{Number} decimals	Default: `0`
 * 
 * @returns {String}
 */
export const shorten = (value, decimals = 0) => {
	let label = ''
	let divider = 1
	if (value < 1e3) {
		divider = 1
		label = ''
	} else if (value >= 1e9) {
		// billion
		divider = 1e9
		label = 'B'
	} else if (value >= 1e6) {
		// million
		divider = 1e6
		label = 'M'
	} else if (value >= 1e3) {
		// thousand
		divider = 1e3
		label = 'K'
	}
	value = round(value / divider, decimals)
	return `${value}${label}`
}