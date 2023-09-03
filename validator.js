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
const _msgOrTrue = (msg, value) => !msg || msg === true
    ? true
    : `${msg}${isDefined(value) ? ': ' + value : ''}`

/**
 * @name    validate
 * @summary validate single value
 * 
 * @param   {*} value 
 * @param   {Object} config 
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
            config: propertiesAlt,
            failFast,
            includeLabel,
            instanceOf,
            requiredKeys,
            max,
            maxLength,
            min,
            minLength,
            properties: childConf = propertiesAlt,
            or, // alternative validation configaration if validation fails
            regex,
            reject,
            required,
            strict, // for url or object types
            type,
            unique = false,
        } = config || {}
        strict ??= type !== TYPES.email

        const gotValue = hasValue(value)
        const typeErrMsg = errorMsgs[type]
        if (isObj(or) && !!TYPES[or.type]) {
            const configWithoutOr = objWithoutKeys(config, ['or'])
            err = validate(value, configWithoutOr, errorMsgs)
            // primary validation
            if (!err && gotValue || err !== typeErrMsg) return err
            // secondary (or) validation
            return validate(value, or, errorMsgs)
        }
        // if doesn't have any value (undefined/null) and not `required`, assume valid
        if (!gotValue) return required ? _msgOrTrue(errorMsgs.required) : null

        let valueIsArr = false
        // validate value type
        switch (type) {
            case 'array':
                if (!isArr(value)) return _msgOrTrue(errorMsgs.array)
                if (unique && arrUnique(value).length < value.length) return _msgOrTrue(errorMsgs.unique)
                valueIsArr = true
                break
            case 'boolean':
                if (!isBool(value)) return _msgOrTrue(errorMsgs.boolean)
                break
            case 'date':
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
            case 'email':
                if (!isStr(value)) return _msgOrTrue(errorMsgs.email)
                const x = value.split('@')[0]
                const allowPlus = !strict && !x.startsWith('+')
                    && !x.endsWith('+')
                    && (x.match(/\+/g) || []).length === 1
                if (allowPlus) value = value.replace('+', '')
                if (!EMAIL_REGEX.test(value)) return _msgOrTrue(errorMsgs.email)
                break
            case 'function':
                if (!isFn(value)) return _msgOrTrue(errorMsgs.function)
                break
            case 'hash':
                if (!isHash(value)) return _msgOrTrue(errorMsgs.hash)
                break
            case 'hex':
                if (!isHex(value)) return _msgOrTrue(errorMsgs.hex)
                break
            case 'identity':
                const { chainType, chainId, ignoreChecksum } = config || {}
                const isIdentityValid = isAddress(
                    value,
                    chainType,
                    chainId,
                    ignoreChecksum,
                )
                if (!isIdentityValid) return _msgOrTrue(errorMsgs.identity)
                break
            case 'integer':
                if (!isInteger(value)) return _msgOrTrue(errorMsgs.integer)
                break
            case 'number':
                if (!isValidNumber(value)) return _msgOrTrue(errorMsgs.number)
                if (isValidNumber(min) && value < min) return _msgOrTrue(errorMsgs.numberMin)
                if (isValidNumber(max) && value > max) return _msgOrTrue(errorMsgs.numberMax)
                if (isValidNumber(decimals) && decimals >= 0) {
                    if (decimals === 0) {
                        if (!isInteger(value)) return _msgOrTrue(errorMsgs.integer)
                        break
                    }
                    const len = (value.toString().split('.')[1] || '').length
                    if (len > decimals) return _msgOrTrue(errorMsgs.decimals, decimals)
                }
                break
            case 'object':
                if (!isObj(value)) return _msgOrTrue(errorMsgs.object)
                if (
                    isArr(requiredKeys)
                    && requiredKeys.length > 0
                    && !objHasKeys(value, requiredKeys)
                ) return _msgOrTrue(errorMsgs.requiredKeys)
                // validate child properties of the `value` object
                err = isObj(childConf, strict) && validateObj(
                    value,
                    childConf,
                    failFast,
                    includeLabel,
                    errorMsgs,
                )
                if (err) return err
                break
            case 'string':
                if (!isStr(value)) return _msgOrTrue(errorMsgs.string)
                break
            case 'url':
                try {
                    if (!isStr(value)) return _msgOrTrue(errorMsgs.url)

                    const url = new URL(value)
                    // Hack to fix comparison failure due to a trailing slash automatically added by `new URL()`
                    if (url.href.endsWith('/') && !value.endsWith('/')) value += '/'

                    // catch any auto-correction by `new URL()`. 
                    // Eg: spaces in the domain name being replaced by`%20` or missing `//` in protocol being auto added
                    if (strict && url.href.toLowerCase() !== value.toLowerCase()) return _msgOrTrue(errorMsgs.url)
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
                : value.every(v => accept.includes(v))
            if (!valid) return _msgOrTrue(errorMsgs.accept)
        }
        // valid only if value `reject` array does not include the `value` or items in `value` array
        if (isArr(reject) && reject.length) {
            const valid = !valueIsArr
                ? !reject.includes(value)
                : value.every(v => !reject.includes(v))
            if (!valid) return _msgOrTrue(errorMsgs.reject)
        }

        // if regex is an Array, assume it as arguments to instantiate `RegExp` object
        if (isArr(regex)) regex = new RegExp(...regex)
        // validate regex expression
        if (regex instanceof RegExp && !regex.test(value)) return _msgOrTrue(errorMsgs.regex)

        // validate array/integer/number/string length
        const len = (valueIsArr ? value : `${value}`).length
        if (isValidNumber(maxLength) && len > maxLength) return _msgOrTrue(errorMsgs.lengthMax, maxLength)
        if (isValidNumber(minLength) && len < minLength) return _msgOrTrue(errorMsgs.lengthMin, minLength)

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
export const validateObj = (obj = {}, config = {}, failFast = true, includeLabel = true, customMessages = {}) => {
    try {
        const errorMsgs = { ...messages, ...customMessages }
        if (!isObj(obj, config.strict || false)) return _msgOrTrue(errorMsgs.object)

        const keys = Object.keys(config)
        let errors = {}

        for (let i = 0;i < keys.length;i++) {
            const key = keys[i]
            const value = obj[key]
            const keyConf = config[key]
            const {
                // config: childConf,
                customMessages: keyErrMsgs,
                label,
                name,
                // type,
            } = keyConf
            let error = validate(
                value,
                {
                    ...keyConf,
                    failFast: isBool(keyConf.failFast)
                        ? keyConf.failFast
                        : failFast,
                    includeLabel: isBool(keyConf.includeLabel)
                        ? keyConf.includeLabel
                        : includeLabel,
                },
                {
                    // combine error messages
                    ...errorMsgs,
                    ...keyErrMsgs,
                },
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