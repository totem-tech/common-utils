import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import {
    arrUnique,
    className,
    isArr,
    isObj,
} from '../../../utils'

export const CheckboxGroup = (props) => {
    let {
        components: {
            Option,
            Options,
        },
        error,
        inline,
        multiple,
        name,
        onChange,
        optionCommonProps,
        options = [],
        radio,
        strict,
        toggle: _toggle,
        type,
        value,
        ...optionsWrapProps
    } = props
    const handleChangeCb = useCallback((props, option) => (e = {}, data) => {
        if (!isObj(option)) return

        // make sure event persists even when deferred callbacks are used externally
        e?.persist?.()
        e.target ??= {}
        const { checked = !!data?.checked } = e.target
        let { options = [], value } = props
        if (multiple && !isArr(value)) value = []

        value = !multiple
            ? checked && value !== option.value
                ? option.value
                : undefined
            : arrUnique(
                !checked || value.includes(option.value)
                    ? value.filter(x => x !== option.value)
                    : [...value, option.value]
            )

        // exclude any value that's not in the options
        if (strict) {
            const exists = x => options.find(o => o.value === x)
            value = !multiple
                ? exists(value)
                    ? value
                    : ''
                : value.filter(exists)
        }

        e.target.value = value
        option.onChange?.(
            e,
            data,
            value
        )
        onChange?.(
            e,
            { ...props, value },
            option,
        )
    })
    const isCheckbox = !radio && `${type}`
        .toLowerCase()
        .includes('checkbox')

    return (
        <Options {...{
            ...optionsWrapProps,
            className: className([
                'CheckboxGroup',
                optionsWrapProps?.className,
                'utils'
            ])
        }}>
            {options.map((option, i) => {
                const oProps = {
                    ...option,
                    key: `${i}-${option.value}`,
                    label: (
                        <label className='CheckboxGroupLabel'>
                            {option.label ?? option.text}
                        </label>
                    ),
                    name,
                    onChange: undefined,
                    // using onClick allows to uncheck radio.
                    onClick: handleChangeCb(props, option),
                    value: `${option.value}`,
                    ...[optionCommonProps, optionProps]
                        .filter(Boolean)
                        .map(itemProps => isObj(itemProps)
                            ? itemProps
                            : itemProps?.(
                                option,
                                isCheckbox,
                                props,
                                handleChangeCb(props, option),
                            ))
                        .reduce((obj, next) => ({
                            ...obj,
                            ...next,
                        }), {}),
                }
                return <Option {...oProps} />
            })}
        </Options>
    )
}
CheckboxGroup.defaultProps = {
    components: {
        Option: 'label',
        Options: 'div',
    },
}
const stringOrElement = PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.string
])
CheckboxGroup.propTypes = {
    components: PropTypes.shape({
        Option: PropTypes.elementType.isRequired,
        Options: PropTypes.elementType.isRequired,
    }).isRequired,
    inline: PropTypes.bool,
    multiple: PropTypes.bool,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            label: stringOrElement,
            text: stringOrElement,
            value: PropTypes.any.isRequired,
        })
    ),
    // additional properties to be supplied to Option
    optionCommonProps: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.func,
    ]),
    radio: PropTypes.bool,
    toggle: PropTypes.bool, // semantic ui only
}
let optionProps = (
    option,
    isCheckbox,
    {
        inline,
        multiple,
        name,
        value,
    },
    handleChange,
) => ({ // for native checkboxes
    children: (
        <>
            <input {...{
                ...option,
                checked: !multiple
                    ? value === option.value
                    : (isArr(value) && value || [])
                        .includes(option.value),
                name,
                onChange: handleChange,
                type: isCheckbox
                    ? 'checkbox'
                    : 'radio',
            }} />&nbsp;
            {option.label || option.text}
            {!inline && <br />}
        </>
    ),
    onChange: undefined, // override to prevent onChange being passed on to the label
})
CheckboxGroup.setupDefaults = (name, module = {}, _extraModules) => {
    const { components } = CheckboxGroup.defaultProps
    switch (name) {
        case '@mui/material':
            const {
                Checkbox: MUI_Checkbox,
                FormControlLabel,
                Radio: MUI_Radio,
                RadioGroup,
            } = module
            components.Options = RadioGroup // used for both Checkbox and Radio
            components.Option = FormControlLabel
            optionProps = (option, isCheckbox, props) => {
                let {
                    multiple,
                    value
                } = props
                if (multiple && !isArr(value)) value = []
                const Control = isCheckbox
                    ? MUI_Checkbox
                    : MUI_Radio

                return {
                    control: (
                        <Control {...{
                            ...option,
                            checked: !multiple
                                ? value === option.value
                                : value.includes(option.value),
                        }} />
                    ),
                }
            }
            break
        case 'semantic-ui-react':
            const { Checkbox: SUI_Checkbox } = module
            components.Option = SUI_Checkbox
            optionProps = (
                option = {},
                isCheckbox,
                props = {}
            ) => {
                let {
                    inline,
                    multiple,
                    value,
                } = props
                value = multiple
                    ? isArr(value)
                        ? value
                        : []
                    : value
                const {
                    radio = props.radio,
                    style,
                    toggle = props.toggle,
                    value: optionValue,
                } = option
                const checked = multiple
                    ? value.includes(optionValue)
                    : value === optionValue

                return {
                    checked,
                    radio: isCheckbox
                        ? undefined
                        : radio,
                    style: {
                        display: inline
                            ? 'inline-block'
                            : 'block',
                        margin: 5,
                        ...style,
                    },
                    toggle,
                }
            }
            break
    }
}
export default CheckboxGroup