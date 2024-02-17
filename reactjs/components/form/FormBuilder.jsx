import PropTypes from 'prop-types'
import React, {
    isValidElement,
    useEffect,
    useMemo
} from 'react'
import { BehaviorSubject } from 'rxjs'
import { translated } from '../../../languageHelper'
import { copyRxSubject } from '../../../rx'
import {
    arrUnique,
    className,
    deferred,
    isArr,
    isBool,
    isFn,
    isObj,
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
    getValues,
    reValidateInputs
} from './utils'

const textsCap = {
    close: 'close',
    submit: 'submit',
    submitErrorHeader: 'form submission failed',
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
export const FormBuilder = React.memo(function FormBuilder(props) {
    const {
        formId,
        getButton,
        handleChangeCb,
        handleSubmit,
        propsToMirror = [],
        rxMessage,
        rxState,
        rxValues,
        rxMirroredProps,
    } = useMemo(() => setup(props), [])

    const valuesToMirror = propsToMirror.map(x => props[x])
    propsToMirror.length > 0 && useEffect(() => {
        const mirroredValues = propsToMirror.reduce((obj, key) => ({
            ...obj,
            [key]: props[key]
        }), {})
        rxMirroredProps.next(mirroredValues)
    }, valuesToMirror)

    // delay form state update when multiple update is triggered concurrently/too frequently
    const [state] = useRxSubject(rxState)
    const {
        actions = [],
        actionsPrefix,
        actionsSuffix,
        components,
        defer = 300,
        submitButtonLoadingProp: loadingProp,
        closeText = textsCap.close,
        closeOnSubmit,
        formProps = {},
        message,
        onChange: formOnChange,
        onClose,
        onMount,
        onSubmit,
        onUnmount,
        prefix,

        submitText, // string or element or object
        suffix,
        submitDisabledIfUnchanged: requireChange = false,
        inputs = [],
        inputsHidden = [],
        // inputsDisabled = [],
        // inputsReadOnly = [],
        loading = false,
        submitDefer = 300,
        submitDisabled = false,
        // submitInProgress = false,
        values = {},
        // valuesToCompare = {},

        // local state
        init,
        submitClicked = props.submitClicked,
        submitShouldDisable,
    } = state

    let { // default components
        Actions,
        Button,
        Form,
        FormInput = _FormInput,
        Message = _Message,
    } = { ...defaultComponents, ...components }

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
        <>
            {prefix}
            <Form {...{
                autoComplete: 'off',
                className: 'FormBuilder',
                noValidate: true,
                ...formProps,
                id: formId,
            }}>
                {/* Form inputs */}
                {init && inputs
                    .map(addInterceptorCb(
                        { ...props, ...state },
                        inputsHidden,
                        rxValues,
                        handleChangeCb,
                        formId,
                        null,
                        submitClicked
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
                        {!!onClose && getButton(closeText, {
                            onClick: onClose,
                            status: 'success',
                            style: { marginLeft: 5 },
                        })}
                        {actions.map((action, i) => getButton(action, { key: i }))}
                        {getButton(submitText, {
                            disabled: !!(submitDisabled ?? submitShouldDisable),
                            onClick: e => {
                                e?.preventDefault?.()
                                handleSubmit(e)
                            },
                            ...!!loadingProp && {
                                [loadingProp || '']: !loadingProp
                                    ? undefined
                                    : loading,
                            },
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
                            const msgProps = isStr(message) || isValidElement(message)
                                ? { content: message }
                                : message
                            return !!message && (
                                <Message {...{
                                    ...msgProps,
                                    className: className([
                                        msgProps.className,
                                        'FormMessage'
                                    ]),
                                }} />
                            )
                        }
                    }} />
                )}
            </Form>
            {suffix}
        </>
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
    submitErrorHeader: textsCap.submitErrorHeader,
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
    submitErrorHeader: PropTypes.oneOfType([
        PropTypes.element,
        PropTypes.string,
    ]),
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
    handleChangeCb,
    formId,
    parentIndex = null,
    submitClicked,
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
        required: _required,
        rxValue,
        type: typeAlt,
        validate,
        validatorConfig = {}
    } = input || {}
    const {
        disabled,
        name = nameAlt,
        readOnly,
        required = _required,
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
    hidden = inputsHidden.includes(name) || (
        isFn(hidden)
            ? !!hidden(values, name)
            : hidden
    )
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
        hidden,
        idPrefix: idPrefix === null
            ? ''
            : idPrefix || `${formId}_`,
        inputs: isGroup
            ? childInputs.map(
                addInterceptorCb(
                    props,
                    inputsHidden,
                    rxValues,
                    handleChangeCb,
                    formId,
                    parentIndex || index,
                    submitClicked,
                )
            )
            : undefined,
        inputProps: {
            ...commonProps?.inputProps,
            ...inputProps,
            name,
            onChange: isGroup
                ? undefined
                : (e, data) => handleChangeCb(name, inputs)(
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
        validatorConfig: {
            ...submitClicked && {
                required: !hidden && (required?.value ?? !!required)
            },
            ...validatorConfig,
        },
    }
}

const setup = props => {
    let {
        components,
        defer = 100,
        formProps: {
            id: formId
        } = {},
        scrollToSelector = 'html',
        submitDefer = 300,
        submitErrorHeader,
        values
    } = props
    // setup form ID
    window.___formCount ??= 1000
    const formIdPrefix = 'FormBuilder_'
    const generateId = !formId
        || (formId.startsWith(formIdPrefix) && formIds.get(formId))
    // create unique ID if multiple instances of the same form is created 
    if (generateId) formId = `${formIdPrefix}${++window.___formCount}`
    formIds.set(formId, true)

    // subject for internal error messages
    const rxMessage = new BehaviorSubject()
    const rxMirroredProps = new BehaviorSubject({})
    const rxState = new BehaviorSubject({})
    const propsToWatch = Object
        .keys(props)
        .filter(x => isSubjectLike(props[x]))
    const rxValues = isSubjectLike(values)
        ? values
        : new BehaviorSubject(values || {})
    // auto update watched props to state
    const stateModifier = ([
        mirroredProps,
        values = {},
        ...propValues
    ]) => {
        const watchedValues = propsToWatch
            .reduce((obj, key, i) => ({
                ...obj,
                [key]: propValues[i],
            }), {})
        const state = {
            ...props,
            ...rxState.value,
            ...mirroredProps,
            ...watchedValues,
            values,
        }
        let {
            inputs = [],
            inputsHidden = [],
            loading = false,
            submitInProgress = false,
            submitDisabled = false,
            submitDisabledIfUnchanged: requireChange = false,
            valuesToCompare,
        } = state

        if (!state.init) {
            inputs?.forEach?.(addMissingProps)
            state.init = true
            state.components = { ...defaultComponents, ...components }
        }

        submitDisabled = isObj(submitDisabled)
            ? Object
                .values(submitDisabled)
                .every(Boolean)
            : !!submitDisabled
        inputsHidden = arrUnique([
            ...toArray(inputsHidden),
            ...inputs?.filter(({ inputProps = {} }) => {
                const { hidden, name } = inputProps
                return !inputsHidden.includes(name) && (
                    isSubjectLike(hidden)
                        ? hidden.value
                        : isFn(hidden)
                            ? !!hidden(values, name)
                            : hidden
                )
            })?.map(x => x.inputProps.name) || []
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
        const submitShouldDisable = submitDisabled
            || submitInProgress
            || loading
            || !!inputsInvalid
            || valuesChanged

        return {
            ...state,
            inputs,
            inputsHidden,
            loading,
            submitInProgress,
            submitDisabled,
            submitShouldDisable,
            valuesToCompare,
        }
    }
    copyRxSubject(
        [
            rxMirroredProps,
            rxValues,
            ...propsToWatch.map(key => props[key])
        ],
        rxState,
        stateModifier,
        defer,
    )

    const handleSubmit = async (event) => {
        try {
            const {
                closeOnSubmit,
                inputsHidden,
                loading,
                onSubmit,
                submitClicked,
                submitDisabled,
            } = rxState.value
            if (submitDisabled || loading) return

            const { inputs = [] } = rxState.value
            const values = getValues(inputs)
            const valid = !loading
                && !submitDisabled
                && !inputs.find(x => checkInputInvalid(x, inputsHidden))

            // set state to acknowledge that submit button is clicked
            !valid
                && !submitClicked
                && rxState.next({
                    ...rxState.value,
                    submitClicked: true,
                })
            !valid && setTimeout(() => reValidateInputs(
                inputs,
                values,
                inputsHidden,
                scrollToSelector
            ))
            isFn(onSubmit) && await onSubmit(
                valid,
                values,
                inputs,
                event,
            )
            if (closeOnSubmit && valid) return onClose?.()

        } catch (err) {
            console.errorDebug(err)
            rxMessage.next({
                header: submitErrorHeader,
                status: 'error',
                text: (err?.message ?? err) || '',
            })
        }
    }

    const handleChangeCb = name => async (event, { error, value }) => {
        const {
            inputs = [],
            onChange: formOnChange,
        } = rxState.value
        const input = name && findInput(name, inputs)
        if (!input) return

        const { inputProps } = input
        inputProps.error = error
        inputProps.value = value
        input.valid = !error

        const triggerChange = values => {
            values = values || getValues(inputs)
            isSubjectLike(props.inputs)
                ? props.inputs.next([...inputs])
                : rxState.next({ ...rxState.value, inputs })

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
        if (textOrProps === null) return ''

        const {
            components: { Button } = {}
        } = rxState.value
        const {
            Component = Button || 'button',
            ...btnProps
        } = toProps(textOrProps)

        return !!Component && (
            <Component {...{
                ...extraProps,
                ...btnProps,
                children: btnProps.children || extraProps.children,
                disabled: isBool(btnProps.disabled)
                    ? !!btnProps.disabled
                    : !!extraProps.disabled,
                onClick: (...args) => {
                    args[0]?.preventDefault?.()
                    btnProps.onClick?.(...args)
                    extraProps?.onClick?.(...args)
                },
                style: {
                    ...extraProps?.style,
                    ...btnProps.style,
                },
            }} />
        )
    }

    return {
        formId,
        getButton,
        handleChangeCb,
        handleSubmit: submitDefer > 0
            ? deferred(handleSubmit, submitDefer)
            : handleSubmit,
        propsToMirror: [
            'inputs',
            'inputsHidden',
            'inputsDisabled',
            'inputsReadOnly',
            'loading',
            'message',
            'submitClicked',
            'submitDisabled',
            'submitInProgress',
            'submitText',
            'values',
            'valuesToCompare',
        ].filter(key => !isSubjectLike(props[key])),
        rxMessage,
        rxState,
        rxValues,
        rxMirroredProps,
    }
}