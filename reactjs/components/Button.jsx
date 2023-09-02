import React from 'react'
import { fallbackIfFails } from '../../utils'

export const BasicButton = fallbackIfFails(() => {
    const { styled } = require('styled-components')

    const getProps = props => `
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
        &[disabled] {
            background: #a1a1a1;
        }
    `
    return styled.button`${getProps}`
}, [], 'button')


export const Button = React.memo(({ Component, ...props }) => <Component {...props} />)
Button.defaultProps = {
    Component: BasicButton,
}
Button.setupDefaults = (name, module, _extraModules) => {
    const dp = Button.defaultProps
    switch (name) {
        case '@mui/material':
            const { Button: MuiButton } = module
            dp.Component = ({ color, status, ...props }) => (
                <MuiButton {...{
                    ...props,
                    color: color || {
                        error: 'error',
                        success: 'primary',
                    }[status] || 'secondary',
                }} />
            )
            dp.variant = 'contained'
            break
        case 'semantic-ui-react':
            dp.Component = module.Button
            break
    }
}
export default Button