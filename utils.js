import { v1 as uuidV1 } from 'uuid'
/*
 * List of optional node-modules and the functions used by them:
 * Module Name          : Function Name
 * ------------------------------------------------------
 * @polkadot/util-crypto: isAddress, generateHash
 * escapeStringRegexp   : escapeStringRegexp, searchRanked
 * form-data   			: objToFormData
 * web3-utils  			: isAddress, isETHAddress
*/

export const EMAIL_REGEX = new RegExp(/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,9}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i)
export const HEX_REGEX = /^0x[0-9a-f]+$/i
export const HASH_REGEX = /^0x[0-9a-f]{64}$/i
// doesn't work well on URLs with ports!!! Matches emails too!
export const URL_REGEX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[\-;:&=\+\$,\w]+@)?[A-Za-z0-9\.\-]+|(?:www\.|[\-;:&=\+\$,\w]+@)[A-Za-z0-9\.\-]+)((?:\/[\+~%\/\.\w\-_]*)?\??(?:[\-\+=&;%@\.\w_]*)#?(?:[\.\!\/\\\w]*))?)/g
// default icons used in Message component
// ToDo: move to `reactjs/components/Message`
export const icons = {
	basic: '',
	error: 'exclamation circle',
	loading: { name: 'circle notched', loading: true },
	info: 'info',
	success: 'check circle outline',
	warning: 'lightning'
}

/**
 * @name	clearClutter
 * @summary clears clutter from strings
 * 
 * @param	{String} x 
 * 
 * @returns {String}
 */
export const clearClutter = x => x.split('\n')
	.map(y => y.trim())
	.filter(Boolean)
	.join(' ')

/**
 * @name	copyToClipboard
 * @summary copies text to browser clipboard. Not compatible with NodeJS.
 * 
 * @param	{String} str 
 */
export const copyToClipboard = str => {
	try {
		window.navigator.clipboard.writeText(url)
	} catch (e) {
		const el = document.createElement('textarea')
		el.value = str
		el.setAttribute('readonly', '')
		el.style.position = 'absolute'
		el.style.left = '-9999px'
		document.body.appendChild(el)
		el.select()
		document.execCommand('copy')
		document.body.removeChild(el)
	}
}

export const downloadFile = (content, fileName, contentType) => {
	const a = document.createElement('a')
	const file = new Blob([content], { type: contentType })
	a.href = URL.createObjectURL(file)
	a.download = fileName
	a.click()
}

export const escapeStringRegexp = (str) => {
	const fn = require('escape-string-regexp')
	return fn(str)
}

/**
 * @name	fallbackIfFails
 * @summary a simple try-catch wrapper for invoking functions to catch errors.
 * Ensures a value is always returned by avoiding any unexpected errors.
 * 
 * @param	{*|Function|Promise}	func 
 * @param	{Array|Function}		args			arguments to be supplied to `func` fuction 
 * @param	{*|Function}			fallbackValue	alternative value
 * 
 * @returns {*|Promise} if func is a promise the return a promise 
 */
export const fallbackIfFails = (func, args = [], fallbackValue = null) => {
	let result
	try {
		if (!isFn(func)) {
			result = func
			throw 0
		}
		result = func(
			...isFn(args)
				? args()
				: args
		)
		if (!isPromise(result)) return result
	} catch (_) { }

	const getAltVal = () => isFn(fallbackValue)
		? fallbackValue(result)
		: fallbackValue

	return isPromise(result)
		? result.catch(getAltVal)
		: result !== undefined && !isError(result)
			? result
			: getAltVal()
}

/**
 * @name	generateHash
 * @summary generate hash using supplied data
 * 
 * @param	{String}	seed		data to generate hash of
 * @param	{String}	algo		Supported algorithms: blake2 (default), keccak
 * @param	{Number}	bitLength 	Default: 256
 */
export const generateHash = (seed = uuidV1(), algo = 'blake2', bitLength = 256) => {
	const { blake2AsHex, keccakAsHex } = require('@polkadot/util-crypto')
	seed = isUint8Arr(seed)
		? seed
		: isStr(seed)
			? seed
			: JSON.stringify(seed)
	switch (`${algo}`.toLowerCase()) {
		case 'keccak':
			return keccakAsHex(seed)
		case 'blake2':
		default:
			return blake2AsHex(seed, bitLength)
		// ToDo: add support for other algo from Polkadot/utils-crypto
	}
	return // unsuporrted
}

/**
 * @name    isAddress
 * @summary validates if supplied is a valid address
 * 
 * @param    {String}	address 
 * @param    {String}	type            (optional) valid types: polkadot (default), ethereum
 * @param    {Number}	chainId			(optional) chainId for Ethereum address, ss58Format for Polkadot.
 * 										Default: `undefined` (for Polkadot), `0` for Ethereum
 * @param    {Boolean}	ignoreChecksum	(optional) for Polkadot only.
 * 										Default: false
 */
export const isAddress = (address, type, chainId, ignoreChecksum = false) => {
	try {
		switch (`${type}`.toLowerCase()) {
			case 'ethereum': return isETHAddress(address, chainId ?? 0)
			case 'polkadot':
			default:
				const { ss58Decode } = require('./convert')
				// assume Polkadot/Totem address
				const account = ss58Decode(address, ignoreChecksum, chainId)
				// must be 32 bytes length
				return !!account && account.length === 32
		}
	} catch (e) {
		return false
	}
}
isAddress.validTypes = {
	ethereum: 'ethereum',
	polkadot: 'polkadot',
}
export const isArr = x => Array.isArray(x)
// isArr2D checks if argument is a 2-dimentional array
export const isArr2D = x => isArr(x) && x.every(isArr)
// checks if convertible to an array by using `Array.from(x)`
export const isArrLike = x => isSet(x) || isMap(x) || isArr(x)
// check if function is Async. Does not work when Babel/Webpack is used due to code compilation.
export const isAsyncFn = x => x instanceof (async () => { }).constructor
	&& x[Symbol.toStringTag] === 'AsyncFunction'
export const isBool = x => typeof x === 'boolean'
export const isBond = x => {
	try {
		return isObj(x) && isFn(x.tie) && isFn(x.untie)
	} catch (e) {
		return false
	}
}
// Check if x is a valid Date instance
// Date object can sometimes be 'Invalid Date' without any timestamp.
// Date.getTime() is used to make sure it's a valid Date
export const isDate = x => x instanceof Date && isValidNumber(x.getTime())
export const isDefined = x => x !== undefined && x !== null
export const isError = x => x instanceof Error
export const isETHAddress = (address, chainId) => {
	const { isAddress } = require('web3-utils')
	return isAddress(address, chainId)
}
export const isFn = x => typeof x === 'function'
export const isHash = x => fallbackIfFails(() => HASH_REGEX.test(x), [], false)
export const isHex = x => fallbackIfFails(() => HEX_REGEX.test(x), [], false)
export const isInteger = x => Number.isInteger(x)
export const isMap = x => x instanceof Map
export const isNodeJS = () => fallbackIfFails(() => !(window && localStorage), [], true)
export const isObj = (x, strict = true) => !!x // excludes null, NaN, Infinity....
	&& typeof x === 'object'
	&& (
		!strict
		// excludes Array, Map, Set
		|| !isArr(x)
		&& !isMap(x)
		&& !isSet(x)
	)
// Checks if argument is an Array of Objects. Each element type must be object, otherwise will return false.
export const isObjArr = x => isArr(x) && x.every(isObj)
// Checks if argument is a Map of Objects. Each element type must be object, otherwise will return false.
export const isObjMap = x => isMap(x) && Array.from(x).every(([_, v]) => isObj(v))
export const isPositiveInteger = x => isInteger(x) && x > 0
export const isPositiveNumber = x => isValidNumber(x) && x > 0
export const isPromise = x => x instanceof Promise
export const isSet = x => x instanceof Set
export const isStr = x => typeof x === 'string'
export const isSubjectLike = x => isObj(x) && isFn(x.subscribe) && isFn(x.next)
export const isTouchable = () => fallbackIfFails(() => 'ontouchstart' in document.documentElement, [], false)
export const isUint8Arr = arr => arr instanceof Uint8Array
export const isURL = x => x instanceof URL
// checks if dateOrStr is a valid date
export const isValidDate = dateOrStr => {
	const date = new Date(dateOrStr)
	if (!isDate(date)) return false

	// hack to detect & prevent `new Date(dateOrStr)` converting '2021-02-31' to '2021-03-03'
	const [original, converted] = [`${dateOrStr}`, date.toISOString()]
		.map(y => y
			.replace('T', '')
			.replace('Z', '')
			.substr(0, 10)
		)
	return original === converted
}
export const isValidNumber = x => typeof x == 'number' && !isNaN(x) && isFinite(x)
export const isValidURL = (x, strict = true) => {
	try {
		const isAStr = isStr(x)
		const url = isURL(x)
			? x
			: new URL(x)
		// If strict mode is set to `true` and if a string value provided, it must match resulting value of new URL(x).
		// This can be used to ensure that a URL can be queried without altering.
		if (!isAStr || !strict) return true
		// catch any auto-correction by `new URL()`. 
		// Eg: spaces in the domain name being replaced by`%20` or missing `/` in protocol being auto added
		x = `${x}`
		if (x.endsWith(url.hostname)) x += '/'
		return url.href == x
	} catch (e) {
		return false
	}
}
export const hasValue = x => {
	try {
		if (!isDefined(x)) return false
		switch (typeof x) {
			case 'string': return isStr(x) && !!x.trim()
			case 'number': return isValidNumber(x)
			// for both array and object
			case 'object':
				if (isArr(x)) return x.length > 0
				if (isMap(x) || isSet(x)) return x.size > 0
				return Object.keys(x).length > 0
			case 'boolean':
			default: return true // already defined
		}
	} catch (_) {
		return false
	}
}

/**
 * @name	getKeys
 * @summary returns an Array of keys or indexes depending on input type
 * 
 * @param	{Array|Map|Object} source 
 * 
 * @returns {Array}
 */
export const getKeys = source => {
	if (isArr(source)) return source.map((_, i) => i)
	if (isMap(source)) return Array.from(source).map(x => x[0])
	if (isObj(source)) return Object.keys(source)
	return []
}

/**
 * @name	arrMapSlice
 * @summary mimics the behaviour of Array.map() with the convenience of only executing callback on range of indexes
 * 
 * @param {Array} 	 data 
 * @param {Number}   startIndex 
 * @param {Number}   endIndex 
 * @param {Function} callback   to be executed on each item within the set range
 *              				Params:
 *              				@currentValue
 *              				@currentIndex
 *              				@array
 * 
 * @returns {Array} list of all items returned by @callback
 */
export const arrMapSlice = (data, startIndex, endIndex, callback) => {
	const isAMap = isMap(data)
	if (!isArr(data) && !isAMap) return []
	const len = isAMap ? data.size : data.length
	data = isAMap ? Array.from(data) : data
	startIndex = startIndex || 0
	endIndex = !endIndex || endIndex >= len ? len - 1 : endIndex
	let result = []
	for (var i = startIndex;i <= endIndex;i++) {
		let key = i, value = data[i]
		if (isAMap) {
			key = data[i][0]
			value = data[i][1]
		}
		result.push(callback(value, key, data, isAMap))
	}
	return result
}

/**
 * @name	arrReadOnly
 * @summary sugar for `objReadOnly()` for an Array
 * 
 * @param	{Array}	input 
 * @param	{Boolean} strict
 * 
 * @returns {Array}
 */
export const arrReadOnly = (input, strict, silent) => objReadOnly(input, strict, silent)

/**
 * @name	arrReverse
 * @summary Reverse an array conditionally
 * 
 * @param	{Array}		arr
 * @param	{Boolean}	reverse	 (optional) condition to reverse the array.
 * 								 Default: true
 * @param	{Boolean}	newArray (optional) whether to cnstruct new array or use input.
 * 								 Default: true
 * 
 * @returns {Array}
 */
export const arrReverse = (arr, reverse = true, newArray = true) => {
	if (!isArr(arr)) return []
	if (newArray) arr = [...arr]
	return reverse
		? arr.reverse()
		: arr
}

/**
 * @name	arrSearch
 * @summary search array of objects
 * 
 * @param	{Array}	  arr 
 * @param	{Object}  keyValues  specific keys and respective values to search for
 * @param	{Boolean} matchExact (optional) whether to match the value exactly as specified in @keyValues
 * @param	{Boolean} matchAll   (optional) whether all or any supplied keys should match
 * @param	{Boolean} ignoreCase (optional)
 * @param	{Boolean} asArray    (optional) wheter to return result as Array or Map
 * 
 * @returns {Array|Map} Map (key = original index) or Array (index not preserved) if @returnArr == true
 */
export const arrSearch = (arr, keyValues, matchExact, matchAll, ignoreCase, asArray) => {
	const result = asArray
		? new Array()
		: new Map()
	if (!isObj(keyValues) || !isObjArr(arr)) return result

	const keys = Object.keys(keyValues)
	for (var index = 0;index < arr.length;index++) {
		let matched = false
		const item = arr[index]

		for (const i in keys) {
			const key = keys[i]
			let keyword = keyValues[key]
			let value = item[key]

			if (ignoreCase && isStr(value)) {
				value = value.toLowerCase()
				keyword = isStr(keyword)
					? keyword.toLowerCase()
					: keyword
			}

			matched = !matchExact && (isStr(value) || isArr(value))
				? value.indexOf(keyword) >= 0
				: value === keyword
			if ((matchAll && !matched) || (!matchAll && matched)) break
		}
		matched && (asArray
			? result.push(item)
			: result.set(index, item)
		)
	}
	return result
}

/**
 * @name	arrSort
 * @summary sort an array
 * 
 * @param	{Array}		arr array to sort 
 * @param	{String}	key (optional) name of the property, if object array
 * @param	{Boolean}	reverse (optional) reverse sort.
 * 						Default: false
 * @param	{Boolean}	caseInsensitive (optional) sort without the side-effects of case-sensitivenes.
 * 						Default: true
 * @param	{Boolean}	sortOriginal (optional) true => original array, false => keep original array unchanged.
 * 						Default: false
 * 
 * @returns {Array}	sorted array
 */
export const arrSort = (
	arr,
	key,
	reverse = false,
	caseInsensitive = true,
	sortOriginal = false
) => {
	let sortedArr = sortOriginal
		? arr
		: [...arr]

	const getValue = (obj, key) => {
		let value
		if (isObj(obj) && isDefined(key)) {
			value = obj[key]
		} else {
			value = obj
		}
		return isStr(value) && caseInsensitive
			? value.toLowerCase()
			: value
	}
	sortedArr = sortedArr.sort((a, b) =>
		getValue(a, key) > getValue(b, key)
			? 1
			: -1
	)

	return reverse
		? arrReverse(sortedArr, true)
		: sortedArr
}

/**
 * @name	arrToMap
 * @summary generate a Map from one or more arrays
 * 
 * @param {Array|Array[]}	arr 
 * @param {*}				key (optional) Array item property name to be uses as Map key.
 * 
 * @returns {Map}
 */
export const arrToMap = (arr, key, algo = 'blake2', bitLength = 64) => new Map(
	(arr || [])
		.flat()
		.filter(Boolean)
		.map(item => [
			key
			&& item?.[key]
			|| generateHash(
				item,
				algo,
				bitLength
			),
			item
		])
)

/**
 * @name	arrUnique
 * @summary constructs a new array of unique values
 * 
 * @param	{...any} args
 * 
 * @returns {Array}
 */
export const arrUnique = (...args) => Array.from(new Set([...args].flat()))

/**
 * @name	className
 * @summary formats supplied value into CSS class name compatible string for React
 * 
 * @param	{Object|Array} value 
 * 
 * @returns	{String}
 * 
 * @example ```JavaScript
 * const isSection = false
 * const isIcon = true
 * const withBorder = false
 * const str = className([
 *     'ui',
 *     { section: isSection, icon: isIcon },
 *     withBorder && 'bordered',
 * ])
 * 
 * // expected result: 'ui icon'
 * ```
 */
export const className = value => {
	if (isStr(value)) return value
	if (isObj(value)) {
		// convert into an array
		value = Object.keys(value)
			.map(key => !!value[key] && key)
	}
	if (!isArr(value)) return ''
	return value
		.filter(Boolean)
		.map(x => !isObj(x) ? x : className(x))
		.join(' ')
}

/**
 * @name	deferred
 * @summary returns a function that invokes the callback function after certain delay/timeout
 * 
 * @param	{Function}	callback 	function to be invoked after timeout
 * @param	{Number}	delay		(optional) timeout duration in milliseconds.
 * 									Default: 50
 * @param	{*}			thisArg		(optional) the special `thisArgs` to be used when invoking the callback.
 * 
 * @returns {Function}
 */
export const deferred = (
	callback,
	delay = 50,
	thisArg,
	tid
) => (...args) => {
	clearTimeout(tid)
	tid = setTimeout(
		callback?.bind?.(thisArg),
		delay,
		...args //arguments for callback
	)
}

/**
 * @name	deferredAsync
 * @summary deferred function that returns a promise which resolves/rejejcts based on `callback` result.
 * If a callback is ignored the promise will never resolve.
 * 
 * @param	{Function}	callback 	function to be invoked after timeout
 * @param	{Number}	delay		(optional) timeout duration in milliseconds.
 * 									Default: 50
 * @param	{*}			thisArg		(optional) the special `thisArgs` to be used when invoking the callback.
 * @param	{*}			tid			(optional) timeout id to be cleared on callback invocation.
 * 
 * @returns {Function}
 */
export const deferredAsync = (
	callback,
	delay = 50,
	thisArg,
	tid,
) => (...args) => {
	clearTimeout(tid)
	return new Promise((resolve, reject) => {
		tid = setTimeout(
			() => (async () => await callback?.call?.(thisArg, ...args))()
				.then(resolve, reject),
			delay,
		)
	})
}

/**
 * @name	getFuncParams
 * @summary extracts the parameter names of a given function. 
 * 
 * @param	{Function} func 
 * 
 * @returns {Array}
 */
export const getFuncParams = func => func
	.toString()
	.replace('function', '')
	.trim()
	.split('(')[1]
	.split(')')[0]
	.split(', ')

export const getUrlParam = (name, url) => {
	url ??= fallbackIfFails(() => window.location.href) || ''
	try {
		const search = '?' + (url.split('?')?.[1] || '')
		const params = new URLSearchParams(search)
		return name
			? params.get(name) || ''
			: [...params.keys()].reduce((obj, key) => ({
				...obj,
				[key]: params.get(key),
			}), {})
	} catch (_) {
		return getUrlParamRegex(name, url)
	}
}
/**
 * @name    getUrlParam
 * @summary read parameters of a given URL
 * 
 * @param   {String} name   (optional) if supplied will return a specific paramenter as string.
 *                          Otherwise, will return an object containing all the URL parameters with respective values.
 * @param   {String} url    
 * 
 * @returns {String|Object}
 */
export const getUrlParamRegex = (name, url) => {
	url ??= fallbackIfFails(() => window.location.href, [], '')
	const params = {}
	const regex = /[?&]+([^=&]+)=([^&]*)/gi
	url.replace(
		regex,
		(_, key, value) => params[key] = decodeURIComponent(value)
	)
	return name
		? params[name] || ''
		: params
}

/**
 * @name	objCopy
 * @summary deep-copy an object to another object
 * 
 * @param	{Object}	source	source object
 * @param	{Object}	dest	destination object
 * @param	{Array}		ignore	(optional) prevents @dest's property to be overriden 
 * 						    	if @source's property value is in the list
 *						    	Default: [undefined]
 * @returns {Object}
 */
export const objCopy = (source = {}, dest = {}, ignore = [undefined]) => {
	const sKeys = Object.keys(source)
	for (let i = 0;i < sKeys.length;i++) {
		const key = sKeys[i]
		if (dest.hasOwnProperty(key) && ignore.includes(source[key])) continue

		const value = source[key]
		if (isArrLike(value)) {
			let newValue = JSON.parse(JSON.stringify(Array.from(value)))
			if (isMap(value)) {
				newValue = new Map(newValue)
			} else if (isSet(value)) {
				newValue = new Set([...newValue])
			}
			dest[key] = newValue
		} else if (isObj(value)) {
			dest[key] = objCopy(source[key], dest[key], ignore)
		} else {
			dest[key] = value
		}
	}

	return dest
}

/** 
 * @name	objClean
 * @summary	constructs a new object with only the supplied property names (keys) and their respective values
 * 
 * @param	{Object}	obj
 * @param	{Array}		keys		property names
 * @param	{Boolean}	recursive	(optional) Default: `false`
 * @param	{Boolean}	ignoreIfNotExist (optional) if truthy, only include property if `obj.hasOwnProperty(key)`
 * 										 Default: `true`
 * 
 * @returns	{Object}
 */
export const objClean = (obj, keys, recursive = false, ignoreIfNotExist = true) => {
	if (!isObj(obj) || !isArr(keys)) return {}

	const result = {}
	for (let i = 0;i < keys.length;i++) {
		const key = keys[i]
		if (ignoreIfNotExist && !obj.hasOwnProperty(key)) continue

		let value = obj[key]
		result[key] = value
		// recursively clean up child property with object value
		if (!recursive || !isObj(value)) continue

		const childPrefix = `${key}.`
		let childKeys = keys.filter(k => k.startsWith(childPrefix))
		if (childKeys.length === 0) continue

		// get rid of child key prefix 
		childKeys = childKeys.map(k =>
			k.replace(new RegExp(childPrefix), '')
		)
		result[key] = objClean(
			value,
			childKeys,
			recursive,
		)
	}
	return result
}

/**
 * @name	objCreate
 * @summary constructs a new object with supplied key(s) and value(s)
 * 
 * @param	{Array}	keys
 * @param	{Array}		values	(optional)
 * @param	{Object}		result	(optional)
 * 
 * 
 * @returns	{Object}
 */
export const objCreate = (keys = [], values = [], result = {}) => {
	if (!isArr(keys) || !isArr(values) || !isObj(result)) return {}
	for (let i = 0;i < keys.length;i++) {
		const key = keys[i]
		const value = values[i]
		result[key] = value
	}
	return result
}

/**
 * @name	objEvalRxProps
 * @summary evaluate/extract values from properties with RxJS subject.
 * 
 * @param {Object}	obj 
 * @param {Array}	recursive property names of child objects to check and evaluate/extract RxJS subject value.
 * 
 * @returns {Object} a new object with RxJS subject values extracted for specified properties. 
 */
export const objEvalRxProps = (obj = {}, recursive = []) => {
	const output = { ...obj }
	Object
		.keys(output)
		.forEach(key => {
			output[key] = isSubjectLike(output[key])
				? output[key].value
				: recursive === true || recursive?.includes?.(key)
					? objEvalRxProps(output[key], false)
					: output[key]
		})

	return output
}

/**
 * @name	objHasKeys
 * @summary checks if all the supplied keys exists in a object
 * 
 * @param	{Object} 	obj 
 * @param	{Array} 	keys 
 * @param	{Boolean}	requireValue (optional) whether each property should have some value.
 * 
 * @returns {Boolean}
 */
export function objHasKeys(obj = {}, keys = [], requireValue = false) {
	if (!isObj(obj) || !isArr(keys)) return false

	for (let i = 0;i < keys.length;i++) {
		const key = keys[i]
		if (!obj.hasOwnProperty(key)) return false
		if (!requireValue) continue

		if (!hasValue(obj[key])) return false
	}
	return true
}

/**
 * @name	objReadOnly
 * @summary constructs a new read-only object where only new properties can be added.
 * 
 * @param	{Object}	obj 
 * @param	{Boolean}	strict	(optional) If true, any attempt to add or update property will fail.
 *					 			Otherwise, only new properties can be added but updates will fail.
 *								Default: false
 * @param	{Boolean}	silent	(optional) whether to throw error when property add/update fails.
 * 								Default: false
 * 
 * @returns	{Object}
 */
export const objReadOnly = (obj, strict = false, silent = false) => new Proxy(obj || {}, {
	setProperty: (self, key, value) => {
		// prevents adding new or updating existing property
		const isStrict = !isFn(strict)
			? strict === true
			: strict(self, key, value)
		if (isStrict) {
			if (silent) return true
			throw new TypeError(`Assignment to constant ${Array.isArray(obj) ? 'array' : 'object'} key: ${key}`)
		} else if (!self.hasOwnProperty(key)) {
			self[key] = value
		}
		return true
	},
	get: (self, key) => self[key],
	set: function (self, key, value) { return this.setProperty(self, key, value) },
	defineProperty: function (self, key) { return this.setProperty(self, key, value) },
	// Prevent removal of properties
	deleteProperty: () => false
})

/**
 * @name	objSetProp
 * @summary assign value to specified property
 * 
 * @param	{Object}	obj 
 * @param	{String}	key 
 * @param	{*}			value			
 * @param	{Boolean}	condition	(optional)
 * @param	{*}			valueAlt 	(optional) value to use if condition is truthy
 * @returns 
 */
export const objSetProp = (obj, key, val, condition, valAlt) => {
	obj[key] = !condition ? val : valAlt
	return obj
}

/**
 * @name	objSetProp
 * @summary assign value to specified property only if it is undefined
 * 
 * @param	{Object}	obj 
 * @param	{String}	key 
 * @param	{*}			value			
 * @param	{Boolean}	condition	(optional) 
 * @param	{*}			valueAlt 	(optional) value to use if condition is truthy
 * 
 * @returns {Object}
 */
export const objSetPropUndefined = (obj, key, v1, condition, v2) => {
	obj[key] === undefined && objSetProp(obj, key, v1, condition, v2)
	return obj
}

/**
 * @name	objSorted
 * @summary create a new object with properties sorted by name
 * 
 * @param	{Object} obj 
 * @param	{Array} keys 
 * 
 * @returns {Object} sorted object
 */
export const objSort = (obj, keys, ...args) => objClean(
	obj,
	keys
	|| Object
		.keys(obj)
		.sort(),
	...args
)

/**
 * @name	objToUrlParams
 * @summary	constructs URL param string from an object, excluding any `undefined` values
 * 
 * @param	{Object} obj
 * 
 * @returns	{String}
 */
export const objToUrlParams = (obj = {}, excludeUndefined = true) => {
	const params = new URLSearchParams()
	Object
		.keys(obj)
		.forEach(key => {
			const value = obj[key]
			if (value === undefined && excludeUndefined) return

			params.set(key, value)
		})
	return params.toString()
}
// Object.keys(obj)
// .map(key => {
// 	const value = obj[key]
// 	if (excludeUndefined && value === undefined) return
// 	const valueEscaped = !isArr(value)
// 		? escape(value)
// 		// prevents escaping comma when joining array
// 		: value.map(escape).join()
// 	return `${key}=${valueEscaped}`

// })
// .filter(Boolean)
// .join('&')

export const objToFormData = (obj = {}, excludeUndefined = true) => {
	let formData = new FormData()
	Object.keys(obj).forEach(key => {
		let value = obj[key]
		if (excludeUndefined && value === undefined) return
		if (isArr(value)) value = value.join()
		formData.append(key, value)
	})
	return formData
}

/**
 * @name	objWithoutKeys
 * @summary constructs a new object excluding specific properties
 * 
 * @param	{Object}	input 
 * @param	{Array}		keys	property names to exclude
 * @param	{Object}	output	(optional) to delete unwanted props from the original `input` use it here.
 * 								Default: a copy of the `input` object
 * 
 * @returns {Object}
 */
export const objWithoutKeys = (input, keys, output = { ...input }) => {
	if (!isObj(input)) return {}
	if (!isArr(keys) || !keys.length) return input

	for (let i = 0;i < keys.length;i++) {
		delete output[keys[i]]
	}
	return output
}

/**
 * @name	mapFilter
 * @summary Array.filter but for Map.
 * 
 * @param	{Map}		map 
 * @param	{Function}	callback 
 * 
 * @returns {Map}
 */
export const mapFilter = (map, callback) => {
	const result = new Map()
	if (!isMap(map)) return result
	if (!isFn(callback)) return map

	for (let [key, value] of map.entries()) {
		if (!callback(value, key, map)) return
		result.set(key, value)
	}
	return result
}

/**
 * @name	mapFindByKey
 * @summary finds a specific object by supplied object property/key and value within.
 * 
 * Unused??
 * 
 * @param	{Map}	  map 		 Map of objects
 * @param	{*}		  key 		 object key to match or null if value is not an object
 * @param	{*}		  value 
 * @param	{Boolean} matchExact 
 * 
 * @returns {*} first item partial/fully matching @value with supplied @key
 */
export const mapFindByKey = (map, key, value, matchExact) => {
	for (let [_, item] of map.entries()) {
		const val = key === null
			? item
			: item[key]
		const found = !matchExact && (isStr(val) || isArr(val))
			? val.indexOf(value) >= 0
			: val === value
		if (found) return item
	}
}

/**
 * @name	mapJoin
 * @summary creates a new Map by combining two or more Maps
 * 
 * @param	{Map[]|Array[]} maps...
 * 
 * @returns {Map}
 * 
 * @example	`javascript
 * const maps = [
 * 	new Map([['a', 1]]),
 * 	new Map([['b', 2]]),
 * ]
 * const joined = mapJoin(...maps) // Map(2) {'a' => 1, 'b' => 2}
 * 
 * // use 2D array
 * const maps = [
 * 	[['a', 1]],
 * 	[['b', 2]],
 * ]
 * const joined = mapJoin(...maps) // Map(2) {'a' => 1, 'b' => 2}
 * `
 */
export const mapJoin = (...maps) => new Map(
	maps
		.map(map => {
			const arr = fallbackIfFails(Array.from, [map], [])
			return isArr2D(arr)
				? arr
				: []
		})
		.flat()
)

/**
 * @name	mapSearch
 * @summary search for objects by key-value pairs
 * 
 * @param 	{Map}		map
 * @param 	{Object}	keyValues  key-value pairs
 * @param 	{Boolean}	matchAll   (optional) match all supplied key-value pairs
 * @param 	{Boolean}	ignoreCase (optional) case-insensitive search for strings
 *
 * @returns {Map}
 */
export const mapSearch = (map, keyValues, matchExact, matchAll, ignoreCase) => {
	const result = new Map()
	if (!isObj(keyValues) || !isMap(map)) return result

	const keys = Object.keys(keyValues)
	for (let [itemKey, item] of map.entries()) {
		let matched = false
		for (const i in keys) {
			const key = keys[i]
			let keyword = keyValues[key]
			let value = item[key]

			if (ignoreCase && isStr(value)) {
				value = value.toLowerCase()
				keyword = isStr(keyword) ? keyword.toLowerCase() : keyword
			}
			if (isValidNumber(value)) {
				// convert to string to enable partial match and avoid string and number type mismatch
				value = `${value}`
			}

			matched = !matchExact && (isStr(value) || isArr(value))
				? value.indexOf(keyword) >= 0
				: value === keyword
			// skip item if doesn't match according to preference
			if ((matchAll && !matched) || (!matchAll && matched)) break
		}
		matched && result.set(itemKey, item)
	}
	return result
}

/**
 * @name	mapSort
 * @summary	create a new map sorted by key. Values must be objects
 * 
 * @param	{Map}	 	map 
 * @param	{String}	key 
 * @param	{Boolen}	reverse True: accending sort. False: descending sort. Default: `false`
 * 
 * @returns {Map}
 */
// 
export const mapSort = (map, key, reverse = false, caseInsensitive = true) => {
	if (!isMap(map)) return map
	const arr2d = Array.from(map)
	if (!arr2d[0] || !isObj(arr2d[0][1])) return map

	const getValue = (obj, key1, key2) => {
		const value = fallbackIfFails(() => `${obj[key1][key2] || ''}`, [], '')
		return caseInsensitive
			? value.toLowerCase()
			: value
	}
	return new Map(
		arrReverse(
			arr2d.sort((a, b) =>
				getValue(a, 1, key) > getValue(b, 1, key)
					? 1
					: -1
			),
			reverse
		)
	)
}

/**
 * @name	randomInt
 * @summary generates random number within a range
 * 
 * @param	{Number} min lowest number
 * @param	{Number} max highest number
 * 
 * @returns {Number}
 */
export const randomInt = (min = 0, max = 1e12) => parseInt(Math.random() * (max - min) + min)

/**
 * @name	search
 * @summary Search Array or Map
 * 
 * @param	{Array|Map} data 
 * @param	{String}	query search query
 * @param	{Array}		keys  property names to search for
 * 
 * @returns {Array|Map}
 */
export const search = (data, query, keys = []) => {
	if (!query || query.length === 0 || !(isArr(data) || isMap(data))) return data
	const searchFunc = isMap(data)
		? mapSearch
		: arrSearch
	const keyValues = objCreate(
		keys,
		new Array(keys.length)
			.fill(query)
	)
	return searchFunc(data, keyValues, false, false, true, false)
}

/**
 * @name			searchRanked
 * @summary 		enhanced search for Dropdown
 * @description		Semantic UI Dropdown search defaults to only 'text' option property.
 * 					See FormInput for usage.
 * @param {Array}	searchKeys	Object properties (keys) to search for.
 * 								Default: ['text'] (for Dropdown and similar input fields)
 * @param {Number}  maxResults	limits maximum number of results returned.
 * 								Default: `100`
 * 
 * @returns	{Function}	a callback function. Params:
 *						@options 		array of objects
 *						@searchQuery	string
 *						returns array of objects
 */
export const searchRanked = (searchKeys = ['text'], maxResults = 100) => (options, searchQuery) => {
	if (!options || options.length === 0) return []
	if (!searchQuery) return options.slice(0, maxResults)

	const uniqueValues = {}
	const regex = new RegExp(escapeStringRegexp(searchQuery || ''), 'i')
	if (!searchQuery) return options.slice(0, maxResults)

	const search = key => {
		const matches = options.map((option, i) => {
			try {
				if (!option || !hasValue(option[key])) return

				// catches errors caused by the use of some special characters with .match() below
				let x = fallbackIfFails(() => JSON.stringify(option[key]), [], '')
					.match(regex)
				if (!x || uniqueValues[options[i].value]) return

				const matchIndex = x.index
				uniqueValues[options[i].value] = 1
				return { index: i, matchIndex }
			} catch (e) {
				console.log(e)
			}
		}).filter(Boolean)

		return arrSort(matches, 'matchIndex').map(x => options[x.index])
	}

	return searchKeys
		.reduce((result, key) => result.concat(search(key)), [])
		.slice(0, maxResults)
}

/**
 * @name	sort
 * @summary Sort Array or Map
 * 
 * @param {Array|Map} data 
 * @param {String}	  key		   (optional) property to sort by
 * @param {Boolean}   reverse	   (optional)
 * @param {Boolean}	  caseInsensitive (optional) Default: true
 * @param {Boolean}	  sortOriginal (optional) for Array only. 
 * 
 * @returns {Array|Map}
 */
export const sort = (data, key, reverse, caseInsensitive, sortOriginal) => {
	const sortFunc = isArr(data)
		? arrSort
		: isMap(data)
			? mapSort
			: () => data // return as is
	return sortFunc(
		data,
		key,
		reverse,
		caseInsensitive,
		sortOriginal,
	)
}

/**
 * @name 	strFill
 * @summary pre/post-fill a string
 * 
 * @param	{String}	str		text to pre/post-fill 
 * @param	{Number}	maxLen	maximum total length string to fill.
 * 								If string length is higher than `maxLen`, will leave as is.
 * 								Default: 2
 * @param	{String}	filler	string to fill
 * @param	{Boolean}	after	whether to add filler after or before @str.
 * 
 * @returns {String}
 */
export const strFill = (str, maxLen = 2, filler = ' ', after = false) => {
	str = `${str}`
	filler = `${filler}`
	const count = parseInt((maxLen - str.length) / filler.length)
	if (count <= 0) return str
	return arrReverse([filler.repeat(count), str], after).join('')
}

/**
 * @name	strTrim
 * @summary recursively remove leading and trailing spaces from string value(s).
 * 
 * @param	{String|Object|Array} value if unsupported value is passed it will remain unchanged.
 * 
 * @returns {*}
 */
export const strTrim = value => {
	if (isStr(value)) return value.trim()
	if (isObj(value, true) || isArr(value)) {
		Object
			.keys(value)
			.forEach(key =>
				value[key] = strTrim(value[key])
			)
	}
	return value
}

/**
 * @name	textCapitalize
 * @summary capitalizes the first letter of input
 * 
 * @param	{String|Object|Array} input 			
 * @param	{Boolean} 		fullSentence   (optional) whether to capitalize every single word or just the first word
 * @param	{Boolean}		forceLowercase (optional) convert string to lower case before capitalizing
 * @param	{Object|Array}	output		   (optional) create a new object or merge with existing one.
 * 										   Default: `input` (overrides texts)
 * 
 * @returns {*}
 */
export const textCapitalize = (
	input,
	fullSentence = false,
	forceLowercase = false,
	output = input,
) => {
	if (!input) return input
	if (isStr(input)) {
		if (forceLowercase) input = input.toLowerCase()
		if (!fullSentence) return input[0].toUpperCase() + input.slice(1)
		return input.split(' ')
			.map(word => textCapitalize(word, false))
			.join(' ')
	}
	if (!input || typeof input !== 'object') return ''


	Object
		.keys(input)
		.forEach(key =>
			output[key] = textCapitalize(
				input[key],
				fullSentence,
				forceLowercase,
			)
		)
	return output
	// return Object.keys(input)
	// 	.reduce((obj, key) => {
	// 		obj[key] = textCapitalize(
	// 			input[key],
	// 			fullSentence,
	// 			forceLowercase,
	// 		)
	// 		return obj
	// 	}, isArr(input) ? [] : {})
}

/**
 * @name	textEllipsis
 * @summary shortens string into 'abc...xyz' or 'abcedf...' form
 * 
 * @param	{string} text 
 * @param	{Number} maxLen	 maximum length of the shortened text including dots
 * @param	{Number} numDots (optional) number of dots to be inserted in the middle.
 * 							 Default: 3
 * @param	{Boolean} split  (optional) If false, will add dots at the end, otherwise, in the middle.
 * 							 Default: true
 * 
 * @returns {String}
 */
export const textEllipsis = (text, maxLen, numDots, split = true) => {
	if (!isStr(text)) return ''
	if (!maxLen || text.length <= maxLen) return text
	numDots = numDots || 3
	const textLen = maxLen - numDots
	const partLen = Math.floor(textLen / 2)
	const isEven = textLen % 2 === 0
	const arr = text.split('')
	const dots = new Array(numDots).fill('.').join('')
	const left = arr.slice(0, split ? partLen : maxLen - numDots).join('')
	const right = !split
		? ''
		: arr.slice(
			text.length - (isEven ? partLen : partLen + 1)
		).join('')
	return left + dots + right
}

/**
 * @name	toArray
 * @summary convert string or other itearables' values to Array
 * 
 * @param	{String|Array|Map|Set}	value 
 * @param	{String}				seperator (optional) only used when value is a string
 * 
 * @returns {Array}
 */
export const toArray = (value, seperator = ',') => isStr(value)
	? value
		.split(seperator)
		.filter(Boolean)
	: isFn((value || []).values)
		? [...value.values()]
		: []