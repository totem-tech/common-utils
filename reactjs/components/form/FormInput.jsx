import React, {
    isValidElement,
    useCallback,
    useEffect,
    useState,
} from 'react'
import PropTypes from 'prop-types'
import { BehaviorSubject } from 'rxjs'
import { translated } from '../../../languageHelper'
import {
    className,
    hasValue,
    isArr,
    isDefined,
    isFn,
    isObj,
    isPromise,
    isStr,
    isSubjectLike,
    objSetPropUndefined,
    objWithoutKeys,
} from '../../../utils'
import validator, { TYPES } from '../../../validator'
import {
    useRxSubject,
    useRxSubjectOrValue,
    useRxStateDeferred,
    useMount,
} from '../../hooks'
import CharacterCount from '../CharacterCount'
import Message, { statuses } from '../Message'
import RxSubjectView from '../RxSubjectView'
import FormInputGroup from './FormInputGroup'
import { useOptions } from './useOptions'
import { addMissingProps } from './utils'
import validateCriteria from './validateCriteria'

export const errorMessages = {
    decimals: 'maximum number of decimals allowed',
    email: 'please enter a valid email address',
    fileType: 'invalid file type selected',
    integer: 'please enter a number without decimals',
    max: 'number must be smaller than or equal to',
    maxLengthNum: 'maximum number of digits allowed',
    maxLengthText: 'maximum number of characters allowed',
    min: 'number must be greater or equal',
    minLengthNum: 'minimum number of digits required',
    minLengthText: 'minimum number of characters required',
    number: 'please enter a valid number',
    required: 'required field',
    readOnlyField: 'read only field',
    url: 'invalid URL',
}
translated(errorMessages, true)
const validationTypes = [...Object.values(TYPES), 'text']
const defaultComponents = {
    Container: 'div',
    CriteriaItem: 'div',
    CriteriaList: 'div',
    Icon: null,
    Input: 'input',
    Label: 'label',
    LabelDetails: 'div',
    Message: Message,
}

