import { isArr, isFn } from '../../utils'
import useRxSubject from './useRxSubject'

/**
 * @name    useRxSubjects
 * @summary custom React hook to observe an array of RxJS subjects and auto-update wehenever any of the value changes
 *
 * @param {Array}       subjects
 * @param {Function}    valuesModifier
 *
 *
 * @example
 * ```javascript
 * // Provide RxJS subjects
 * const [values, subjects] = useRxSubjects([
 *     new BehaviorSubject(1),
 *     new BehaviorSubject(2),
 * ])
 * console.log(values) // [1,2]
 *
 * // Provide values array instead of subjects.
 * // Will create new RxJS BehaviorSubjects from the values.
 * const [values, subjects] = useRxSubjects([1, 2])
 * console.log(values) // [1,2]
 * ```
 *
 * @returns [values, RxJS subjects]
 */
export const useRxSubjects = (
    subjects,
    valuesModifier,
) => {
    const results = (
        !isArr(subjects)
            ? [subjects]
            : subjects
    ).map(x => useRxSubject(x))
    const values = results.map(x => x[0])
    const _subjects = results.map(x => x[2])

    return [
        !isFn(valuesModifier)
            ? values
            : valuesModifier(values),
        _subjects,
    ]
}
