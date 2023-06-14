import { memo } from 'react'

/**
 * @name    isMemo
 * @summary checks if x is an `Reat.memo` element type
 * @param   {*} x
 *
 * @returns {Boolean}
 */
export const isMemo = x => x?.['$$typeof'] === memo('div')['$$typeof']

export default isMemo