import PropTypes from 'prop-types'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { BehaviorSubject } from 'rxjs'
import { translated } from '../../../languageHelper'
import {
    arrUnique,
    deferred,
    isArr,
    isFn,
    isSubjectLike,
    toArray,
} from '../../../utils'
import { useRxSubject, useRxSubjectOrValue } from '../../hooks'
import toProps from '../../toProps'
import _Button from '../Button'
import { Message as _Message, statuses } from '../Message'
import _FormInput from './FormInput'
import {
    addMissingProps,
    checkInputInvalid,
    checkValuesChanged,
    findInput,
    getValues
} from './utils'

const textsCap = {
    close: 'close',
    submit: 'submit',
    submitError: 'failed to submit form!',
}
translated(textsCap, true)

const formIds = new Map()
const defaultComponents = {
    Button: 'button',
    Form: 'form',
    FormInput: _FormInput,
    Message: _Message,
}
export const FormBuilder = React.memo(props => {
    let {
        actionsPrefix,
        actionsSuffix,
        components,
        submitButtonLoadingProp: loadingProp,
        closeText = textsCap.close,
        closeOnSubmit,
        formProps = {},
        inputs,
        inputsCommonProps,
        inputsDisabled = [],
        inputsHidden = [],
        inputsModifier,
        inputsReadOnly = [],
        loading,
        message,
        onChange: formOnChange,
        onClose,
        onMount,
        onSubmit,
        onUnmount,
        prefix,
        submitDisabled, // Boolean or BehaviorSubject
        submitDisabledIfUnchanged: requireChange = false,
        submitInProgress,// Boolean or BehaviorSubject
        submitText, // string or element or object
        suffix,
        values: _values, // Object or BehaviorSubject
        valuesToCompare,
    } = props
    let { // default components
        Actions = 'div',
        Button = _Button,
        Form = 'form',
        FormInput = _FormInput,
        Message = _Message,
    } = { ...defaultComponents, ...components }
    const [formId] = useState(() => {
        window.___formCount ??= 1000
        if (!formProps.id || formIds.get(formProps.id)) {
            formProps.id = `${formProps.id || 'FormBuilder'}${++___formCount}`
        }
        formIds.set(formProps.id, true)
        return formProps.id
    })
    const [_message, setMessage] = useState()
    inputsHidden = toArray(useRxSubjectOrValue(inputsHidden), ',')
    message = useRxSubjectOrValue(message)
    submitInProgress = useRxSubjectOrValue(submitInProgress)
    submitDisabled = useRxSubjectOrValue(submitDisabled)
    valuesToCompare = useRxSubjectOrValue(valuesToCompare)
    const [values, _setValues] = useRxSubject(
        _values,
        x => x || {},
        _values || valuesToCompare,
        false,
        true,
    )
    const [_inputs, _setInputs] = useRxSubject(inputs, (inputs = []) => {
        inputs?.forEach?.(addMissingProps)
        return inputs
    })
    // delay form state update when multiple update is triggered concurrently/too frequently
    const setState = useMemo(() =>
        deferred(({ inputs, values }) => {
            inputs && _setInputs([...inputs])
            values && _setValues({ ...values })
        }, 50),
        [],
    )
    message = _message || message
    loading = loading
        || submitInProgress
        || message?.status === statuses.loading

    const handleChangeCb = useCallback((name, inputs) => async (event, { error, value }) => {
        inputs = isSubjectLike(inputs)
            ? inputs.value
            : inputs
        const input = name && findInput(name, inputs)
        if (!input) return

        const { inputProps } = input
        inputProps.error = error
        inputProps.value = value
        input.valid = error !== true

        const {
            inputProps: {
                onChange,
            } = {},
        } = input
        const triggerChange = (values) => {
            values = values || getValues(inputs)
            setState({ inputs, values })
        }

        // clear submit error message
        if (_message) setTimeout(() => setMessage())

        let values = getValues(inputs)
        let doTrigger = await onChange?.(
            values,
            inputs,
            event,
        )

        if (!isFn(formOnChange)) return doTrigger !== false && triggerChange()

        const formValid = !_inputs.find(x => checkInputInvalid(x, inputsHidden))
        doTrigger = await formOnChange(
            formValid,
            doTrigger
                ? getValues(_inputs)
                : values,
            _inputs,
            name,
        )

        doTrigger !== false && triggerChange()
    })

    const handleSubmit = useCallback(async (event) => {
        event.preventDefault()
        if (submitDisabled || loading) return
        try {
            const values = getValues(_inputs)
            const allOk = !loading
                && !submitDisabled
                && !_inputs.find(x => checkInputInvalid(x, inputsHidden))
            isFn(onSubmit) && await onSubmit(
                allOk,
                values,
                _inputs,
                event,
            )
            closeOnSubmit && onClose?.()
        } catch (err) {
            setMessage({
                header: textsCap.submitError,
                text: `${err}`
                    .replace('Error: ', ''),
            })
        }
    })

    // disable submit button if one of the following is true:
    // 1. none of the input's value has changed
    // 2. message status or form is "loading" (indicates submit or some input validation is in progress)
    // 3. one or more inputs contains invalid value (based on validation criteria)
    // 4. one or more required inputs does not contain a value
    inputsHidden = arrUnique([
        ...inputsHidden,
        ..._inputs
            .filter(({ inputProps = {} }) => {
                const { hidden, name } = inputProps
                return !inputsHidden.includes(name) && (
                    isSubjectLike(hidden)
                        ? hidden.value
                        : isFn(hidden)
                            ? !!hidden(values, name)
                            : hidden
                )
            })
            .map(x => x.inputProps.name)
    ])
    submitDisabled = submitDisabled
        || submitInProgress
        || loading
        || !!_inputs.find(x => checkInputInvalid(x, inputsHidden))
        || requireChange && checkValuesChanged(
            _inputs,
            values,
            valuesToCompare,
            inputsHidden,
        )

    useEffect(() => {
        onMount?.(
            props,
            formId,
            values,
            submitDisabled,
        )
        return () => onUnmount?.(
            props,
            formId,
            values,
            submitDisabled,
        )
    }, [])

    const getButton = (textOrProps, extraProps) => {
        if (textOrProps === null) return
        const {
            Component = Button,
            ...props
        } = toProps(textOrProps)
        return (
            <Component {...{
                ...props,
                ...extraProps,
                children: props.children || extraProps.children,
                onClick: (...args) => {
                    args[0]?.preventDefault?.()
                    props.onClick?.(...args)
                    extraProps?.onClick?.(...args)
                },
                style: {
                    ...extraProps?.style,
                    ...props.style,
                },
            }} />
        )
    }

    return (
        <Form {...{
            autoComplete: 'off',
            className: 'form-builder',
            noValidate: true,
            ...formProps,
        }}>
            {prefix}

            {/* Form inputs */}
            {_inputs
                .map(addInterceptorCb(
                    inputs,
                    inputsHidden,
                    values,
                    handleChangeCb,
                    props,
                    formId,
                ))
                .map(input => <FormInput {...input} xkey={input.key} />)}

            {/* submit button */}
            {(submitText || onClose) && (
                <Actions style={{
                    cursor: loading
                        ? 'progress'
                        : '',
                    padding: '15px 0 10px 0',
                    textAlign: 'right',
                }}>
                    {actionsPrefix}
                    {onClose && getButton(closeText, {
                        onClick: onClose,
                        status: 'success',
                        style: { marginLeft: 5 },
                    })}
                    {getButton(submitText, {
                        disabled: submitDisabled,
                        onClick: handleSubmit,
                        [loadingProp || '']: !loadingProp
                            ? undefined
                            : loading,
                        status: 'success',
                        style: { marginLeft: 5 },
                    })}
                    {actionsSuffix}
                </Actions>
            )}

            {/* Form message */}
            {message && <Message {...message} />}

            {suffix}
        </Form>
    )
})
FormBuilder.defaultProps = {
    // components used in the 
    components: { ...defaultComponents },
    formProps: {},
    inputsDisabled: [],
    inputsHidden: [],
    inputsReadOnly: [],
    submitDisabledIfUnchanged: false,
    submitText: textsCap.submit, // string or element or object
}
const buttonProp = PropTypes.oneOfType([
    PropTypes.element, // only the props will be used and the `components.Button` component
    PropTypes.string,
    // Use `Component` prop to specify a component other than `components.Button`
    PropTypes.object,
])
FormBuilder.propTypes = {
    // components used in the 
    components: PropTypes.shape({
        Actions: PropTypes.elementType,
        Button: PropTypes.elementType,
        Form: PropTypes.elementType,
        FormInput: PropTypes.elementType,
        Message: PropTypes.elementType,
    }),
    buttonAfter: PropTypes.any,
    buttonBefore: PropTypes.any,
    closeText: buttonProp,
    closeOnSubmit: PropTypes.bool,
    formProps: PropTypes.object,
    inputs: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
    // Common props to be supplied to each inputs.
    // Input object props will always override these props.
    // Only `inputProps` and `components` will be merged with relevent input props.
    inputsCommonProps: PropTypes.oneOfType([
        PropTypes.object,
        // callback function invoked against each input.
        // must return an object.
        PropTypes.func,
    ]),
    inputsDisabled: PropTypes.array,
    inputsHidden: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.instanceOf(BehaviorSubject),
        PropTypes.string, // comma separated input names
    ]),
    // whether input messages should be hidden when not focused (unless property specifically set on the input object itself)
    inputsReadOnly: PropTypes.array,
    loading: PropTypes.bool,
    message: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
    // on form values change. Inboked whenever any of the form input values change
    onChange: PropTypes.func,
    // to trigger modal close on submit
    onClose: PropTypes.func,
    // callback function invoked when component is mounted
    // Args:  `props, formId, values, submitDisabled`
    onMount: PropTypes.func,
    onSubmit: PropTypes.func,
    // callback function invoked when component is unmounted
    // Args:  `props, formId, values, submitDisabled`
    onUnmount: PropTypes.func,
    prefix: PropTypes.any,
    submitDisabled: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
    submitDisabledIfUnchanged: PropTypes.bool,
    submitInProgress: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
    // Name of the property in the Button component to indicate button loading status
    submitButtonLoadingProp: PropTypes.string,
    submitText: buttonProp,
    suffix: PropTypes.any,
    values: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
    valuesToCompare: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.instanceOf(BehaviorSubject),
    ]),
}
export default FormBuilder

