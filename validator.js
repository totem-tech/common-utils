import { isStr, isBool, isValidNumber, hasValue, isInteger, isObj, isArr, objContains, isHash, isDate } from './utils'

let messages = {
    accept: 'value not acceptable',
    array: 'valid array required',
    boolean: 'boolean value required',
    date: 'a valid date required',
    email: 'a valid email address required',
    hex: 'a valid hexadecimal string required',
    integer: 'a valid integer required (no decimals)',
    lengthMax: 'maximum length exceeded',
    lengthMin: 'minimum length required',
    number: 'a valid number required',
    numberMax: 'number exceeds maximum allowed',
    numberMin: 'number is less than minimum required',
    object: 'valid object required',
    objectKeys: 'missing one or more required fields',
    required: 'required field',
    string: 'valid string required',
    type: 'invalid type',

    // non-TYPE specific
    unexpectedError: 'unexpected validation error occured'
}

const emailPattern = new RegExp(/^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,9}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i)
// Accepted validation types.
// Any type not listed here will be ignored.
export const TYPES = Object.freeze({
    array: 'array',
    boolean: 'boolean',
    date: 'date',
    email: 'email',
    hex: 'hex',
    integer: 'integer',
    number: 'number',
    object: 'object',
    string: 'string',
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
    const errorMsgs = { ...messages, ...customMessages }
    try {
        const { accept, keys, max, maxLength, min, minLength, required, type } = config || {}
        // if doesn't have any value (undefined/null) and not `required`, assume valid
        if (!hasValue(value)) return required ? errorMsgs.required : null
        let valueIsArr = false
        // validate value type
        switch (type) {
            case 'array':
                if (!isArr(value)) return errorMsgs.array
                valueIsArr = true
                break
            case 'boolean':
                if (!isBool(value)) return errorMsgs.boolean
                break
            case 'date':
                // validates both ISO string and Date object
                if (!isDate(new Date(value))) return errorMsgs.date
                break
            case 'email':
                if (!isStr(value) || !emailPattern.test(value)) return errorMsgs.email
                break
            case 'hex':
                if (!isHash(value)) return errorMsgs.hex
                break
            case 'integer':
                if (!isInteger(value)) return errorMsgs.integer
                break
            case 'number':
                if (!isValidNumber(value)) return errorMsgs.number
                if (isValidNumber(min) && value < min) return errorMsgs.numberMin
                if (isValidNumber(max) && value > max) return errorMsgs.numberMax
                break
            case 'object':
                if (!isObj(value)) return errorMsgs.object
                if (isArr(keys) && keys.length > 0 && !objContains(value, keys)) return errorMsgs.objectKeys
                break
            case 'string':
                if (!isStr(value)) return errorMsgs.string
                break
            default:
                // unsupported type
                if (isStr(type)) return errorMsgs.type
                // validation for unlisted types by checking if the value is an instance of `type`
                // (eg: ApiPromise, Bond, BN)
                if (!(value instanceof type)) return errorMsgs.type
        }

        // validate array/integer/number/string length
        if (isValidNumber(maxLength) && (valueIsArr ? value : `${value}`).length > maxLength)
            return `${errorMsgs.lengthMax}: ${maxLength}`
        if (isValidNumber(minLength) && (valueIsArr ? value : `${value}`).length < minLength)
            return `${errorMsgs.lengthMin}: ${minLength}`

        if (isArr(accept) && accept.length && !accept.includes(value)) return errorMsgs.accept

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
    const errorMsgs = { ...messages, ...customMessages }
    if (!isObj(obj)) return errorMsgs.object
    try {
        const keys = Object.keys(config)
        const errors = {}

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const value = obj[key]
            const keyConfig = config[key]
            let error = validate(value, keyConfig, errorMsgs)
            if (!error) continue
            const { label } = keyConfig
            error = !error ? null : `${includeLabel ? (label || key) + ' => ' : ''}${error}`
            if (failFast) return error
            errors[key] = error
        }
        return Object.keys(errors).length ? errors : null //(all supplied valid according to config)
    } catch (err) {
        return err
    }
}

export default {
    setMessages,
    TYPES,
    validate,
    validateObj,
}