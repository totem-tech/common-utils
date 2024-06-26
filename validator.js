import { translated } from './languageHelper'
import {
    arrUnique,
    EMAIL_REGEX,
    hasValue,
    isAddress,
    isArr,
    isBool,
    isDefined,
    isHash,
    isHex,
    isInteger,
    isObj,
    isStr,
    isValidDate,
    isValidNumber,
    objHasKeys,
    objWithoutKeys,
    isValidURL,
    isFn,
    fallbackIfFails,
    isMap,
} from './utils'

export const messages = {
    accept: 'value not acceptable',
    array: 'valid array required',
    boolean: 'boolean value required',
    date: 'valid date required',
    dateMax: 'value must be smaller or equal to',
    dateMin: 'value must be greater or equal to',
    decimals: 'value exceeds maximum allowed decimals',
    email: 'valid email address required',
    function: 'valid function required',
    hash: 'valid cryptographic hash string required',
    hex: 'valid hexadecimal string required',
    identity: 'valid identity required',
    integer: 'valid integer required (no decimals)',
    requiredKeys: 'missing one or more required fields',
    lengthMax: 'maximum length exceeded',
    lengthMin: 'minimum length required',
    number: 'valid number required',
    numberMax: 'value must be smaller or equal to',
    numberMin: 'value must be greater or euqal to',
    object: 'valid object required',
    regex: 'invalid string pattern',
    regexError: 'regex validation failed',
    reject: 'value not acceptable',
    required: 'required field',
    string: 'valid string required',
    type: 'invalid data type',
    unique: 'array must not contain duplicate values',
    url: 'invalid URL',

    // non-TYPE specific
    unexpectedError: 'unexpected validation error occured',
}
translated(messages, true)
export const messagesAlt = {
    numberMax: 'max',
    numberMin: 'min',
    lengthMax: 'maxLength',
    lengthMin: 'minLegnth',
}
// Accepted validation types.
// Any type not listed here will be ignored.
export const TYPES = Object.freeze({
    array: 'array',
    boolean: 'boolean',
    date: 'date',
    email: 'email',
    function: 'function',
    hash: 'hash',
    hex: 'hex',
    identity: 'identity',
    integer: 'integer',
    map: 'map',
    number: 'number',
    object: 'object',
    string: 'string',
    url: 'url',
})

const errorConcat = (message, ...suffix) => {
    if (!isStr(message)) return message

    return [message, ...suffix].join(' ')
}

/**
 * @name    setMessages
 * @summary Overrides default error messages with custom/translated error messages
 * 
 * @param   {Object} messagesOverrides Object with custom/translated messages. Must contain the correct keys.
 */
export const setMessages = (messagesOverrides = {}) => {
    isObj(messagesOverrides) && Object
        .keys(messagesOverrides)
        .forEach(key => messages[key] = messagesOverrides[key])
    return messages
}

// if msg is falsy, returns true
const msgOrTrue = (msg, value) => !msg || msg === true
    ? true
    : `${msg}${isDefined(value) ? ': ' + value : ''}`

/**
 * @name    validate
 * @summary validate single value
 * 
 * @param   {*} value 
 * @param   {Object} config 
 * @param   {String|Object} customMessages if `string`, all errors will use a single message.
 * 
 * @example 
 * <BR>
 *
 * ```javascript
 * validate(123456, { max: 9999, min: 0, required: true, type: TYPES.number})
 * ```
 * 
 * @returns {String|Null} null if valid according to supplied config. Otherwise, validation error message.
 */
