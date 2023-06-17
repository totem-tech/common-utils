import PropTypes from 'prop-types'
import React, { useMemo } from 'react'
import { BehaviorSubject } from 'rxjs'
import { isArr, isSubjectLike } from '../../utils'
import { useRxSubject, useRxSubjects } from '../hooks'

/**
 * @name    RxSubjectView
 * @summary a functional component to display & auto-update the value of an RxJs subject.
 * PS: if value is defined, make sure it is acceptable in the React DOM.
 * 
 * @param   {Object}    props
 * @param   {Boolean}   props.allowMerge         (optional)
 * @param   {Boolean}   props.allowSubjectUpdate (optional)
 * @param   {*}         props.initialValue       (optional)
 * @param   {Array|BehaviorSubject}   props.subject if array of subjects supplied, will use `useRxSubjects`
 * @param   {Function}  props.valueModifier      (optional)
 * 
 * @returns {Element}
 */
export const RxSubjectView = React.memo(props => {
    const {
        allowMerge,
        allowSubjectUpdate,
        debug,
        initialValue,
        subject,
        valueModifier,
    } = props
    const hook = useMemo(() =>
        isArr(subject) && subject.every(isSubjectLike)
            ? useRxSubjects
            : useRxSubject
    )
    const [value = ''] = hook(
        subject,
        valueModifier,
        initialValue,
        allowMerge,
        allowSubjectUpdate,
        debug,
    )

    return value
})
RxSubjectView.propTypes = {
    allowMerge: PropTypes.bool,
    allowSubjectUpdate: PropTypes.bool,
    debug: PropTypes.bool, // only for single subject
    initialValue: PropTypes.any,
    subject: PropTypes.oneOfType([
        PropTypes.instanceOf(BehaviorSubject),
        PropTypes.any,
    ]).isRequired,
    valueModifier: PropTypes.func,
}
RxSubjectView.defaultProps = {
    allowMerge: false,
    allowSubjectUpdate: false,
}
export default RxSubjectView