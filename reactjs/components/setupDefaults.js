// ToDo: configure components for specific frameworks (MUI/Semantic)
import { fallbackIfFails } from '../../utils.js'

export const setupDefaults = (name, library) => {
    const everything = require('./')
    Object
        .keys(everything)
        .forEach(key =>
            fallbackIfFails(() =>
                everything[key]
                    ?.setupDefaults
                    ?.(name, library)
            )
        )
}