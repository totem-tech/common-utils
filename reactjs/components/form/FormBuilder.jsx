import PropTypes from 'prop-types'
import React, {
    isValidElement,
    useEffect,
    useMemo,
} from 'react'
import { BehaviorSubject } from 'rxjs'
import { translated } from '../../../languageHelper'
import { copyRxSubject } from '../../../rx'
import {
    arrUnique,
    className,
    isArr,
    isFn,
    isStr,
    isSubjectLike,
    toArray,
} from '../../../utils'
import { useMount, useRxSubject } from '../../hooks'
import toProps from '../../toProps'
import _Button from '../Button'
import { Message as _Message } from '../Message'
import { RxSubjectView } from '../RxSubjectView'
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
    Actions: 'div',
    Button: _Button,
    Form: 'form',
    FormInput: _FormInput,
    Message: _Message,
}
export const FormBuilder = React.memo(propsOrg => {
    const props = { ...propsOrg }
    let {
        actions = [],
        actionsPrefix,
        actionsSuffix,
        components,
        defer = 300,
        submitButtonLoadingProp: loadingProp,
        closeText = textsCap.close,
        closeOnSubmit,
        formProps = {},
        // inputs,
        // inputsCommonProps,
        // inputsDisabled = [],
        // inputsHidden = [],
        // inputsReadOnly = [],
        // loading,
        message,
        onChange: formOnChange,
        onClose,
        onMount,
        onSubmit,
        onUnmount,
        prefix,
        // submitDisabled, // Boolean or BehaviorSubject
        submitDisabledIfUnchanged: requireChange = false,
        // submitInProgress,// Boolean or BehaviorSubject
        submitText, // string or element or object
        suffix,
        // values: _values, // Object or BehaviorSubject
        // valuesToCompare,
    } = props

    const {
        formId,
        getButton,
        handleChangeCb,
        handleSubmit,
        rxMessage,
        rxState,
        toUpdate,
        rxValues,
    } = useMemo(() => {
        // setup form ID
        window.___formCount ??= 1000
        let formId = formProps.id
        if (!formId || formIds.get(formId)) {
            // create unique ID if multiple instances of the same form is created 
            formId = `${formId || 'FormBuilder'}${++___formCount}`
        }
        formIds.set(formId, true)
        formProps.id = formId

        // subject for internal error messages
        const rxMessage = new BehaviorSubject()
        const toObserve = [
            'inputs',
            'inputsHidden',
            'inputsDisabled',
            'inputsReadOnly',
            'loading',
            'message',
            'submitInProgress',
            'submitDisabled',
            'values',
            'valuesToCompare',
        ]
        const toUpdate = toObserve
            .map(key => {
                const value = propsOrg[key]
                if (isSubjectLike(value)) return
                const subject = new BehaviorSubject(value)
                props[key] = subject
                return [key, subject]
            })
            .filter(Boolean)
        const rxInputs = props.inputs
        rxInputs.value?.forEach?.(addMissingProps)
        const rxValues = props.values
        const stateModifier = ([
            inputs,
            inputsHidden = [],
            inputsDisabled,
            inputsReadOnly,
            loading,
            submitInProgress,
            submitDisabled,
            valuesToCompare,
        ]) => {
            inputsHidden = arrUnique([
                ...toArray(inputsHidden),
                ...inputs
                    ?.filter(({ inputProps = {} }) => {
                        const { hidden, name } = inputProps
                        return !inputsHidden.includes(name) && (
                            isSubjectLike(hidden)
                                ? hidden.value
                                : isFn(hidden)
                                    ? !!hidden(values, name)
                                    : hidden
                        )
                    })
                    ?.map(x => x.inputProps.name)
                || []
            ])
            const inputsInvalid = !!inputs?.find?.(x =>
                checkInputInvalid(x, inputsHidden)
            )
            const valuesChanged = requireChange && checkValuesChanged(
                inputs,
                values,
                valuesToCompare,
                inputsHidden,
            )

            // disable submit button if one of the following is true:
            // 1. none of the input's value has changed
            // 2. message status or form is "loading" (indicates submit or some input validation is in progress)
            // 3. one or more inputs contains invalid value (based on validation criteria)
            // 4. one or more required inputs does not contain a value
            submitDisabled = submitDisabled
                || submitInProgress
                || loading
                || !!inputsInvalid
                || valuesChanged

            return {
                inputs,
                inputsHidden,
                inputsDisabled: toArray(inputsDisabled),
                inputsReadOnly: toArray(inputsReadOnly),
                init: true,
                loading,
                submitInProgress,
                submitDisabled,
                values,
                valuesToCompare,
            }
        }
        const rxState = copyRxSubject(
            toObserve.map(key => props[key]),
            null,
            stateModifier,
            defer,
        )

        const handleSubmit = async (event) => {
            try {
                event?.preventDefault?.()
                const {
                    inputsHidden,
                    loading,
                    submitDisabled,
                } = rxState.value
                if (submitDisabled || loading) return

                const inputs = rxInputs.value || []
                const values = getValues(inputs)
                const allOk = !loading
                    && !submitDisabled
                    && !inputs.find(x => checkInputInvalid(x, inputsHidden))
                isFn(onSubmit) && await onSubmit(
                    allOk,
                    values,
                    inputs,
                    event,
                )
                closeOnSubmit && onClose?.()
            } catch (err) {
                rxMessage.next({
                    header: textsCap.submitError,
                    status: 'error',
                    text: `${err}`.replace('Error: ', ''),
                })
            }
        }

        const handleChangeCb = name => async (event, { error, value }) => {
            const inputs = rxInputs.value || []
            const input = name && findInput(name, inputs)
            if (!input) return

            const { inputProps } = input
            inputProps.error = error
            inputProps.value = value
            input.valid = error !== true

            const triggerChange = values => {
                values = values || getValues(inputs)
                rxInputs.next([...inputs])
                rxValues.next({ ...values })
            }

            // clear submit error message
            if (rxMessage.value) setTimeout(() => rxMessage.next(null))

            let values = getValues(inputs)
            let doTrigger = await input
                ?.inputProps
                ?.onChange?.(
                    values,
                    inputs,
                    event,
                )

            if (!isFn(formOnChange)) return doTrigger !== false && triggerChange()

            const formValid = !inputs.find(x =>
                checkInputInvalid(x, rxState.value.inputsHidden)
            )
            doTrigger = await formOnChange(
                formValid,
                doTrigger
                    ? getValues(inputs)
                    : values,
                inputs,
                name,
            )

            doTrigger !== false && triggerChange()
        }

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

        return {
            formId,
            getButton,
            handleChangeCb,
            handleSubmit,
            rxMessage,
            rxState,
            toUpdate,
            rxValues,
        }
    }, [])

    // synchronize with local subjects
    toUpdate.forEach(([key, subject]) =>
        useEffect(() => {
            subject.next(propsOrg[key])
        }, [propsOrg[key]])
    )
    // delay form state update when multiple update is triggered concurrently/too frequently
    const [state] = useRxSubject(rxState)
    let { // default components
        Actions,
        Button,
        Form,
        FormInput = _FormInput,
        Message = _Message,
    } = { ...defaultComponents, ...components }
    const {
        init,
        inputs = [],
        // inputsHidden = [],
        // inputsDisabled = [],
        // inputsReadOnly = [],
        loading = false,
        // submitInProgress = false,
        submitDisabled = false,
        values = {},
        // valuesToCompare = {},
    } = state

    useMount(
        () => onMount?.(
            props,
            formId,
            values,
            submitDisabled,
        ),
        () => onUnmount?.(
            props,
            formId,
            values,
            submitDisabled,
        )
    )

    return (
        <Form {...{
            autoComplete: 'off',
            className: 'FormBuilder',
            noValidate: true,
            ...formProps,
        }}>
            {prefix}

            {/* Form inputs */}
            {init && inputs
                .map(addInterceptorCb(
                    { ...props, ...state },
                    rxState.value.inputsHidden,
                    rxValues,
                    handleChangeCb,
                    formId,
                ))
                .map(input => <FormInput {...input} />)}

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
                    {actions.map((action, i) => getButton(action, { key: i }))}
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
            {init && (
                <RxSubjectView {...{
                    key: 'message',
                    subject: [rxMessage, message],
                    valueModifier: ([message, messageExt]) => {
                        message = message || messageExt
                        const props = isStr(message) || isValidElement(message)
                            ? { content: message }
                            : message
                        return !!message && (
                            <Message {...{
                                ...props,
                                className: className([
                                    props.className,
                                    'FormMessage'
                                ]),
                            }} />
                        )
                    }
                }} />
            )}

            {suffix}
        </Form>
    )
})
FormBuilder.defaultProps = {
    // components used in the 
    components: defaultComponents,
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
    ]).isRequired,
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
FormBuilder.setupDefaults = (name, module, _extras) => {
    const dp = FormBuilder.defaultProps
    switch (name) {
        case '@mui/material':
            dp.components.Form = module.Box
            break
        case 'semantic-ui-react':
            break
    }
}
export default FormBuilder