export const validate = (value, config, customMessages = {}) => {
    const errorMsgs = {
        ...messages,
        ...customMessages,
        ...config.customMessages,
    }

    // If error message is falsy change it to `true`
    Object
        .keys(errorMsgs)
        .forEach(key => errorMsgs[key] = errorMsgs[key] || true)
    try {
        let err
        let {
            accept,
            decimals,
            config: propertiesAlt, // to be deprecated
            failFast,
            includeLabel,
            includeValue = true,
            instanceOf,
            label,
            max,
            maxLength,
            min,
            minLength,
            name,
            properties = propertiesAlt,
            or, // alternative validation configaration if validation fails
            regex,
            reject,
            required,
            requiredKeys,
            strict, // for url or object types
            type,
            unique = false,
        } = config || {}
        const _msgOrTrue = (msg, value) => msgOrTrue(
            isStr(config.customMessages)
                ? config.customMessages
                : msg,
            includeValue
                ? value
                : undefined
        )
        properties = !isArr(properties)
            ? properties
            : properties // turn properties array into an object validation config
                .filter(x => !!x.name) // must have a name of the property
                .reduce((obj, item) => ({
                    ...obj,
                    [item.name]: item,
                }), { required, type: TYPES.object })
        // default strict mode for the following types
        strict ??= [
            TYPES.email,
            TYPES.hex,
        ].includes(type)

        const gotValue = hasValue(value)
        // const typeErrMsg = errorMsgs[type]
        if (isObj(or) && !!TYPES[or.type]) {
            const configWithoutOr = objWithoutKeys(config, ['or'])
            err = validate(value, configWithoutOr, errorMsgs)
            if (!err) return null

            const errOr = validate(value, or, errorMsgs)
            // alternative config validated successfully
            if (!errOr) return null

            return typeof value === or.type
                ? errOr
                : err
            // // primary validation
            // if (!err && gotValue || err !== typeErrMsg) return err
            // // secondary (or) validation
            // return validate(value, or, errorMsgs)
        }
        // if doesn't have any value (undefined/null) and not `required`, assume valid
        if (!gotValue) return required
            ? _msgOrTrue(errorMsgs.required)
            : null

        let valueIsArr, valueIsMap, valueIsObj

        // validate value type
        switch (type) {
            case TYPES.array:
                if (!isArr(value)) return _msgOrTrue(errorMsgs.array)
                if (unique && arrUnique(value).length < value.length) return _msgOrTrue(errorMsgs.unique)
                valueIsArr = true
                break
            case TYPES.boolean:
                if (!isBool(value)) return _msgOrTrue(errorMsgs.boolean)
                break
            case TYPES.date:
                // validates both  string and Date object
                const date = new Date(value)
                // const isValidDate = isDate(date)
                if (!isValidDate(value)) return _msgOrTrue(errorMsgs.date)
                // makes sure auto correction didnt occur when using `new Date()`. 
                // Eg: 2020-02-30 is auto corrected to 2021-03-02)
                const dateInvalid = isStr(value)
                    && date.toISOString().split('T')[0] !== value.replace(' ', 'T').split('T')[0]
                if (dateInvalid) return _msgOrTrue(errorMsgs.date)
                if (max && new Date(max) < date) return _msgOrTrue(errorMsgs.dateMax, max)
                if (min && new Date(min) > date) return _msgOrTrue(errorMsgs.dateMin, min)
                break
            case TYPES.email:
                if (!isStr(value)) return _msgOrTrue(errorMsgs.email)
                const x = value.split('@')[0]
                const allowPlus = !strict && !x.startsWith('+')
                    && !x.endsWith('+')
                    && (x.match(/\+/g) || []).length === 1
                if (allowPlus) value = value.replace('+', '')
                if (!EMAIL_REGEX.test(value)) return _msgOrTrue(errorMsgs.email)
                break
            case TYPES.function:
                if (!isFn(value)) return _msgOrTrue(errorMsgs.function)
                break
            case TYPES.hash:
                if (!isHash(value)) return _msgOrTrue(errorMsgs.hash)
                break
            case TYPES.hex:
                const prefix = !strict
                    && isStr(value)
                    && !value.startsWith('0x')
                    && '0x'
                    || ''
                if (!isHex(prefix + value)) return _msgOrTrue(errorMsgs.hex)
                break
            case TYPES.identity:
                const {
                    chainType,
                    chainId,
                    ignoreChecksum
                } = config || {}
                const isIdentityValid = isAddress(
                    value,
                    chainType,
                    chainId,
                    ignoreChecksum,
                )
                if (!isIdentityValid) return _msgOrTrue(errorMsgs.identity)
                break
            case TYPES.integer:
                if (!isInteger(value)) return _msgOrTrue(errorMsgs.integer)
                break
            case TYPES.map:
                if (!isMap(value)) return _msgOrTrue(errorMsgs.map)
                valueIsMap = true
                break
            case TYPES.number:
                if (!isValidNumber(value)) return _msgOrTrue(errorMsgs.number)
                if (isValidNumber(min) && value < min) return _msgOrTrue(
                    errorMsgs.min ?? errorMsgs.numberMin,
                    min
                )
                if (isValidNumber(max) && value > max) return _msgOrTrue(
                    errorMsgs.max ?? errorMsgs.numberMax,
                    max
                )
                if (isValidNumber(decimals) && decimals >= 0) {
                    if (decimals === 0) {
                        if (!isInteger(value)) return _msgOrTrue(errorMsgs.integer)
                        break
                    }
                    const len = `${value || ''}`
                        .split('.')[1]
                        ?.length || 0
                    if (len > decimals) return _msgOrTrue(errorMsgs.decimals, decimals)
                }
                break
            case TYPES.object:
                if (!isObj(value, strict)) return _msgOrTrue(errorMsgs.object)
                if (
                    isArr(requiredKeys)
                    && requiredKeys.length > 0
                    && !objHasKeys(value, requiredKeys)
                ) return _msgOrTrue(errorMsgs.requiredKeys)
                valueIsObj = true
                // validate child properties of the `value` object
                err = properties && validateObj(
                    value,
                    properties,
                    failFast,
                    includeLabel,
                    errorMsgs,
                    includeValue,
                )
                if (err) return err
                break
            case TYPES.string:
                if (!isStr(value)) return _msgOrTrue(errorMsgs.string)
                break
            case TYPES.url:
                try {
                    if (!isStr(value)) throw errorMsgs.url

                    const url = new URL(value)
                    // Hack to fix comparison failure due to a trailing slash automatically added by `new URL()`
                    if (url.href.endsWith('/') && !value.endsWith('/')) value += '/'

                    const urlInvalid = url.host.endsWith('.')
                        || url.hostname.endsWith('.')
                        || strict && (
                            // make sure domain extension is provided
                            // Or if domain starts with www both extension and name is provided
                            url.host.split('.').length <= (url.host.startsWith('www.') ? 2 : 1)
                            // catch any auto-correction by `new URL()`. 
                            // Eg: spaces in domain name being replaced by `%20`
                            // or missing `//` in protocol being added.
                            // When `new URL('https:google.com').href` is turned inot 'https://google.com/'
                            || url.href.toLowerCase() !== value.toLowerCase()
                        )
                    if (urlInvalid) throw errorMsgs.url
                } catch (e) {
                    return _msgOrTrue(errorMsgs.url)
                }
                break
            default:
                // validation for unlisted types by checking if the value is an instance of `type`
                // (eg: ApiPromise, BN)
                try {
                    if (!(value instanceof instanceOf)) return _msgOrTrue(errorMsgs.instanceof || errorMsgs.type)
                } catch (_) { }
                // unsupported type
                return _msgOrTrue(errorMsgs.type)
        }

        // valid only if value `accept` array includes `value` or items in `value` array
        if (isArr(accept) && accept.length) {
            // if `value` is array all items in it must be in the `accept` array
            const valid = !valueIsArr
                ? accept.includes(value)
                : !value.find(v => !accept.includes(v))
            if (!valid) return _msgOrTrue(errorMsgs.accept)
        }
        // valid only if value `reject` array does not include the `value` or items in `value` array
        if (isArr(reject) && reject.length) {
            const valid = !valueIsArr
                ? !reject.includes(value)
                : !value.find(v => reject.includes(v))
            if (!valid) return _msgOrTrue(errorMsgs.reject)
        }

        // if regex is an Array, assume it as arguments to instantiate `RegExp` object
        if (isArr(regex)) regex = new RegExp(...regex)
        // validate regex expression
        if (regex instanceof RegExp && !regex.test(value)) return _msgOrTrue(errorMsgs.regex)

        // validate array/integer/number/string length
        const len = (valueIsArr ? value : `${value}`).length
        if (isValidNumber(maxLength) && len > maxLength) return _msgOrTrue(
            errorMsgs.maxLength ?? errorMsgs.lengthMax,
            maxLength
        )
        if (isValidNumber(minLength) && len < minLength) return _msgOrTrue(
            errorMsgs.minLength ?? errorMsgs.lengthMin,
            minLength
        )

        // WIP: validate children | test required
        const validateChildren = [TYPES.array, TYPES.map].includes(type) && isObj(properties)
        if (validateChildren) {
            const items = valueIsArr
                ? value
                : valueIsMap
                    ? [...value].map(([_, item]) => item)
                    : valueIsObj
                        ? [value]
                        : []
            for (let i = 0;i < items.length;i++) {
                err = validateObj(
                    items[i],
                    {
                        label: valueIsObj
                            ? label
                            : `${label} [${i}]`,
                        name: valueIsObj
                            ? name
                            : `${name}[${i}]`,
                        ...properties,
                    },
                    failFast,
                    includeLabel,
                    errorMsgs,
                    includeValue,
                )
                if (err) return _msgOrTrue(err)
            }
        }
        // valid according to the config
        return null
    } catch (err) {
        return errorConcat(errorMsgs.unexpectedError, '\n', err)
    }
}