export const FormInput = React.memo(props => {
    const input = { ...props }
    useMount(
        () => {
            addMissingProps(input)
            onMount?.(input)
        },
        () => onUnmount?.(input)
    )

    // useEffect(() => {
    //     addMissingProps(input)

    //     // trigger onMount callback
    //     isFn(onMount) && onMount(input)

    //     // trigger onUnmount callback
    //     return () => isFn(onUnmount) && onUnmount(input)
    // }, [])

    if (input.type === 'group') return (
        <FormInputGroup {...{
            ...input,
            components: {
                FormInput,
                ...input?.components,
            }
        }} />
    )

    let {
        checkedValue = true,
        components,
        containerProps = {},
        content,
        counter = true, // bool or object { hideOnEmpty, hideOnOk }
        counterWarnLength,
        counterHiddenTypes = [
            'checkbox',
            'dropdown',
            'html',
            // placeholder to be used for any other types by supplying the input component
            'nocounter',
            'radio',
            'select',
        ],
        criteria = [],
        criteriaHeader,
        customMessages,
        hidden = false,
        inputPrefix,
        inputSuffix,
        inputProps,
        inputPropsIgnored = [],
        integer = false, // number validation
        label,
        labelBeforeInput = true,
        labelProps,
        labelDetails,
        labelInline,
        message,
        messageDefer = 500,
        messageHideOnBlur = true,
        name: _name,
        idPrefix = '',
        onMount,
        onUnmount,
        prefix,
        rxOptions,
        rxValue: _rxValue,
        rxValueModifier, // modifies the value passed on to the input
        suffix,
        type: typeAlt,
        uncheckedValue = false,
        useOptions: _useOptions = useOptions,
        validate,
    } = input
    components = {
        ...defaultComponents,
        ...FormInput.defaultProps?.components,
        ...components,
    }
    let {
        Container,
        Input,
        Label,
        LabelDetails,
        Message,
    } = components
    let {
        children: inputChildren,
        checked,
        disabled,
        error,
        id,
        label: label2,
        maxLength,
        minLength,
        name = _name,
        onBlur,
        onChange,
        onFocus,
        options,
        required = false,
        type,
        value: _value = '',
    } = inputProps
    const gotRxValue = useState(() => isSubjectLike(_rxValue))

    content = useRxSubjectOrValue(content)
    disabled = useRxSubjectOrValue(disabled)
    hidden = useRxSubjectOrValue(hidden)
    const isTypeHidden = type === 'hidden'
    const isHidden = hidden || isTypeHidden

    // internal validation error message
    const [
        {
            error: _error,
            message: _message,
        },
        setMessageDeferred,
        setMessage,
    ] = useRxStateDeferred([], messageDefer)
    message = _message || message

    // options for dropdown/selection type fields
    const [replaceOptionsProp, optionItems] = (!!options || !!rxOptions)
        && isFn(_useOptions)
        && _useOptions(input)
        || []


    // keeps track of whether input field is focused
    const [rxIsFocused] = useState(() => new BehaviorSubject(false))

    const valueModifier = useCallback((newValue, oldValue, rxValue) => {
        if (isFn(rxValueModifier)) newValue = rxValueModifier(
            newValue,
            oldValue,
            subject,
        )
        // trigger validation if rxValue was changed externally and on first load
        if (rxValue.___validated !== newValue) setTimeout(() =>
            handleChange({
                preventDefault: () => { },
                target: {
                    value: newValue,
                },
                stopPropagation: () => { },
            }),
            1
        )

        return newValue
    })
    // re-render on value change regardless of direction
    const [value, _, rxValue] = useRxSubject(_rxValue || _value, valueModifier)

    // handle input value change
    const handleChange = useCallback(
        handleChangeCb(
            input,
            rxValue,
            setMessageDeferred,
            setMessage,
        )
    )

    // if no rxValue provided and `value` changed externally
    !gotRxValue && useEffect(() => {
        setTimeout(() => _value !== value && rxValue.next(_value), 50)
    }, [_value])

    Input = optionItems && Input === 'input'
        ? 'select'
        : Input

    if (hidden) return
    if (isTypeHidden) return (
        <input {...{
            ...inputProps,
            autoComplete: 'username',
            style: { display: 'none' },
            type: 'text',
            value,
        }} />
    )

    if (isStr(message) || isValidElement(message)) message = { content: message }

    const msgEl = message && (
        <RxSubjectView {...{
            key: message?.key
                || message?.content
                || message?.text,
            subject: rxIsFocused,
            valueModifier: focused => message
                && (focused || !messageHideOnBlur)
                && !isHidden
                && (
                    <Message {...{
                        ...message,
                        className: className([
                            'FormInput-Message',
                            message?.className,
                        ])
                    }} />
                ),
        }} />
    )

    // Instantiate the Container element
    const getContainer = content => (
        <Container {...{
            ...containerProps,
            className: className([
                'FormInput-Container',
                containerProps?.className,
            ]),
            style: {
                ...containerProps?.style,
                ...labelInline && { display: 'table' },
            }
        }}>
            {prefix}
            {labelBeforeInput && label}
            {inputPrefix}
            {content}
            {inputSuffix}
            {!labelBeforeInput && label}
            {msgEl}
            {suffix}
        </Container>
    )

    /**
     * @name    getLabel
     * @summary constructs input label element
     * 
     * @param   {*}         label 
     * @param   {Boolean}   inlineCounter use null to hide counter
     * 
     * @returns {Element}
     */
    const getLabel = (label, inlineCounter = false) => {
        if (!label || isHidden) return ''

        const showCount = counter
            && inlineCounter !== null
            && !counterHiddenTypes.includes(type)
            && !optionItems

        const {
            hideOnEmpty = true,
            hideOnOk = false,
        } = isObj(counter) && counter || {}

        return (
            <Label {...{
                key: 'label',
                ...labelProps,
                className: className([
                    'FormInput-Label',
                    labelProps?.className,
                ]),
                htmlFor: id,
                style: {
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    userSelect: 'none',
                    ...labelProps?.style,
                    ...labelInline && {
                        display: 'table-cell',
                        paddingRight: 15,
                        verticalAlign: 'middle',
                    },
                },
            }}>
                {label}
                {required && (
                    <span style={{ color: 'red' }}> *</span>
                )}
                {showCount && (
                    <CharacterCount {...{
                        hideOnEmpty,
                        hideOnOk,
                        initialValue: rxValue.value,
                        inline: inlineCounter,
                        maxLength,
                        minLength,
                        show: rxIsFocused,
                        subject: rxValue,
                        rxValueModifier,
                        warnLength: counterWarnLength,
                    }} />
                )}
                {labelDetails && (
                    <LabelDetails>
                        {labelDetails}
                    </LabelDetails>
                )}
            </Label>
        )
    }
    label = label && getLabel(label, false)

    if (type === 'html') return getContainer(content)

    const isCheckRadio = type.startsWith('checkbox')
        || type.startsWith('radio')

    return getContainer(
        <Input {...objWithoutKeys({
            ...inputProps,
            checked: isCheckRadio
                ? value === checkedValue
                : checked,
            children: !replaceOptionsProp
                && optionItems
                || inputChildren,
            className: className([
                'FormInput-Input',
                inputProps.className,
            ]),
            disabled,
            error: isCheckRadio
                ? undefined
                : error || _error,
            label: label2 && getLabel(
                label2,
                !!label
                    ? null
                    : true,
            ),
            id: `${idPrefix}${id}`,
            onBlur: (...args) => {
                rxIsFocused.next(false)
                isFn(onBlur) && onBlur(...args)
            },
            onChange: handleChange,
            onFocus: (...args) => {
                rxIsFocused.next(true)
                isFn(onFocus) && onFocus(...args)
            },
            options: replaceOptionsProp
                ? optionItems
                : options,
            style: {
                ...inputProps.style,
                ...labelInline && { display: 'table-cell' },
            },
            value,
        }, [...inputPropsIgnored, isStr(Input) && 'error'])} />
    )
})
FormInput.defaultProps = {
    checkedValue: true,
    components: { ...defaultComponents },
    containerProps: {},
    counter: true, // bool or object { hideOnEmpty, hideOnOk }
    counterHiddenTypes: [
        'checkbox',
        'dropdown',
        'html',
        // placeholder to be used for any other types by supplying the input component
        'nocounter',
        'radio',
        'select',
    ],
    labelBeforeInput: true,
    messageDefer: 500,
    messageHideOnBlur: true,
    uncheckedValue: false,
    useOptions,
}
FormInput.propTypes = {
    inputProps: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        onChange: PropTypes.func,
    }).isRequired,
    message: PropTypes.object,
    rxValue: PropTypes.instanceOf(BehaviorSubject),

    // checkedValue = true,
    // components: {
    //     Container = 'div',
    //     CriteriaItem = 'div', // props: { content, icon, style }
    //     CriteriaList = 'div',
    //     Icon = null,
    //     Input = 'input',
    //     Label = 'label',
    // LabelDetails = 'div',
    //     Message = _Message,
    // } = {},
    // containerProps = {},
    // content,
    // counter = true, // bool or object { hideOnEmpty, hideOnOk }
    // counterWarnLength,
    // counterHiddenTypes =[
    //     'checkbox',
    //     'dropdown',
    //     'html',
    //     // placeholder to be used for any other types by supplying the input component
    //     'nocounter',
    //     'radio',
    //     'select',
    // ],
    // criteria =[],
    // criteriaFooter
    // criteriaHeader,
    // criteriaIconInvalid
    // criteriaIconValid
    // criteriaPersist,
    // customMessages,
    // hidden = false,
    // inputPrefix,
    // inputSuffix,
    // inputProps,
    // inputPropsIgnored =[],
    // integer = false, // number validation
    // label,
    // labelBeforeInput = true,
    // labelProps,
    // labelDetails,
    // labelInline,
    // message,
    // messageDefer = 500,
    // messageHideOnBlur = true,
    // name,
    // Set a prefix for input element IDs to be passed down to the DOM to prevent duplicate IDs in case multiple instances of the same form is created
    // Using 'null' prevents adding any prefix.
    // idPrefix
    // onMount,
    // onUnmount,
    // prefix,
    // rxOptions,
    // rxValue: _rxValue,
    // rxValueModifier, // modifies the value passed on to the input
    // suffix,
    // type: typeAlt,
    // uncheckedValue = false,
    // useOptions: _useOptions = useOptions,
    // validate,
}
export default FormInput

