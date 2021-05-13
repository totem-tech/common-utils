import {
    arrUnique,
    isAddress,
    isArr,
    isBool,
    isDate,
    isHash,
    isHex,
    isInteger,
    isObj,
    isStr,
    isValidNumber,
    hasValue,
    objHasKeys,
    isFn,
    isValidDate,
} from './utils'

export let messages = {
    accept: 'value not acceptable',
    array: 'valid array required',
    boolean: 'boolean value required',
    date: 'valid date required',
    dateMax: 'date date cannot be after',
    dateMin: 'date cannot be before',
    decimals: 'number exceeds maximum allowed decimals',
    email: 'valid email address required',
    hash: 'valid cryptographic hash string required',
    hex: 'valid hexadecimal string required',
    identity: 'valid identity required',
    integer: 'valid integer required (no decimals)',
    requiredKeys: 'missing one or more required fields',
    lengthMax: 'maximum length exceeded',
    lengthMin: 'minimum length required',
    number: 'valid number required',
    numberMax: 'number exceeds maximum allowed',
    numberMin: 'number is less than minimum required',
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

const emailPattern = new RegExp(/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,9}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i)
// Accepted validation types.
// Any type not listed here will be ignored.
export const TYPES = Object.freeze({
    array: 'array',
    boolean: 'boolean',
    date: 'date',
    email: 'email',
    hash: 'hash',
    hex: 'hex',
    identity: 'identity',
    integer: 'integer',
    number: 'number',
    object: 'object',
    string: 'string',
    url: 'url',
})

/**
 * @name    setMessages
 * @summary Overrides default error messages with custom/translated error messages
 * 
 * @param   {Object} msgObj Object with custom/translated messages. Must contain the correct keys.
 */
export const setMessages = msgObj => {
    if (!isObj(msgObj)) return
    messages = { ...messages, ...msgObj }
}

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
 * @returns {String|Null} null if no errors. Otherwise, error message.
 */