/**
 * @name    validateObj
 * @summary validate object property values
 * 
 * @param   {Object}  obj         object with values to validate
 * @param   {Object}  config      configuration to validate specific keys in the object
 * @param   {Boolean} failFast    whether to return on first error
 * @param   {Boolean} includeLabel whether to include property name in the error
 * @param   {Boolean|String|Object} customMessages if `string`, all errors will use a single message.
 * If `true`, will return true for all messages
 * @param   {Boolen}  includeValue whether to include value in the error (where applicable)
 * 
 * @example
 * <BR>
 *
 * ```javascript
 * const valueObj = { name: 'some name', age: 23 }
 * const config = {
 *      name: {
 *          maxLength: 32,
 *          minLength: 3,
 *          required: true,
 *          type: TYPES.string,
 *      },
 *      age: {
 *          max: 50,
 *          maxLength: 2,
 *          min: 18,
 *          name: 'Minimum age', // alternate name to be used instead of the key with error
 *          required: true,
 *          type: TYPES.integer,
 *      }
 * }
 * validateObj(valueObj, { max: 9999, min: 0, required: true, type: TYPES.number})
 * ```
 * 
 * @returns {String|Object|Null} Null if no errors. If @failFast, String otherwise, Object with one or more errors.
 */
export const validateObj = (
    obj = {},
    config = {},
    failFast = true,
    includeLabel = true,
    customMessages = {},
    includeValue = true,
) => {
    try {
        const errorMsgs = {
            ...messages,
            ...customMessages,
            ...(isStr(customMessages) || isBool(customMessages))
            && Object
                .keys(messages)
                .reduce((obj, key) => ({
                    ...obj,
                    [key]: customMessages,
                }), {})
        }
        if (!isObj(obj, config.strict || false)) return msgOrTrue(errorMsgs.object)

        const keys = Object.keys(config)
        let errors = {}

        for (let i = 0;i < keys.length;i++) {
            const key = keys[i]
            const value = obj[key]
            const keyConf = config[key]
            if (!isObj(keyConf, false)) continue

            const {
                // config: childConf,
                customMessages: entryMsgs,
                label,
                name,
                // type,
            } = keyConf
            let error = validate(
                value,
                {
                    failFast,
                    includeLabel,
                    includeValue,
                    ...keyConf,
                },
                isStr(entryMsgs)
                    ? entryMsgs
                    // combine error messages
                    : { ...errorMsgs, ...entryMsgs },
            )
            if (!error) continue

            if (includeLabel) {
                const errKey = isStr(label)
                    && label // In case used with FormInput and label an element
                    || name
                    || key
                error = `${errKey} => ${error}`
            }
            if (failFast) return error

            // combine all errors into a single object
            errors[key] = error
        }

        return Object.keys(errors).length
            ? errors
            : null // all valid according to config
    } catch (err) {
        return err
    }
}

export default {
    messages,
    setMessages,
    TYPES,
    validate,
    validateObj,
}