const handleChangeCb = (props, rxValue, setMessage) => (event, ...args) => {
    let {
        checkedValue = true,
        customMessages,
        inputProps = {},
        integer = false, // number validation
        validate,
        validatorConfig = {},
        onChangeSelectValue,
        uncheckedValue = false,
    } = props
    let {
        onChange,
        required = false,
        type,
    } = inputProps
    let {
        persist,
        target: {
            checked,
            selectionEnd,
            selectionStart,
            setSelectionRange,
            value,
        } = {},
    } = event || {}
    if (isFn(onChangeSelectValue)) value = onChangeSelectValue(event, ...args)
    // value unchanged
    if (rxValue.___validated === value) return

    // Forces the synthetic event and it's value to persist
    // Required for use with deferred function
    isFn(persist) && event.persist()

    // preserves cursor position
    const setCursor = () => setTimeout(() => {
        try {
            isFn(setSelectionRange)
                && selectionStart
                && selectionEnd
                && event
                    .target
                    .setSelectionRange(
                        selectionStart,
                        selectionEnd,
                    )
        } catch (_) { } // ignore unsupported
    })

    const data = {
        ...props,
        checked,
        value,
    }
    let err, isANum = false
    const isCheck = ['checkbox', 'radio'].includes(type)
    let hasVal = hasValue(
        isCheck
            ? required
                ? data.checked === true
                : data.checked
            : data.value
    )
    const customMsgs = {
        ...errorMessages,
        // Hide min & max length related error messages as a counter will be displayed for appropriate types.
        // To override this simply set `undefined` in the `customMessages`.
        lengthMax: true,
        lengthMin: true,
        ...customMessages,
    }

    // ignore if doens't have value
    if (hasVal) switch (type) {
        case 'array':
            validatorConfig.type ??= TYPES.array
            break
        case 'checkbox':
        case 'radio':
            data.checked = !!checked
            data.value = !!checked
                ? checkedValue
                : uncheckedValue
            if (required && !data.checked) hasVal = false
            break
        case 'date':
            validatorConfig.type ??= TYPES.date
            break
        case 'email':
            validatorConfig.type ??= TYPES.email
            break
        case 'identity':
            validatorConfig.type ??= TYPES.identity
            break
        case 'number':
            isANum = true
            validatorConfig.type ??= integer
                ? TYPES.integer
                : TYPES.number
            data.value = !data.value
                ? data.value
                : Number(data.value)
            value = data.value
            break
        case 'url':
            validatorConfig.type ??= TYPES.url
            break
        case 'hex':
            validatorConfig.type ??= TYPES.hex
        case 'text':
        case 'textarea':
        default:
            value = isArr(value)
                ? value
                : `${!isDefined(value) ? '' : value}`
            validatorConfig.type ??= TYPES.string
            break
    }

    // input value is required but empty
    // if (required && !hasVal) err = true

    const requireValidator = !err
        && hasVal
        && validationTypes.includes(type)
    if (!!requireValidator) {
        // set min & max length error messages if set defined by external error messages
        objSetPropUndefined(
            customMsgs,
            'lengthMax',
            // if value is string
            errorMessages.maxLengthText,
            isANum,
            errorMessages.maxLengthNum,
        )
        objSetPropUndefined(
            customMsgs,
            'lengthMin',
            // if value is string
            errorMessages.minLengthText,
            isANum,
            // if value is a number
            errorMessages.minLengthNum,
        )
        err = validator.validate(
            value,
            {
                ...inputProps,
                ...validatorConfig,
            },
            customMsgs
        )
    }

    let [criteriaMsg, crInvalid] = (!err || err === true)
        && validateCriteria(value, props, hasVal)
        || []
    if (crInvalid && !hasVal) crInvalid = false
    // prevents re-validation because of the trigger
    rxValue.___validated = data.value
    // trigger value change
    rxValue.value !== data.value
        && rxValue.next(data.value)

    const triggerChange = (err) => {
        const error = !!err || !!crInvalid
        setMessage({
            error,
            message: err && err !== true
                ? {
                    content: err,
                    status: statuses.error
                }
                : criteriaMsg,
        })
        isFn(onChange) && onChange(
            event,
            { ...data, error },
            ...args
        )
        setCursor()
    }

    if (err || !isFn(validate)) return triggerChange(err)

    err = validate(
        event,
        data,
        ...args
    )
    isPromise(err)
        ? err.then(triggerChange)
        : triggerChange(err)
}