const addInterceptorCb = (
    props = {},
    inputsHidden = [],
    rxValues,
    handleChange,
    formId,
    parentIndex = null,
) => (input, index) => {
    let {
        inputs,
        inputsCommonProps,
        inputsDisabled = [],
        inputsReadOnly = [],
    } = props
    const values = rxValues.value || {}
    let {
        content,
        hidden = false,
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
            index
        )
    idPrefix ??= commonProps.idPrefix

    return {
        ...commonProps,
        ...input,
        addMissingProps: false,
        components: {
            ...commonProps?.components,
            ...input?.components,
        },
        containerProps: {
            ...commonProps?.containerProps,
            ...input?.containerProps,
        },
        content: isFn(content)
            ? content(values, name)
            : content,
        disabled: inputsDisabled.includes(name) || (
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
                    props,
                    inputsHidden,
                    rxValues,
                    handleChange,
                    formId,
                    parentIndex || index,
                )
            )
            : undefined,
        inputProps: {
            ...commonProps?.inputProps,
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
            readOnly: inputsReadOnly.includes(name) || readOnly,
        },
        key: key || name,
        validate: !isFn(validate)
            ? undefined
            : (event, data = {}) => validate(
                event,
                data,
                {
                    ...rxValues.value,
                    // this is required because onChange() is trigger after validate().
                    // otherwise, current input will have the old value or last character missing for text/number inputs
                    [name]: data.value,
                },
                rxValue,
            ),
    }
}