import React from 'react'
import { styled } from 'styled-components'

const BasicButton = styled.button`${props => `
background: ${props.style?.background
    || {
        info: 'grey',
        error: 'rgb(243 74 74)',
        success: 'rgb(72 184 72)',
        warn: 'orange',
    }[props.status]
    || 'grey'};
border: none;
border-radius: 3px;
color: white;
margin: 3px;
padding: 10px 20px;

&:not(:hover):not(:focus) {
    opacity: 0.9;
}
`}`

export const Button = React.memo(({ Component, ...props }) => (
    <Component {...props} />
))
Button.defaultProps = {
    Component: BasicButton,
}

export default Button