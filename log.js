import { fallbackIfFails } from './utils'

export const ifDebug = (...args) => isDebug && console.log(...args)

export const isDebug = fallbackIfFails(
    () => ['YES', 'TRUE'].includes(
        `${process.env.DEBUG || process.env.REACT_APP_DEBUG}`
            .toUpperCase()
    )
)

// ToDo: add error reporting?
export const report = (...args) => console.error(...args)

export default {
    ifDebug,
    isDebug,
    report,
}
