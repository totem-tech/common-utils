import React, { isValidElement, useMemo } from 'react'
import { translated } from '../../../languageHelper'
import { useRxSubject } from '../../hooks'
import { isFn, isStr } from '../../../utils'

const textsCap = translated({
    noOptions: 'no options available',
}, true)[1]

/**
 * @name    useOptions
 * @summary a hook to make use of the rxOptions and rxOptionsModifier and auto update options.
 * 
 * @param   {Object}    input
 * @param   {Object}    input.components
 * @param   {*}         input.components.Input        
 * @param   {*}         input.components.OptionItem  (optional) component to be used to generate option items.
 *                                                   Relevant `options array` item (object) will be supplied as props.
 *                                                   Default: 'option' (if InputComponent is 'input' or 'select')
 * @param   {*}         input.components.OptionsWrap (optional) 
 * @param   {Object}    input.inputProps 
 * @param   {Array}     input.inputProps.options     (optional) default options
 * @param   {String}    input.inputProps.type        (optional) input type
 * @param   {*}         input.optionsEmptyMessage    (optional) empty message for dropdown input
 * 
 * @returns {Array}     [replaceOptionsProp bool, optionItems array/element]
 */
export const useOptions = (input = {}) => {
    const {
        components: {
            Input,
            OptionItem = (
                ['input', 'select']
                    .includes(Input)
                    ? 'option'
                    : undefined
            ),
            OptionsWrap,
        },
        inputProps: {
            options = [],
            type: typeAlt,
        } = {},
        optionsEmptyMessage = textsCap.noOptions,
        optionsWrapProps,
        renderOptionItem: renderItem,
        rxOptions = options,
        rxOptionsModifier,
        type = typeAlt,
    } = input

    const isDropdown = useMemo(() =>
        ['dropdown', 'select'].includes(
            `${type}`.toLowerCase()
        ),
        [type]
    )
    let [[optionItems, replaceOptionsProp]] = useRxSubject(
        rxOptions,
        (options, ...args) => {
            options = !isFn(rxOptionsModifier)
                ? options
                : rxOptionsModifier(options, ...args)
            if (isDropdown && !(options || []).length) options = [{
                label: optionsEmptyMessage,
                text: optionsEmptyMessage,
                value: '',
            }]

            // element or element array received
            if (isValidElement(options) || isValidElement(options[0])) return [options, false]

            // no options availabe
            if (!options.length) return []

            // option items are objects and to be passed on to input element's `option` prop
            if ((!OptionItem && !renderItem)) return [options, true]

            const optionItems = options
                .map((o, i) => isStr(o)
                    ? {
                        children: o,
                        key: o,
                        value: o,
                    }
                    : {
                        ...o,
                        children: o.text || o.label,
                        key: `${o.key}${o.value}${i}`,
                    }
                )
                .map((o, i) => (
                    isFn(renderItem)
                        ? renderItem(o, i, options, input)
                        : !OptionItem ? o : <OptionItem {...o} />
                ))

            return [optionItems, false]
        },
        options, // initial value
    )

    return [
        // whether to replace inputProps.options
        // or place the optionItems directly into the DOM
        replaceOptionsProp,
        !OptionsWrap || !optionItems
            ? optionItems || ''
            : <OptionsWrap {...{
                ...optionsWrapProps,
                children: optionItems,
            }} />
    ]
}

export default useOptions