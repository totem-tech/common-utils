import PropTypes from 'prop-types'
import React, { useMemo } from 'react'
import { BehaviorSubject } from 'rxjs'
import { isArr, isSubjectLike } from '../../utils'
import { useRxSubject, useRxSubjects } from '../hooks'

const BS = BehaviorSubject
/**
 * @name    RxSubjectView
 * @summary a functional component to display & auto-update the value of an RxJs subject.
 * PS: if value is defined, make sure it is acceptable in the React DOM.
 * 
 * @param   {Boolean}   props.allowMerge         (optional)
 * @param   {Boolean}   props.allowSubjectUpdate (optional)
 * @param   {Boolean}   props.confs              (optional) if `subject` is an Array.
 * @param   {*}         props.initialValue       (optional)
 * @param   {Array|*}   props.subject            One or more RxJS subjects. 
 *                                               If array of subjects supplied, will use `useRxSubjects`
 * @param   {Function}  props.valueModifier      (optional)
 * 
 * @returns {Element}
 */
export const RxSubjectView = React.memo(props => {
    const {
        allowMerge,
        allowSubjectUpdate,
        confs = [],
        debug,
        initialValue,
        subject,
        valueModifier,
    } = props
    const [hook, multi] = useMemo(() =>
        isArr(subject) && subject.every(isSubjectLike)
            ? [useRxSubjects, true]
            : [useRxSubject, false]
    )
    const [value = ''] = hook(
        subject,
        valueModifier,
        ...multi
            ? [confs]
            : [
                initialValue,
                allowMerge,
                allowSubjectUpdate,
            ],
        debug,
    )

    return value
})
RxSubjectView.defaultProps = {
    allowMerge: false,
    allowSubjectUpdate: false,
}
RxSubjectView.IGNORE_UPDATE = useRxSubject.IGNORE_UPDATE
RxSubjectView.propTypes = {
    allowMerge: PropTypes.bool,
    allowSubjectUpdate: PropTypes.bool,
    confs: PropTypes.array,
    debug: PropTypes.bool,
    initialValue: PropTypes.any,
    subject: PropTypes.any.isRequired,
    valueModifier: PropTypes.func,
}
export default RxSubjectView