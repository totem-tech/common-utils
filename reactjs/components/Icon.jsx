import React from 'react'
import PropTypes from 'prop-types'

/**
 * @name    Icon
 * @summary a simple gateway to all icons available in under `@mui/icons-material` as well as `CircularProgress` icon from `@mui/material` NPM module.
 * 
 * @param   {Object}    props       properties to be supplied to the icon component
 * @param   {String}    props.name  name of the icon component. Case-sensitive.
 * @param   {Number}    props.size  (optional) icon size
 * @param   {Object}    props.style (optional) icon style
 * 
 * @example ```javascript
 * // Create a simple icon using the `Info` component from `@mui/icons-material`
 * const infoIcon = <Icon name='Info' size={30} style={{ color: 'red' }} />
 * const loadingSpinner = <Icon name='CircularProgress' />
 * ```
 * 
 * @returns {Element}
 */
export const Icon = React.memo(({
    Component,
    size,
    style,
    ...props
}) => {
    if (!Component) {
        !Icon.warned && console.warn(
            'Icon cannot be used until Icon.setupDefaults() function is invoked with correct properties'
        )
        Icon.warned = true
        return ''
    }

    return (
        <Component {...{
            ...props,
            size,
            style: {
                fontSize: size,
                ...style,
            },
        }} />
    )
})
Icon.defaultProps = {
    Component: null,
    library: '',
}
Icon.propTypes = {
    name: PropTypes.string.isRequired,
    size: PropTypes.number,
    style: PropTypes.object,
}
/**
 * @name    setupDefaults
 * @summary setup defaults for all the components within the directory based on the UI library used
 * 
 * @param   {String} name           name of the NPM module. Eg: '@mui/material'
 * @param   {Object} module         the imported library. Eg: `require('@mui/material')`
 * @param   {Object} extraModules   other NPM modules that may be used by a particular component.
 */
Icon.setupDefaults = (name, module, extraModules = {}) => {
    const dp = Icon.defaultProps
    dp.library = name
    switch (name) {
        case '@mui/material':
            const icons = extraModules['@mui/icons-material'] || {}
            icons.CircularProgress = module?.CircularProgress
            Icon.icons = icons

            Object
                .keys(icons)
                .forEach(name =>
                    icons[`${name}`.toLowerCase()] = icons[name]
                )

            dp.Component = props => {
                const { name } = props
                const IconComponent = icons[`${name}`.toLowerCase()] || icons.Info
                return !!IconComponent && <IconComponent {...{
                    ...props,
                    style: {
                        verticalAlign: 'middle',
                        ...props?.style
                    }
                }} />
            }
            break
        case 'semantic-ui-react':
            Icon.Component = module.Icon
            break
    }
}
export default Icon