import { isStr, isBool, isValidNumber, hasValue, isInteger, isObj, isArr, objContains, isHash, isDate } from './utils'

let messages = {
    accept: 'value not acceptable',
    array: 'value must be an array',
    boolean: 'value must be a boolean',
    date: 'value must be a valid date',
    hex: 'value must be a valid hexadecimal string',
    integer: 'value must be a valid integer (no decimals)',
    lengthMax: 'exceeded maximum length',
    lengthMin: 'required minimum length',
    number: 'value must be a number',
    numberMax: 'number exceeds maximum allowed',
    numberMin: 'number is less than minimum required',
    object: 'value must be an object',
    objectKeys: 'missing one or more required properties',
    string: 'value must be a string',
    required: 'missing required field',
}

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

// Accepted validation types.
// Any type not listed here will be ignored.
export const TYPES = Object.freeze({
    array: 'array',
    boolean: 'boolean',
    date: 'date',
    hex: 'hex',
    integer: 'integer',
    number: 'number',
    object: 'object',
    string: 'string',
})

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
export const validate = (value, config) => {
    try {
        const { accept, keys, max, maxLength, min, minLength, required, type } = config || {}
        if (!hasValue(value) && required) return messages.required
        let valueIsArr = false
        // validate value type
        switch (type) {
            case 'array':
                if (isArr(value)) return messages.array
                valueIsArr = true
                break
            case 'boolean':
                if (!isBool(value)) return messages.boolean
                break
            case 'date':
                // validates both ISO string and Date object
                if (!isDate(new Date(value))) return messages.date
                break
            case 'hex':
                if (!isHash(value)) return messages.hex
                break
            case 'integer':
                if (!isInteger(value)) return messages.integer
                break
            case 'number':
                if (!isValidNumber(value)) return messages.number
                if (isValidNumber(min) && value < min) return messages.numberMin
                if (isValidNumber(max) && value > max) return messages.numberMax
                break
            case 'object':
                if (!isObj(value)) return messages.object
                if (isArr(keys) && keys.length > 0 && !objContains(value, keys)) return messages.objectKeys
            case 'string':
                if (!isStr(value)) return messages.string
                break
        }

        // validate array/integer/number/string length
        if (isValidNumber(maxLength) && (valueIsArr ? value : `${value}`).length > maxLength)
            return messages.lengthMax
        if (isValidNumber(minLength) && (valueIsArr ? value : `${value}`).length < minLength)
            return messages.lengthMin

        if (isArr(accept) && accept.length && !accept.includes(value)) return messages.accept


        // valid according to the config
        return null
    } catch (err) {
        return err
    }
}

/**
 * @name    validateObj
 * @summary validate object property values
 * 
 * @param   {Object}  obj         object with values to validate
 * @param   {Object}  config      configuration to validate specific keys in the object
 * @param   {Boolean} failFast    whether to return on first error
 * @param   {Boolean} includeName whether to include property name in the error
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
export const validateObj = (obj = {}, config = {}, failFast = true, includeName = true) => {
    if (!isObj(obj)) return messages.object
    try {
        const keys = Object.keys(config)
        const errors = {}

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const value = obj[key]
            const keyConfig = config[key]
            let error = validate(value, keyConfig)
            if (!error) continue
            const { name } = keyConfig
            error = !error ? null : `${includeName ? (name || key) + ': ' : ''}${error}`
            if (failFast) return error
            errors[key] = error
        }
        return Object.keys(errors).length ? errors : null //(all supplied valid according to config)
    } catch (err) {
        return err
    }
}