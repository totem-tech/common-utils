import { isFn, isSubjectLike } from '../../utils'
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
export const useRxSubjectOrValue = (
    subject,
    valueModifier,
    ...args
) => !isSubjectLike(subject)
        ? isFn(valueModifier)
            ? valueModifier(subject)
            : subject
        : useRxSubject(
            subject,
            valueModifier,
            ...args
        )[0]

export default useRxSubjectOrValue