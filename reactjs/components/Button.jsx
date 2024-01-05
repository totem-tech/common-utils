import React from 'react'
import { className } from '../../utils'
import './button-styles.css'

export const BasicButton = ({
    buttonClass,
    className: cls,
    status,
    ...props
}) => (
    <button {...{
        ...props,
        className: className([
            cls,
            buttonClass,
            status,
        ]),
    }} />
)
BasicButton.defaultProps = {
    buttonClass: 'BasicButton',
}

export const Button = React.memo(function Button({ Component, ...props }) {
    return <Component {...props} />
})
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

export const ModalCloseIcon = props => <div {...props} />
ModalCloseIcon.defaultProps = {
    className: 'ModalCloseIcon',
}
export default Button