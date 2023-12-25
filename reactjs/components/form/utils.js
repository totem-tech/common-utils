import { BehaviorSubject } from 'rxjs'
import {
    hasValue,
    isArr,
    isDefined,
    isSubjectLike,
    objEvalRxProps,
} from '../../../utils'

/**
 * @name    addMissingProps
 * @summary add missing properties that are required to use `FormInput` component
 * 
 * @param   {Object} input 
 * @param   {*}      nameSuffix     (optional) used as suffix to generate `name` property if not already defined.
 *                                  Default: incremented number
 * 
 * @returns {Object} input
 */
export const addMissingProps = (input, nameSuffix = ++addMissingProps.count) => {
    if (input._init_) return input

    input.inputProps ??= {}
    const {
        id,
        inputProps: ip,
        inputs: childInputs,
        name,
        onChange,
        type = ip?.type,
    } = input
    input._init_ = 'yes'
    if (type === 'group') {
        childInputs?.forEach?.(addMissingProps)
        return input
    }

    ip.type ??= type || 'text'
    ip.name ??= name || `${ip.type}${nameSuffix}`
    ip.id ??= id || ip.name
    ip.onChange ??= onChange
    return input
}
addMissingProps.count = 10000

/**
 * @name    checkInput
 * @summary checks if everything is okay with an input: value is valid, not loading, not hidden....
 * 
 * @param   {Object}    _input
 * @param   {Array}     inputsHidden    (optional) names of hidden inputs
 * @param   {Array}     evalRecursive   (optional) property names to check and evaluate/extract RxJS subject value.
 * 
 * @returns {Boolean} true: submit button should be disabled
 */
export const checkInputInvalid = (
    input,
    inputsHidden = [],
    evalRecursive = ['inputProps']
) => {
    const _input = objEvalRxProps(input, evalRecursive)
    let {
        checkedValue = true,
        error,
        loading,
        name,
        required,
        type,
        valid,
        value: _value,
        rxValue: value = _value,
    } = { ..._input, ..._input?.inputProps }
    const isValid = error !== true && valid !== false
    const ignore = inputsHidden.includes(name)
        || [
            'group',
            'hidden',
            'html',
        ].includes(type)
    if (ignore) return false
    if (error || loading) return true

    const isEmpty = ['checkbox', 'radio'].includes(`${type}`.toLowerCase())
        ? checkedValue !== value
        : !hasValue(value)
    // value must be valid if not empty or required field
    const invalid = isEmpty
        ? required?.value ?? required
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
 * @param   {Boolean}   addRxValue populate `rxValue` property with `new BehaviorSubject()` if required.
 * 
 * @returns {Array} inputs
 */
export const fillInputs = (
    inputs = [],
    values = {},
    addRxValue = true,
) => {
    inputs.forEach(input => {
        if (addRxValue) input.rxValue ??= new BehaviorSubject('')
        input.inputProps ??= {}
        const {
            inputs: childInputs,
            inputProps: { name: _name },
            name = _name,
            rxValue,
        } = input
        if (isArr(childInputs)) fillInputs(childInputs, values)

        if (!values.hasOwnProperty(name)) return

        const value = values[name]
        input.inputProps.value = value
        // if value is RxJS subject trigger a value change
        rxValue?.next?.(value)
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
export const getValues = (
    inputs = [],
    values = {}
) => inputs.reduce((values, input) => {
    const {
        inputs: childInputs,
        name: _name,
        rxValue,
        inputProps: {
            name = _name,
            value = rxValue?.value,
        } = {},
    } = input
    values[name] = isArr(childInputs)
        ? getValues(childInputs, values)
        : value
    return values
}, values)