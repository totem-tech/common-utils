import { isArr, isNodeJS, isObj } from './utils'

export const DEVICE_TYPE = {
    desktop: 'desktop',
    mobile: 'mobile',
    nodejs: 'nodejs',
    tablet: 'tablet',
}

// Source https://attacomsian.com/blog/javascript-detect-mobile-device
export const MOBILE_REGEX = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/
export const TABLET_REGEX = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i


/**
 * @name    checkDevice
 * @summary check if device is of specific type
 * 
 * @param   {String|Array} type   Valid types: desktop, mobile, table or nodejs
 * 
 * @returns {Boolean}
 */
export const checkDevice = type => (isArr(type) ? type : [type]).includes(getDeviceType())

/**
 * @name    checkSafari
 * @summary check if browser is Apple Safari 
 * 
 * @param   {Boolean}   desktop check Safari desktop
 *                      Default: `false`
 * 
 * @returns {Boolean}
 */
export const checkSafari = (desktop = false) => {
    const { vendor = '', userAgent = '' } = navigator || {}
    const isSafari = vendor.indexOf('Apple') > -1
        && userAgent.indexOf('CriOS') == -1
        && userAgent.indexOf('FxiOS') == -1

    return !desktop
        ? isSafari
        : isSafari && isObj(window.safari)
}

/**
 * @name    getDeviceType
 * @summary get the type of the device
 * 
 * @returns {String} Device type. One of the following: desktop, mobile, table or nodejs
 */
export const getDeviceType = () => {
    if (isNodeJS()) return DEVICE_TYPE.nodejs

    const { userAgent } = navigator
    if (TABLET_REGEX.test(userAgent)) return DEVICE_TYPE.tablet

    if (MOBILE_REGEX.test(userAgent)) return DEVICE_TYPE.mobile

    return DEVICE_TYPE.desktop
}
