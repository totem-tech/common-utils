import { isValidElement } from 'react'
import { isObj } from '../utils'

/**
 * @name    toProps
 * @summary extract/generate props object to be supplied to an element
 *
 * @param   {String|Element|Object} elOrProps
 * @param   {String}                childrenProp    (optional) Default: `children`
 * @param   {Boolean}               extractElementProps
 *
 * @returns {Object}
 */
export const toProps = (elOrProps = {}, childrenProp, extractElementProps = false) => {
	if (elOrProps === null) return elOrProps

	childrenProp ??= 'children'
	const props = isValidElement(elOrProps)
		? extractElementProps
			? elOrProps.props // react element
			: { [childrenProp]: elOrProps }
		: isObj(elOrProps)
			? elOrProps // plain object
			: { [childrenProp]: elOrProps } // assume string or element
	return { ...props }
}

export default toProps