export const validate = (value, config, customMessages = {}) => {
    const errorMsgs = { ...messages, ...customMessages, }
    try {
        const {
            accept,
            decimals,
            instanceOf,
            keys,
            requiredKeys,
            max,
            maxLength,
            min,
            minLength,
            regex,
            reject,
            required,
            type,
            unique = false,
        } = config || {}

        // if doesn't have any value (undefined/null) and not `required`, assume valid
        if (!hasValue(value)) return required ? errorMsgs.required : null

        let valueIsArr = false
        // validate value type
        switch (type) {
            case 'array':
                if (!isArr(value)) return errorMsgs.array
                if (unique && arrUnique(value).length < value.length) return errorMsgs.unique
                valueIsArr = true
                break
            case 'boolean':
                if (!isBool(value)) return errorMsgs.boolean
                break
            case 'date':
                // validates both  string and Date object
                const date = new Date(value)
                // const isValidDate = isDate(date)
                if (!isValidDate(value)) return errorMsgs.date
                // makes sure auto correction didnt occur when using `new Date()`. 
                // Eg: 2020-02-30 is auto corrected to 2021-03-02)
                if (isStr(value) && date.toISOString().split('T')[0] !== value.replace(' ', 'T').split('T')[0])
                    return errorMsgs.date
                if (max && new Date(max) < date) return `${errorMsgs.dateMax} ${max}`
                if (min && new Date(min) > date) return `${errorMsgs.dateMin} ${min}`
                break
            case 'email':
                if (!isStr(value) || !emailPattern.test(value)) return errorMsgs.email
                break
            case 'hash':
                if (!isHash(value)) return errorMsgs.hash
                break
            case 'hex':
                if (!isHex(value)) return errorMsgs.hex
                break
            case 'identity':
                const { chainType, chainId, ignoreChecksum } = config || {}
                const isIdentityValid = isAddress(
                    value,
                    chainType,
                    chainId,
                    ignoreChecksum,
                )
                if (!isIdentityValid) return errorMsgs.identity
                break
            case 'integer':
                if (!isInteger(value)) return errorMsgs.integer
                break
            case 'number':
                if (!isValidNumber(value)) return errorMsgs.number
                if (isValidNumber(min) && value < min) return errorMsgs.numberMin
                if (isValidNumber(max) && value > max) return errorMsgs.numberMax
                if (isValidNumber(decimals) && decimals >= 0) {
                    if (decimals === 0) {
                        if (!isInteger(value)) return errorMsgs.integer
                        break
                    }
                    const len = (value.toString().split('.')[1] || '').length
                    if (len > decimals) return `${errorMsgs.decimals}: ${decimals}`
                }
                break
            case 'object':
                if (!isObj(value)) return errorMsgs.object
                if (
                    isArr(keys)
                    && keys.length > 0
                    && !objHasKeys(value, keys), requiredKeys
                ) return errorMsgs.requiredKeys
                break
            case 'string':
                if (!isStr(value)) return errorMsgs.string
                break
            case 'url':
                try {
                    const url = new URL(value)
                    // catch any auto-correction by `new URL()`. 
                    // Eg: spaces in the domain name being replaced by`%20` or missing `/` in protocol being auto added
                    if (url.href !== value) return errorMsgs.url
                } catch (e) {
                    return errorMsgs.url
                }
                break
            default:
                // validation for unlisted types by checking if the value is an instance of `type`
                // (eg: ApiPromise, BN)
                try {
                    if (!(value instanceof instanceOf)) return errorMsgs.instanceof || errorMsgs.type
                } catch (_) { }
                // unsupported type
                return errorMsgs.type
        }

        // valid only if value `accept` array includes `value` or items in `value` array
        if (isArr(accept) && accept.length) {
            // if `value` is array all items in it must be in the `accept` array
            const valid = !valueIsArr
                ? accept.includes(value)
                : value.every(v => accept.includes(v))
            if (!valid) return errorMsgs.accept
        }
        // valid only if value `reject` array does not include the `value` or items in `value` array
        if (isArr(reject) && reject.length) {
            const valid = !valueIsArr
                ? !reject.includes(value)
                : value.every(v => !reject.includes(v))
            if (!valid) return errorMsgs.reject
        }

        // validate regex expression
        if (regex instanceof RegExp && !regex.test(value)) return errorMsgs.regex

        // validate array/integer/number/string length
        const len = (valueIsArr ? value : `${value}`).length
        if (isValidNumber(maxLength) && len > maxLength) return `${errorMsgs.lengthMax}: ${maxLength}`
        if (isValidNumber(minLength) && len < minLength) return `${errorMsgs.lengthMin}: ${minLength}`

        // valid according to the config
        return null
    } catch (err) {
        return `${errorMsgs.unexpectedError}. ${err}`
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
        if (!isObj(obj)) return errorMsgs.object

        const keys = Object.keys(config)
        let errors = {}

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const value = obj[key]
            const keyConfig = config[key]
            const {
                config: childConf,
                customMessages: keyErrMsgs,
                label,
                type,
            } = keyConfig
            let error = validate(
                value,
                keyConfig,
                {
                    // combine error messages
                    ...errorMsgs,
                    ...keyErrMsgs,
                },
            )
            const validateChildProps = !error
                && type === TYPES.object
                && isObj(childConf)
                && isObj(value)
            if (validateChildProps) {
                // property is an object type and contains validation confirguration for it's own properties
                error = validateObj(
                    value,
                    childConf,
                    failFast,
                    includeLabel,
                    keyErrMsgs,
                )
                // error is an object. 
                error && !failFast && Object.keys(error)
                    .forEach(propKey =>
                        errors[`${key}.${propKey}`] = error[propKey]
                    )
            }
            if (!error) continue
            if (includeLabel) error = `${label || key} => ${error}`
            if (failFast) return error

            // combine all errors into a single object
            errors[key] = error
        }

        return Object.keys(errors).length ? errors : null // all valid according to config
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