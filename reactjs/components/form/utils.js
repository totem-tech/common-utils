import {
    hasValue,
    isArr,
    isDefined,
    isSubjectLike,
    randomInt,
} from '../../../utils'

/**
 * @name    addMissingProps
 * @summary add missing properties that are required to use `FormInput` component
 * 
 * @param   {Object} input 
 * @param   {*}      keyPrefix      (optional) used as prefix to generate `key` property if not already defined.
 *                                  Default: random number
 * 
 * @returns {Object} input
 */
export const addMissingProps = (input, keyPrefix = randomInt(99, 9999)) => {
    input.inputProps ??= {}
    const {
        id,
        inputProps: ip,
        inputs: childInputs,
        name,
        type = ip?.type,
    } = input
    if (type === 'group') {
        childInputs?.forEach?.(addMissingProps)
        return input
    }

    ip.type ??= type || 'text'
    ip.name ??= name || `${ip.type}${keyPrefix}`
    ip.id ??= id || ip.name
    return input
}

/**
 * @name    checkInput
 * @summary checks if everything is okay with an input: value is valid, not loading, not hidden....
 * 
 * @param   {Object} input 
 * 
 * @returns {Boolean} true: submit button should be disabled
 */
export const checkInputInvalid = (input, inputsHidden = []) => {
    let {
        inputProps = {},
        rxValue,
        valid,
        type = typeAlt
    } = input
    let {
        error,
        loading,
        name,
        required,
        type: typeAlt,
        value,
    } = inputProps
    value = rxValue?.value || value
    const isValid = error !== true && valid !== false
    const ignore = inputsHidden.includes(name)
        || [
            'group',
            'hidden',
            'html',
        ].includes(type)
    if (ignore) return false
    if (error || loading) return true

    const isEmpty = !hasValue(value)
    // value must be valid if not empty or required field
    const invalid = isEmpty
        ? required
        : !isValid

    return invalid
}

// one or more input's value has changed
export const checkValuesChanged = (
    inputs,
    values = {},
    valuesOriginal = {},
    inputsHidden = []
) => inputs
    .find(({ name }) => {
        if (inputsHidden.includes(name)) return
        const newValue = isDefined(values[name])
            ? values[name]
            : ''
        const oldValue = isDefined(valuesOriginal[name])
            ? valuesOriginal[name]
            : ''
        return newValue !== oldValue
    }) !== undefined

/**
 * @name    fillInputs
 * @summary fill inputs with values
 * 
 * @param   {Array}     inputs 
 * @param   {Object}    values 
 * 
 * @returns {Array} inputs
 */
export const fillInputs = (inputs = [], values = []) => {
    inputs.forEach(input => {
        const {
            inputs: childInputs,
            name,
        } = input
        if (isArr(childInputs)) return fillInputs(childInputs, values)

        if (!values.hasOwnProperty(name)) return

        const value = values[name]
        // if value is RxJS subject trigger a value change
        if (isSubjectLike(input.value)) return input.value.next(value)

        input.value = value
    })
    return inputs
}

/**
 * @name    findInputs
 * @summary recursively search for input by name
 * 
 * @param   {String}    name 
 * @param   {Array}     inputs 
 * 
 * @returns {Object} input
 */
export const findInput = (name, inputs = []) => {
    inputs = isSubjectLike(inputs)
        ? inputs.value
        : inputs
    for (let i = 0;i < inputs.length;i++) {
        if (name === inputs[i]?.inputProps?.name) return inputs[i]

        const children = inputs[i].inputs
        if (!isArr(children)) continue

        const child = findInput(name, children)
        if (child) return child
    }
}

/**
 * @name    getValues
 * @summary extract values from inputs
 * 
 * @param   {Array} inputs 
 * 
 * @returns {Object} values
 */
export const getValues = (inputs = [], values = {}) => inputs
    .reduce((values, input) => {
        const {
            inputs: childInputs,
            inputProps,
            name: _name,
            rxValue,
        } = input
        const {
            name = _name,
            value = rxValue?.value,
        } = inputProps
        values[name] = isArr(childInputs)
            ? getValues(childInputs, values)
            : value
        return values
    }, values)