export * from './box'
export * from './secretBox'
export * from './sign'
export * from './utils'

export const box = require('./box').default
export const object = require('./object').default
export const secretBox = require('./secretBox').default
export const sign = require('./sign').default

export default {
    box,
    object,
    secretBox,
    sign,
}