const addInterceptorCb = (
    inputs,
    inputsHidden = [],
    values,
    handleChange,
    props = {},
    formId,
    parentIndex = null,
) => (input, index) => {
    let {
        inputsCommonProps,
        inputsDisabled = [],
        inputsReadOnly = [],
    } = props
    let {
        content,
        hidden,
        idPrefix,
        inputs: childInputs,
        inputProps = {},
        key,
        name: nameAlt,
        rxValue,
        type: typeAlt,
        validate,
    } = input || {}
    const {
        disabled,
        name = nameAlt,
        readOnly,
        type = typeAlt,
    } = inputProps
    const typeLC = `${type || 'text'}`.toLowerCase()
    const isGroup = typeLC === 'group' && isArr(childInputs)
    const commonProps = !isFn(inputsCommonProps)
        ? inputsCommonProps || {}
        : inputsCommonProps(
            input,
            values,
            props,
        )
    idPrefix ??= commonProps.idPrefix

    return {
        ...commonProps,
        ...input,
        components: {
            ...commonProps?.components,
            ...input?.components,
        },
        content: isFn(content)
            ? content(values, name)
            : content,
        disabled: toArray(inputsDisabled).includes(name) || (
            isFn(disabled)
                ? disabled(values, name)
                : disabled
        ),
        hidden: inputsHidden.includes(name) || (
            isFn(hidden)
                ? !!hidden(values, name)
                : hidden
        ),
        idPrefix: idPrefix === null
            ? ''
            : idPrefix || `${formId}_`,
        inputs: isGroup
            ? childInputs.map(
                addInterceptorCb(
                    inputs,
                    inputsHidden,
                    values,
                    handleChange,
                    props,
                    formId,
                    parentIndex || index,
                )
            )
            : undefined,
        inputProps: {
            ...inputsCommonProps?.inputProps,
            ...inputProps,
            name,
            onChange: isGroup
                ? undefined
                : (e, data) => handleChange(name, inputs)(
                    e,
                    data,
                    input,
                    parentIndex || index,
                    parentIndex ? index : undefined
                ),
            readOnly: toArray(inputsReadOnly).includes(name) || readOnly,
        },
        key: key || name,
        validate: !isFn(validate)
            ? undefined
            : (event, data = {}) => validate(
                event,
                data,
                {
                    ...values,
                    // this is required because onChange() is trigger after validate().
                    // otherwise, current input will have the old value or last character missing for text/number inputs
                    [name]: data.value,
                },
                rxValue,
            ),
    }
}