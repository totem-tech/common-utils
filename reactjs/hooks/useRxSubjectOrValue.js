import { isSubjectLike } from '../../utils'
import useRxSubject from './useRxSubject'

/**
 * @name    useRxSubjectOrValue
 * @summary sugar for useRxSubject with condition to only use it if a subject is supplied.
 * If no subject is supplied, will return it immediately
 *
 * @param   {*} subject subject or value
 *
 * @returns {*}
 */
export const useRxSubjectOrValue = (subject, ...args) => !isSubjectLike(subject)
    ? subject
    : useRxSubject(subject, ...args)[0]

export default useRxSubjectOrValue