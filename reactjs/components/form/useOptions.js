import React, { isValidElement } from 'react'
import { translated } from '../../../languageHelper'
import {
    isArr,
    isFn,
    isObj,
    isStr,
} from '../../../utils'
import { useRxSubject } from '../../hooks'

const textsCap = {
    noOptions: 'no options available',
}
translated(textsCap, true)

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
    let {
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
        optionsEmptyText,
        optionsContentkey = 'children',
        optionsReplaceProp,
        optionsRenderItem: renderItem,
        optionsWrapProps,
        rxOptions = options,
        rxOptionsModifier,
        rxValue,
        type = typeAlt,
    } = input

    const [optionItems] = useRxSubject(rxOptions, options => {
        options = rxOptionsModifier?.(options) || options
        // element or element array received
        const ignore = !isArr(options) //
            || isValidElement(options) // element supplied
            || isValidElement(options[0]) // array of item elements
        if (ignore) return options

        const emptyText = optionsEmptyText !== undefined
            ? optionsEmptyText
            : ['dropdown', 'select']
                .includes(`${type}`.toLowerCase())
            && textsCap.noOptions
        // Add an option to indicate no result available.
        // Only for specific types.
        const isEmpty = !options.length
        const addEmptyItem = isEmpty
            && emptyText
        if (addEmptyItem) options = [{
            disabled: true,
            [optionsContentkey]: emptyText,
            value: '',
        }]

        // option items are objects and to be passed on to input element's `option` prop
        if (!OptionItem && !renderItem) return options

        const optionItems = options
            .map((o, i) => {
                if (!isObj(o)) o = {
                    [optionsContentkey]: o,
                    value: o,
                }
                return {
                    ...isObj(o) && o,
                    key: o.key || `${o.value}${i}`,
                }
            })
            .map((option, index) => (
                isFn(renderItem)
                    ? renderItem(
                        option,
                        index,
                        options,
                        input,
                        optionsContentkey
                    )
                    : !OptionItem
                        ? option
                        : <OptionItem {...option} />
            ))

        return optionItems
    })

    // whether to replace inputProps.options
    // or place the optionItems directly into the DOM
    optionsReplaceProp ??= !!OptionsWrap
        && !OptionItem
        && !renderItem

    return [
        optionsReplaceProp,
        !OptionsWrap || !optionItems
            ? optionItems || ''
            : <OptionsWrap {...{
                ...optionsWrapProps,
                children: optionItems,
            }} />
    ]
}

export default useOptions