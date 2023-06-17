import PropTypes from 'prop-types'
import React, { useMemo } from 'react'
import { styled } from 'styled-components'
import {
    className,
    isFn,
    isObj
} from '../../utils'
import { rxLayout } from '../../window'
import { useIsMobile } from '../hooks'
import ScrollIndicator from './ScrollIndicator'

export const styleAScollbar = (
    selector,
    isMobile,
    // local variables
    width = `${isMobile ? 3 : 8}px`,
    scrollbarBg = '#eee',
    thumbBg = '#989393',
) => `
${selector}::-webkit-scrollbar {
    width: ${width};
    background: ${scrollbarBg};
}
${selector}::-webkit-scrollbar-thumb {
    background: ${thumbBg};
    border-radius: ${width};
}`

const _ScrollbarStyled = ({
    Component = 'div',
    css = '',
    indicator = true,
    ...props
}) => {
    const idClass = useMemo(() => {
        _ScrollbarStyled.serial ??= 1000
        const prefix = 'ScrollbarStyled'
        const id = `SS${++_ScrollbarStyled.serial}`
        return `${prefix} ${id}`
    }, [])

    props = {
        ...props,
        ...isObj(indicator) && indicator,
        className: className([
            idClass,
            props.className,
            'teststyled'
        ]),
    }
    if (indicator) {
        props.Component = Component
        Component = ScrollIndicator
    }
    return <Component {...props} />
}
export const ScrollbarStyled = React.memo(
    styled(_ScrollbarStyled)`${({
        isMobile = useIsMobile(),
        scrollbar: {
            background = '#eee',
            display = !isMobile
                ? 'block'
                : 'none',
            width = `${isMobile ? 3 : 8}px`,
            ...styles1
        } = {},
        thumb: {
            background: tBg = '#989393',
            width: tWidth = width,
            ...styles2
        } = {},
    }) => `
    &::-webkit-scrollbar {
        display: ${display};
        background: ${background};
        width: ${width};
        ${styles1}
    }
    &::-webkit-scrollbar-thumb {
        display: ${display};
        background: ${tBg};
        border-radius: ${tWidth};
        ${styles2}
    }`}`
)
ScrollbarStyled.defaultProps = {
    // inline styles for the <Style> tag to define scrollbar width and color
    // css: styleAScollbar
}
ScrollbarStyled.propTypes = {
    Component: PropTypes.elementType,
    css: PropTypes.oneOfType([
        PropTypes.string,
        // args: selector (string)
        PropTypes.func,
    ]),
}
export default ScrollbarStyled