import { fallbackIfFails } from './utils'

export function debug(...args) {
    if (!isDebug) return
    const logger = this || console.log
    logger(...args)
}

export const isDebug = fallbackIfFails(
    () => ['YES', 'TRUE'].includes(
        `${process.env.DEBUG || process.env.REACT_APP_DEBUG}`
            .toUpperCase()
    )
)

// ToDo: add error reporting?
export const report = (...args) => console.error(...args)

console.errorDebug = debug.bind(console.error)
console.infoDebug = debug.bind(console.info)
console.logDebug = debug.bind(console.log)
console.traceDebug = debug.bind(console.trace)
console.warnDebug = debug.bind(console.warn)

export default {
    ifDebug: debug,
    isDebug,
    report,
}
