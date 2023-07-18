import PropTypes from 'prop-types'
import React from 'react'
import { BehaviorSubject, SubjectLike } from 'rxjs'
import { translated } from '../../languageHelper'
import {
    isFn,
    isObj,
    isSubjectLike
} from '../../utils'
import { IGNORE_UPDATE_SYMBOL, useRxSubjects } from '../hooks'
import Message, { statuses } from './Message'

const statusTexts = {
    error: 'error',
    loading: 'in-progress',
    success: 'success',
    suspended: 'pending',
}
translated(statusTexts)

/**
 * @name    useQueueItemStatus
 * @summary watch-out for changes on queue service and return the status message with title & description for a specific queue item.
 * 
 * @param   {String|SubjectLike} id           queue item ID ()
 * @param   {Object|Function}    messageProps (optional)
 * @param   {SubjectLike}        rxOnSave     RxJS subject from the queue service which is triggered whenever an item
 *                                            is created/updated. Must be an object with properties: `rootTask` & `task`
 * @returns {object}    {content, header, icon, status, rxonsave: {rootTask, task}, ...}
 */
export const useQueueItemStatus = (
    id,
    messageProps,
    rxOnSave = QueueItemStatus?.defaultProps?.rxOnSave,
) => {
    const [message = ''] = useRxSubjects(
        [rxOnSave, id],
        getMessage,
        [{  // config for rxOnSave:
            // ignore update if it's not relevant to the `id`
            valueModifier: (value = {}) => {
                const _id = isSubjectLike(id)
                    ? id.value
                    : id
                const ignore = !_id || _id !== value?.rootTask?.id
                return ignore
                    ? IGNORE_UPDATE_SYMBOL
                    : value
            },
        }]
    )

    return !!message
        ? isFn(messageProps)
            ? messageProps(message)
            : { ...message, ...messageProps }
        : message
}

function QueueItemStatus({
    id,
    messageProps,
    rxOnSave,
}) {
    const message = useQueueItemStatus(
        id,
        messageProps,
        rxOnSave,
    )
    return !!message && <Message {...message} />
}
QueueItemStatus.defaultProps = {
    id: undefined,
    rxOnSave: undefined,
    messageProps: undefined,
}
QueueItemStatus.propTypes = {
    // Queue item ID (top level only)
    id: PropTypes.oneOfType([
        PropTypes.instanceOf(BehaviorSubject),
        PropTypes.string.isRequired,
    ]),
    messageProps: PropTypes.oneOfType([
        // if function
        PropTypes.func,
        PropTypes.object,
    ]),
    // queue service on save trigger
    rxOnSave: PropTypes.instanceOf(BehaviorSubject).isRequired,
}
export default QueueItemStatus

const getMessage = ([
    {
        rootTask = {},
        task = {}
    } = {},
    id,
]) => {
    if (!id || rootTask.id !== id) return

    const { description: rDesc, title: rTitle } = rootTask
    let {
        description = rDesc,
        errorMessage,
        title = rTitle,
        status,
    } = task
    if (!title && !description) return

    const statusText = `${statusTexts[status] || ''}`.toUpperCase()
    const serialNo = getSerialNo(rootTask, task)
    if (status === statuses.error) description = errorMessage

    return {
        content: description,
        header: `${serialNo}${title} - ${statusText}`,
        icon: true,
        status,
        rxonsave: {
            rootTask,
            task,
        },
    }
}

const getSerialNo = (rootTask, task) => {
    let total = 0
    let current = 0
    let next = rootTask
    do {
        total++
        if (next === task) current = total
        next = next?.next
    } while (next && !isObj(next?.next))

    return total <= 1
        ? ''
        : `(${current}/${total}) `
}