import React, {
    isValidElement,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react'
import PropTypes from 'prop-types'
import { BehaviorSubject } from 'rxjs'
import { translated } from '../../../languageHelper'
import {
    className,
    deferred,
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
import { useOptions as _useOptions } from './useOptions'
import { addMissingProps } from './utils'
import validateCriteria from './validateCriteria'
import CheckboxGroup from './CheckboxGroup'

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
const defaultNativeComponents = {
    Container: 'div',
    CriteriaItem: 'div',
    CriteriaList: 'div',
    Icon: null,
    Input: 'input',
    Label: 'label',
    LabelDetails: 'div',
    Message,
}
let defaultUILibProps

export const FormInput = React.memo(props => {
    let input = !props.addMissingProps
        ? props
        // makes sure required variables are set
        : useMemo(() => addMissingProps(props), [props])

    const uiLibProps = defaultUILibProps?.(
        input.type || input.inputProps?.type || 'text',
        input
    )
    input = {
        ...input,
        ...uiLibProps,
        inputProps: {
            ...input?.inputProps,
            ...uiLibProps?.inputProps,
        },
    }
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
        errorClass = 'error',
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
        labelDetailsProps = {
            style: {
                color: 'grey',
                fontSize: '85%'
            },
        },
        labelInline,
        message,
        messageDefer = 500,
        messageHideOnBlur = true,
        name: _name,
        idPrefix = '',
        onMount,
        onUnmount,
        prefix,
        required, // only use if inputProps.required should be different
        rxOptions,
        rxValue: _rxValue,
        rxValueModifier: _rxValueModifier, // modifies the value passed on to the input
        suffix,
        type,
        uncheckedValue = false,
        useOptions = _useOptions,
        validate,
    } = input
    components = {
        InputGroup: FormInputGroup,
        ...defaultNativeComponents,
        ...FormInput.defaultProps?.components,
        ...uiLibProps?.components,
        ...components,
    }
    let {
        Container,
        Input,
        InputGroup,
        Label,
        LabelDetails,
        Message,
    } = components
    // trigger onMount callbacks
    useMount(onMount, onUnmount)

    if (input.type === 'group') return (
        <InputGroup {...{
            ...input,
            components: {
                FormInput,
                ...input?.components,
            }
        }} />
    )
    let {
        children: inputChildren,
        checked,
        disabled = false,
        error: _error,
        id,
        label: label2,
        maxLength,
        minLength,
        name = _name,
        onBlur,
        onChange,
        onFocus,
        options,
        required: requiredAlt,
        type: typeAlt,
        value: _value = '',
    } = inputProps
    required ??= requiredAlt
    type ??= typeAlt
    content = useRxSubjectOrValue(content)
    disabled = useRxSubjectOrValue(disabled)
    hidden = useRxSubjectOrValue(hidden)
    const isTypeHidden = type === 'hidden'
    const isHidden = hidden || isTypeHidden

    // internal validation error status
    const [error, setError] = useState()
    const [
        rxMessageExt, // used to keep track of and update any external message (props.message)
        rxIsFocused,  // keeps track of whether input field is focused
        msgEl, // message element
        rxValueModifier,
        rxValue,
        rxValueIsSubject,
        msgExtIsSubject,
        isOptionsType,
        handleChange,
    ] = useMemo(() => {
        const addDeferred = (subject, defer = 0) => {
            const nextOrg = subject.next.bind(subject)
            subject.next = value => {
                subject._timeoutId && clearTimeout(subject._timeoutId)
                subject._timeoutId = null
                return nextOrg(value)
            }
            const nextDeferred = deferred(nextOrg, defer)
            subject.deferred = (...args) => {
                subject._timeoutId = nextDeferred(...args)
            }
            // subject.deferred = deferred(v => subject.next(v), defer)
            return subject
        }
        const isOptionsType = (!!options || !!rxOptions) && isFn(useOptions)
        const msgExtIsSubject = isSubjectLike(message)
        const rxIsFocused = new BehaviorSubject(false)
        const rxMessage = new BehaviorSubject(null)
        addDeferred(rxMessage, messageDefer)
        const rxMessageExt = msgExtIsSubject
            ? message
            : new BehaviorSubject(message)
        const rxValueIsSubject = isSubjectLike(_rxValue)
        const rxValue = rxValueIsSubject
            ? _rxValue
            : new BehaviorSubject(_value)

        addDeferred(rxValue, 100)
        const getMessageEl = ([message, messageExt, focused]) => {
            message = message || messageExt
            message = !isStr(message) && !isValidElement(message)
                ? message
                : { content: message }

            return !!message
                && !!(focused || !messageHideOnBlur)
                && !isHidden
                && (
                    <Message {...{
                        ...message,
                        className: className([
                            'FormInput-Message',
                            message?.className,
                        ])
                    }} />
                )
        }
        const msgEl = (
            <RxSubjectView {...{
                key: 'message',
                subject: [
                    rxMessage,
                    rxMessageExt,
                    rxIsFocused,
                ],
                valueModifier: getMessageEl,
            }} />
        )
        const handleChange = handleChangeCb(
            input,
            rxValue,
            rxMessage,
            setError,
        )
        // local rxValue modifier
        const rxValueModifier = (newValue, oldValue) => {
            if (isFn(_rxValueModifier)) newValue = _rxValueModifier(
                newValue,
                oldValue,
                rxValue,
            )
            !isEqual(rxValue.___validated, newValue) && setTimeout(() => {
                handleChange({
                    preventDefault: () => { },
                    target: {
                        value: newValue,
                    },
                    stopPropagation: () => { },
                })
            }, 100)
            return newValue
        }
        return [
            rxMessageExt,
            rxIsFocused,
            msgEl,
            rxValueModifier,
            rxValue,
            rxValueIsSubject,
            msgExtIsSubject,
            isOptionsType,
            handleChange,
        ]
    }, [])
    // synchronise rxMessageExt with external message if necessary
    !msgExtIsSubject && useEffect(() => rxMessageExt.next(message), [message])
    // synchronise rxValue with external value if necessary
    !rxValueIsSubject && useEffect(() => rxValue.deferred(_value), [_value])

    // options for dropdown/selection type fields
    const [optionsReplaceProp, optionItems] = isOptionsType && useOptions(input) || []
    // Use `select` tag for Dropdown if no tag or element specified externally
    Input = optionItems && Input === 'input'
        ? 'select'
        : Input

    // re-render on value change regardless of direction
    const [value] = useRxSubject(rxValue, rxValueModifier)

    if (hidden) return ''
    if (isTypeHidden) return (
        <input {...{
            ...inputProps,
            autoComplete: 'username',
            style: { display: 'none' },
            type: 'text',
            value,
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
                    <LabelDetails {...labelDetailsProps}>
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

    inputChildren = !optionsReplaceProp
        && optionItems
        || inputChildren
    return getContainer(
        <Input {...objWithoutKeys(
            {
                ...inputProps,
                checked: isCheckRadio
                    ? value === checkedValue
                    : checked,
                ...inputChildren && {
                    children: inputChildren
                },
                className: className([
                    'FormInput-Input',
                    inputProps.className,
                    error && errorClass
                ]),
                disabled,
                error: isCheckRadio
                    ? undefined
                    : _error || error,
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
                options: optionsReplaceProp
                    ? optionItems
                    : undefined,
                style: {
                    ...inputProps.style,
                    ...labelInline && { display: 'table-cell' },
                },
                value,
            },
            [...inputPropsIgnored, isStr(Input) && 'error']
        )} />
    )
})
FormInput.defaultProps = {
    addMissingProps: true,
    checkedValue: true,
    components: { ...defaultNativeComponents },
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
    useOptions: _useOptions,
}
FormInput.propTypes = {
    addMissingProps: PropTypes.bool,
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
    //     InputGroup
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
FormInput.setupDefaults = (name, module) => {
    switch (name) {
        case '@mui/material':
            // const {
            //     Box,
            //     MenuItem,
            //     Select,
            //     TextField
            // } = module || {}
            // defaultUILibProps = (type, props) => {
            //     const defaultProps = {
            //         inputProps: {}
            //     }
            //     const components = {}
            //     console.log({ type })
            //     switch (type) {
            //         case 'checkbox-group':
            //         case 'radio-group':
            //             components.Input = CheckboxGroup
            //             break
            //         case 'dropdown':
            //             //     components.Container = Box
            //             //     components.Input = Select
            //             //     components.OptionItem = MenuItem
            //             //     defaultProps.inputPropsIgnored = ['error']
            //             break
            //         case 'text':
            //         case 'number':
            //         default:
            //             components.Container = Box
            //             components.Input = TextField
            //             break
            //     }
            //     return { ...defaultProps, components }
            // }
            break
    }
}
export default FormInput

const handleChangeCb = (
    props,
    rxValue,
    rxMessage,
    setError,
) => (event, ...args) => {
    let {
        checkedValue = true,
        customMessages,
        inputProps = {},
        integer = false, // number validation
        onChangeSelectValue,
        uncheckedValue = false,
        validate,
        validatorConfig = {},
    } = props
    let {
        multiple,
        onChange,
        requiredAlt,
        type,
    } = inputProps
    const { required = requiredAlt } = props
    let {
        persist,
        target: {
            checked,
            selectionEnd,
            selectionStart,
            setSelectionRange,
            value: eValue,
        } = {},
    } = event || {}
    let value = isObj(args[0]) && args[0].hasOwnProperty('value')
        ? args[0].value
        : eValue
    if (isFn(onChangeSelectValue)) {
        const changedValue = onChangeSelectValue(event, ...args)
        value = changedValue !== undefined
            ? changedValue
            : value

    }
    // value unchanged
    const unchanged = isEqual(rxValue.___validated, value)
    if (unchanged) return

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

    const data = { ...props, value }
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

    const triggerChange = (err) => {
        const error = !!err || !!crInvalid
        const message = err && err !== true
            ? {
                content: err,
                status: statuses.error
            }
            : criteriaMsg

        if (message) {
            // delay displaying the mssage and store the timeout ID
            rxMessage._timeoutId = rxMessage.deferred(message)
        } else {
            // remove any pending deffered message
            rxMessage._timeoutId && clearTimeout(rxMessage._timeoutId)
            rxMessage._timeoutId = null
            rxMessage.next(message)
        }
        setError(error)
        isFn(onChange) && onChange(
            event,
            { ...data, error },
            ...args
        )
        setCursor()

        // prevents re-validation because of the trigger
        rxValue.___validated = data.value
        // trigger value change on the subject
        const unchagned = isEqual(rxValue.value, data.value)
        !unchagned && rxValue.next(data.value)
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

const isEqual = (v1, v2) => {
    v1 = isStr(v1)
        ? v1
        : JSON.stringify(v1)
    v2 = isStr(v2)
        ? v2
        : JSON.stringify(v2)
    return v1 === v2
}