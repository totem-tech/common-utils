import { fallbackIfFails, getUrlParam } from './utils'
import { MOBILE, rxLayout } from './window'

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
) || fallbackIfFails(() => getUrlParam('debug') === 'true')

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

// print logs inside the HMTL document when URL param debug =
// - "force"
// - "true" and layout is mobile
export const setupInlineLogger = () => {
    const d = fallbackIfFails(() => getUrlParam('debug').toLowerCase())
    const isMobile = rxLayout.value === MOBILE
    const debugInline = d === 'force' || (d === 'true' && isMobile)
    if (debugInline) {
        // for debugging purposes only, when on a mobile device
        // adds interceptors to below console functions and prints all logs into a DOM element above page contents
        const loggers = [
            ['error', console.error, 'red'],
            ['errorDebug', console.errorDebug, 'red'],
            ['info', console.info, 'teal'],
            ['infoDebug', console.infoDebug, 'teal'],
            ['log', console.log],
            ['logDebug', console.logDebug],
            ['trace', console.trace, 'blue'],
            ['traceDebug', console.traceDebug, 'blue'],
            ['warn', console.warn, 'orange'],
            ['warnDebug', console.warnDebug, 'orange'],
        ]
        document.body.insertAdjacentHTML(
            'afterbegin',
            '<div id="error-container" style="height: auto;max-height:200px;width:100%;overflow-y:auto;"></div>'
        )
        loggers.forEach(([key, fn, color = '']) => {
            console[key] = (...args) => {
                fn.apply(console, args)
                const errContainer = document.getElementById('error-container')
                let content = args
                    .map(x => {
                        let str = x
                        try {
                            str = isError(x)
                                ? x.stack
                                : JSON.stringify(
                                    isArrLike(x) ? Array.from(x) : x,
                                    null,
                                    4
                                )
                        } catch (e) {
                            // in case of Object circular dependency
                            str = `${x}`
                        }
                        return `${str}`.replace(/\\n/g, '<br />')
                    })
                    .join(' ')
                const style = `white-space:pre-wrap;margin:0;padding:5px 15px;border-bottom:1px solid #ccc;color:${color}`
                content = `<pre style="${style}">${content}</pre>`
                errContainer.insertAdjacentHTML('afterbegin', content)
            }
        })
    }
}