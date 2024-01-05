import { fallbackIfFails } from '../../utils'

/**
 * @name    setupDefaults
 * @summary setup defaults for all the components within the directory based on the UI library used
 * 
 * @param   {String} name       name of the NPM module. Eg: '@mui/material'
 * @param   {Object} module    the imported library. Eg: `require('@mui/material')`
 * @param   {Object} extraModules     other NPM modules that may be used by a particular component.
 * 
 * @example ```JavaScript
 * setupDefaults(
 *      '@mui/material',
 *      require('@mui/material'),
 *      {
 *          '@mui/icons-material': require('@mui/icons-material') // used by Icon
 *      }
 * )
 * ```
 */
export const setupDefaults = (name, module, extraModules = {}) => {
    const everything = require('./') // all exported items in the index.js file
    Object
        .keys(everything)
        .forEach(key =>
            fallbackIfFails(() =>
                everything[key]
                    ?.setupDefaults
                    ?.(
                        `${name || ''}`.toLowerCase(),
                        module,
                        extraModules
                    )
            )
        )
}