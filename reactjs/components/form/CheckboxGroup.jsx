import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import {
    arrUnique,
    isArr,
    isObj
} from '../../../utils'

export const CheckboxGroup = props => {
    let {
        components: {
            Option,
            Options,
        },
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

        // console.log({ e, data })
        // make sure event persists even when deferred callbacks are used externally
        e?.persist?.()
        e.target ??= {}
        const { checked } = e.target
        // let { options = [], value, } = props
        if (multiple && !isArr(value)) value = []

        value = !multiple
            ? checked
                ? option.value
                : undefined
            : arrUnique(
                checked
                    ? [...value, option.value]
                    : value.filter(x => x !== option.value)
            )

        // exclude any value that's not in the options
        if (strict) {
            const exists = x => options.find(o => o.value === x)
            value = !multiple
                ? exists(value)
                    ? value
                    : undefined
                : value.filter(exists)
        }

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
    const isCheckbox = !radio || `${type}`
        .toLowerCase()
        .includes('checkbox')
    return (
        <Options {...optionsWrapProps}>
            {options.map((option, i) => (
                <Option {...{
                    ...option,
                    key: `${i}-${option.value}`,
                    name,
                    onChange: handleChangeCb(props, option),
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
                }} />
            ))}
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
                option,
                isCheckbox,
                props
            ) => ({
                radio: !isCheckbox,
                toggle: option.toggle ?? props.toggle,
            })
            break
    }
}
export default CheckboxGroup