import { useMemo } from 'react'
import { isArr, isFn } from '../../utils'
import useRxSubject from './useRxSubject'

/**
 * @name    useRxSubjects
 * @summary custom React hook to observe an array of RxJS subjects and auto-update wehenever any of the value changes
 *
 * @param   {Array}     subjects        RxJS subjects to observe
 * @param   {Function}  valuesModifier  (optional) callback to reduce/alter the subject values into a single value.
 *                                      This will not affect the original subject values.
 *                                      Args: 
 *                                      - values    array
 *                                      - subjects  array
 * @param   {Array}     confs           (optional) configuration to be passed on to `useRxSubject` for each subject.
 *                                      Array of objects with one or more of the following properties:
 *                                      - allowMerge         bool
 *                                      - allowSubjectUpdate bool
 *                                      - initialValue       any
 *                                      - valueModifier      function
 * 
 * @returns [values, RxJS subjects]
 * 
 * @example
 * ```javascript
 * // Observe multiple RxJS subjects
 * const [values, subjects] = useRxSubjects([
 *     new BehaviorSubject(1),
 *     new BehaviorSubject(2),
 * ])
 * console.log(values) // [1,2]
 *
 * // Create new RxJS BehaviorSubjects from the values.
 * const [values, subjects] = useRxSubjects([1, 2])
 * console.log(values) // [1,2]
 * 
 * 
 * // 
 * ```
 *
 */
export const useRxSubjects = (
    subjects,
    valuesModifier,
    confs = [],
    debug
) => {
    subjects = !isArr(subjects)
        ? [subjects]
        : subjects
    const results = subjects.map((subject, i) =>
        useRxSubject(
            subject,
            confs[i]?.valueModifier,
            confs[i]?.initialValue,
            confs[i]?.allowMerge,
            confs[i]?.allowSubjectUpdate,
        )
    )
    const values = results.map(([value]) => value)
    const _subjects = results.map(([_v, _s, subject]) => subject)

    return [
        !isFn(valuesModifier)
            ? values
            : valuesModifier(values, subjects),
        _subjects,
    ]
}

export default useRxSubjects
