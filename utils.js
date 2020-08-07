import { Bond } from 'oo7'
import { blake2AsHex } from '@polkadot/util-crypto'
import { ss58Decode } from './convert'

// trim texts
export const clearClutter = x => x.split('\n').map(y => y.trim()).filter(Boolean).join(' ')

/*
 * Copies supplied string to system clipboard
 */
export const copyToClipboard = str => {
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

export const downloadFile = (content, fileName, contentType) => {
	const a = document.createElement("a")
	const file = new Blob([content], { type: contentType })
	a.href = URL.createObjectURL(file)
	a.download = fileName
	a.click()
}

export const generateHash = (seed, algo = 'blake2', bitLength = 256) => {
	switch (algo) {
		case 'blake2':
			seed = isUint8Arr(seed) ? seed : (
				isStr(seed) ? seed : JSON.stringify(seed)
			)
			return blake2AsHex(seed, bitLength)
		// ToDo: add support for other algo from Polkadot/utils-crypto
	}
	return // unsuporrted
}

/*
 * Data validation
 */
// checks if supplied is a valid ss58 address string
export const isAddress = x => {
	try {
		ss58Decode(x)
		return true
	} catch (e) {
		return false
	}
}
export const isArr = x => Array.isArray(x)
// isArr2D checks if argument is a 2-dimentional array
export const isArr2D = x => isArr(x) && isArr(x[0])
export const isAsyncFn = x => x instanceof (async () => { }).constructor
export const isBool = x => typeof x === 'boolean'
export const isBond = x => x instanceof Bond
// Date object can sometimes be "Invalid Date" without any timestamp.
// Date.getUTCMilliseconds() is used to make sure it's a valid Date
export const isDate = x => x instanceof Date && isValidNumber(x.getUTCMilliseconds())
export const isDefined = x => x !== undefined && x !== null
export const isFn = x => typeof x === 'function'
export const isHash = x => x.startsWith('0x')
export const isMap = x => x instanceof Map
export const isObj = x => x !== null && !isArr(x) && typeof x === 'object'
// Checks if argument is an Array of Objects. Each element type must be object, otherwise will return false.
export const isObjArr = x => !isArr(x) ? false : !x.reduce((no, item) => no || !isObj(item), false)
// Checks if argument is a Map of Objects. Each element type must be object, otherwise will return false.
export const isObjMap = x => !isMap(x) ? false : !Array.from(x).reduce((no, item) => no || !isObj(item[1]), false)
export const isPromise = x => x instanceof Promise
export const isStr = x => typeof x === 'string'
export const isUint8Arr = arr => arr instanceof Uint8Array
export const isValidNumber = x => typeof x == 'number' && !isNaN(x) && isFinite(x)
export const hasValue = x => {
	if (!isDefined(x)) return false
	switch (typeof x) {
		case 'string': return isStr(x) && !!x.trim()
		case 'number': return isValidNumber(x)
		case 'object': return Object.keys(x).length > 0
		case 'boolean':
		default: return true // already defined
	}
}

// randomInt generates random number within a range
//
// Params:
// @min		number
// @max		number
// 
// returns number
export const randomInt = (min, max) => parseInt(Math.random() * (max - min) + min)

// getKeys returns an array of keys or indexes depending on object type
export const getKeys = source => {
	if (isArr(source)) return source.map((_, i) => i)
	if (isMap(source)) return Array.from(source).map(x => x[0])
	if (isObj(source)) return Object.keys(source)
	return []
}

// arrMapSlice mimics the behaviour of Array.prototype.map() with the
// convenience of only executing callback on range of indexes
//
// Params:
// @arr         array
// @startIndex  number
// @endIndex    number    : inclusive
// @callback    function  : callback to be executed on each item within the set range
//              Params:
//              @currentValue
//              @currentIndex
//              @array
//
// Returns array of items all returned by @callback
export const arrMapSlice = (data, startIndex, endIndex, callback) => {
	const isAMap = isMap(data)
	if (!isArr(data) && !isAMap) return []
	const len = isAMap ? data.size : data.length
	data = isAMap ? Array.from(data) : data
	startIndex = startIndex || 0
	endIndex = !endIndex || endIndex >= len ? len - 1 : endIndex
	let result = []
	for (var i = startIndex; i <= endIndex; i++) {
		let key = i, value = data[i]
		if (isAMap) {
			key = data[i][0]
			value = data[i][1]
		}
		result.push(callback(value, key, data, isAMap))
	}
	return result
}

// Read-only array
export const arrReadOnly = (arr = [], strict = false) => objReadOnly(arr, strict)

// Reverse array items
export const arrReverse = (arr, reverse = true, newArray = true) => {
	if (!isArr(arr)) return []
	arr = !newArray ? arr : [...arr]
	return reverse ? arr.reverse() : arr
}

// arrSearch search for objects by key-value pairs
//
// Params:
// @map			Map
// @keyValues	Object	: key-value pairs
// @matchAll	boolean 	: match all supplied key-value pairs
// @ignoreCase	boolean	: case-insensitive search for strings
//
// Returns Map (key = original index) or Array (index not preserved) if @returnArr == true
export const arrSearch = (arr, keyValues, matchExact, matchAll, ignoreCase, returnArr) => {
	const result = returnArr ? new Array() : new Map()
	if (!isObj(keyValues) || !isObjArr(arr)) return result
	const keys = Object.keys(keyValues)
	for (var index = 0; index < arr.length; index++) {
		let matched = false
		const item = arr[index]
		for (const i in keys) {
			const key = keys[i]
			let keyword = keyValues[key]
			let value = item[key]

			if (ignoreCase && isStr(value)) {
				value = value.toLowerCase()
				keyword = isStr(keyword) ? keyword.toLowerCase() : keyword
			}

			matched = !matchExact && (isStr(value) || isArr(value)) ? value.indexOf(keyword) >= 0 : value === keyword
			if ((matchAll && !matched) || (!matchAll && matched)) break
		}
		matched && (returnArr ? result.push(item) : result.set(index, item))
	}
	return result
}

// Returns new array sorted by key. If sortOriginal is 'truty', existing array will be sorted and returned.
export const arrSort = (arr, key, reverse = false, sortOriginal = false) => {
	if (!isObjArr(arr)) return []
	const sortedArr = (sortOriginal ? arr : [...arr])
		.sort((a, b) => a[key] > b[key] ? 1 : -1)

	return reverse ? arrReverse(sortedArr, true) : sortedArr
}

// arrUnique returns unique values in an array
export const arrUnique = (arr = []) => Object.values(
	arr.reduce((itemsObj, item) => {
		itemsObj[item] = item
		return itemsObj
	}, {})
)

// className formats supplied value into CSS class name compatible string for React
//
// Params:
// @value	string/object/array: if object supplied, 
//							key		string: CSS class
//							value	boolean: whether to include the key to the final output
export const className = value => {
	if (isStr(value)) return value
	if (isObj(value)) {
		// convert into an array
		value = Object.keys(value).map(key => !!value[key] && key)
	}
	if (isArr(value)) return value.filter(Boolean).join(' ')
}

// objContains tests if an object contains all the supplied keys/properties
//
// Params:
// @obj		object
// @keys	array: list of required properties in the object
//
// Returns	boolean
export const objContains = (obj = {}, keys = []) => {
	if (!isObj(obj) || !isArr(keys)) return false
	for (let i = 0; i < keys.length; i++) {
		if (!obj.hasOwnProperty(keys[i])) return false
	}
	return true
}

// objCopy copies top level properties and returns another object
//
// Params:
// @source  object
// @dest    object (optional)
// @force	boolean (optional) force create new object
export const objCopy = (source, dest, force) => !isObj(source) ? dest || {} : (
	Object.keys(source).reduce((obj, key) => {
		obj[key] = source[key]
		return obj
	}, !force ? (dest || {}) : objCopy(dest, {}))
)

// objClean produces a clean object with only the supplied keys and their respective values
//
// Params:
// @obj		object/array
// @keys	array : if empty/not array, an empty object will be returned
//
// Returns object
export const objClean = (obj, keys) => !isObj(obj) || !isArr(keys) ? {} : keys.reduce((cleanObj, key) => {
	if (obj.hasOwnProperty(key)) {
		cleanObj[key] = obj[key]
	}
	return cleanObj
}, {})

// objCreate constructs a new object with supplied key(s) and value(s)
//
// Params:
// @key		string/array
// @value	any/array
//
// Returns	object
export const objCreate = (key, value) => {
	const obj = {}
	if (!isArr(key)) {
		obj[key] = value
		return obj
	}
	// arrays of keys and values supplied
	value = !isArr(value) ? [value] : value
	key.forEach(k => obj[k] = value[key])
	return obj
}
// objHasKeys checks if all the supplied keys exists in a object
//
// Params:
// @obj				object
// @keys			array
// @requireValue	book	: (optional) if true, will check if all keys has valid value
//
// returns boolean
export const objHasKeys = (obj = {}, keys = [], requireValue = false) => {
	return !keys.reduce((no, key) => no || (requireValue ? !hasValue(obj[key]) : !obj.hasOwnProperty(key)), false)
}

// objReadOnly returns a new read-only object where only new properties can be added.
//
// Params:
// @obj	   object/array : (optional) if valid object supplied, new object will be created based on @obj.
//					 Otherwise, new empty object will be used.
//					 PS: original supplied object's properties will remain writable, unless re-assigned to the returned object.
// @strict boolean: (optional) if true, any attempt to add or update property to returned object will throw a TypeError.
//					 Otherwise, only new properties can be added. Attempts to update properties will be silently ignored.
// @silent boolean: (optional) whether to throw error when in strict mode
//
// Returns  object
export const objReadOnly = (obj = {}, strict = false, silent = false) => new Proxy(obj, {
	setProperty: (self, key, value) => {
		// prevents adding new or updating existing property
		if (strict === true) {
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

// objWithoutKeys creates a new object excluding specified keys
// 
// Params:
// @obj		object
// @keys	array
//
// Returns object
export const objWithoutKeys = (obj, keys) => !isObj(obj) || !isArr(keys) ? {} : (
	Object.keys(obj).reduce((result, key) => {
		if (keys.indexOf(key) === -1) {
			result[key] = obj[key]
		}
		return result
	}, {})
)

export const mapFilter = (map, callback) => {
	const result = new Map()
	if (!isMap(map)) return result

	Array.from(map).forEach(x => {
		const key = x[0]
		const value = x[1]
		if (callback(value, key, map)) {
			result.set(key, value)
		}
	})
	return result
}
// mapFindByKey finds a specific object by supplied object property/key and value within
//
// Params:
// @map		Map: Map of objects
// @key		any: object key to match or null if value is not an object
// @value	any
//
// Returns Object: first item partial/fully matching @value with supplied @key
export const mapFindByKey = (map, key, value, matchExact) => {
	for (let [_, item] of map.entries()) {
		const val = key === null ? item : item[key]
		if (!matchExact && (isStr(val) || isArr(val)) ? val.indexOf(value) >= 0 : val === value) return item
	}
}

// mapJoin joins (and overrides) key-value pairs from @source to @dest
export const mapJoin = (source = new Map(), dest = new Map()) => {
	Array.from(source).forEach(([key, value]) => dest.set(key, value))
	return dest
}

// mapSearch search for objects by key-value pairs
//
// Params:
// @map			Map
// @keyValues	Object	: key-value pairs
// @matchAll	boolean 	: match all supplied key-value pairs
// @ignoreCase	boolean	: case-insensitive search for strings
//
// Returns Map
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

			matched = !matchExact && (isStr(value) || isArr(value)) ? value.indexOf(keyword) >= 0 : value === keyword
			if ((matchAll && !matched) || (!matchAll && matched)) break
		}
		matched && result.set(itemKey, item)
	}
	return result
}

// Returns a new map sorted by key. Must be a map of objects
export const mapSort = (map, key, reverse) => !isObjMap(map) ? map : new Map(arrReverse(
	Array.from(map).sort((a, b) => a[1][key] > b[1][key] ? 1 : -1),
	reverse
))

// Search Array or Map
export const search = (data, keywords, keys) => {
	if (!keywords || keywords.length === 0 || !(isArr(data) || isMap(data))) return data
	const fn = isMap(data) ? mapSearch : arrSearch
	const keyValues = keys.reduce((obj, key) => {
		obj[key] = keywords
		return obj
	}, {})
	return fn(data, keyValues, false, false, true, false)
}

// Semantic UI Dropdown search defaults to only "text" option property.
// This enables search by any option property (`searchKeys`).
//
// Params:
// @searchKeys	array of strings
//
// Returns function: a callback function
// 					Callback params:
//					@options 		array of objects
//					@searchQuery	string
//					returns array of objects
export const searchRanked = (searchKeys = ['text']) => (options, searchQuery) => {
	if (!options || options.length === 0) return []
	const uniqueValues = {}
	searchQuery = (searchQuery || '').toLowerCase().trim()
	if (!searchQuery) return options
	const search = key => {
		const matches = options.map((option, i) => {
			try {
				// catches errors caused by the use of some special characters with .match() below
				let x = (option[key] || '').toLowerCase().match(searchQuery)
				if (!x || uniqueValues[options[i].value]) return
				const matchIndex = x.index
				uniqueValues[options[i].value] = 1
				return { index: i, matchIndex }
			} catch (e) {
				console.log(e)
			}
		}).filter(r => !!r)
		return arrSort(matches, 'matchIndex').map(x => options[x.index])
	}

	return searchKeys.reduce((result, key) => result.concat(search(key)), [])
}

// Sort Array or Map
export const sort = (data, key, reverse, sortOriginal) => isArr(data) ? arrSort(data, key, reverse, sortOriginal) : (
	isMap(data) ? mapSort(data, key, reverse) : data
)

/**
 * @name 	strFill
 * @summary pre/post-fill a string
 * @param {String}	str text to pre/post-fill 
 * @param {Number}	maxLen maximum total length of result string. Default: 2
 * @param {String}	filler string to fill
 * @param {Boolean}	after whether to add filler after or before @str.
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
// deferred returns a function that invokes the callback function after certain delay/timeout
// If the returned function is invoked again before timeout,
// the invokation will be deferred further with the duration supplied in @delay
//
// Params:
// @callback  function  : function to be invoked after deferred delay
// @delay     number    : number of milliseconds to be delayed.
//                        Default value: 50
// @thisArg    object   : optional, makes sure callback is bounded to supplied object 
export const deferred = (callback, delay, thisArg) => {
	if (!isFn(callback)) return // nothing to do!!
	let timeoutId
	return function () {
		const args = arguments
		if (timeoutId) clearTimeout(timeoutId)
		timeoutId = setTimeout(() => callback.apply(thisArg, args), delay || 50)
	}
}

// textCapitalize capitalizes the first letter of the given string(s)
//
// Params:
// @text			string/array/object
// @fullSentence	bool: whether to capitalize every single word or just the first word
// @forceLowercase	bool: convert string to lower case before capitalizing
//
// Returns string/array/object (same as input if supported otherwise undefined)
export const textCapitalize = (input, fullSentence = false, forceLowercase = false) => {
	if (!input) return input
	if (isStr(input)) {
		if (forceLowercase) input = input.toLowerCase()
		if (!fullSentence) return input[0].toUpperCase() + input.slice(1)
		return input.split(' ').map(word => textCapitalize(word, false)).join(' ')
	}
	if (isObj(input)) return Object.keys(input).reduce((obj, key) => {
		obj[key] = textCapitalize(input[key], fullSentence, forceLowercase)
		return obj
	}, isArr(input) ? [] : {})
}

// textEllipsis shortens string into 'abc...xyz' or 'abcedf... form
//
// Params: 
// @text    string
// @maxLen  number: maximum length of the shortened text including dots
// @numDots number: number of dots to be inserted in the middle. Default: 3
// @split   boolean: if false, will add dots at the end
//
// Returns string
export const textEllipsis = (text, maxLen, numDots, split = true) => {
	text = !isStr(text) ? '' : text
	maxLen = maxLen || text.length
	if (text.length <= maxLen || !maxLen) return text
	numDots = numDots || 3
	const textLen = maxLen - numDots
	const partLen = Math.floor(textLen / 2)
	const isEven = textLen % 2 === 0
	const arr = text.split('')
	const dots = new Array(numDots).fill('.').join('')
	const left = arr.slice(0, split ? partLen : maxLen).join('')
	const right = !split ? '' : arr.slice(text.length - (isEven ? partLen : partLen + 1)).join('')
	return left + dots + right
}

// default icons used in Message component
export const icons = {
	basic: '',
	error: 'exclamation circle',
	loading: { name: 'circle notched', loading: true },
	info: 'info',
	success: 'check circle outline',
	warning: 'lightning'
}