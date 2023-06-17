import PropTypes from 'prop-types'
import React from 'react'

export const ModalTitle = ({ Component = 'h2', ...props }) => (
    <Component {...{
        ...props,
        style: {
            borderBottom: '1px solid rgb(51 51 51 / 30%)',
            margin: '0 0 15px',
            ...props.style,
        }
    }} />
)
ModalTitle.propTypes = {
    Component: PropTypes.elementType,
}
export default ModalTitle