import React, { isValidElement } from 'react'
import PropTypes from 'prop-types'
import {
    icons as statusIcons,
    isDefined,
    isObj,
    isStr,
    objWithoutKeys
} from '../../../utils/utils'
import { useInverted } from '../../../utils/window'
import { toProps } from '../toProps'

export const colors = {
    error: '#b71c1c',
    error_bg: '#ffcdd2',
    info: '#212121',
    info_bg: '#e0e0e0',
    loading: '#f57f17',
    loading_bg: '#fff9c4',
    success: '#1b5e20',
    success_bg: '#c8e6c9',
    warning: '#fff9c4',
    warning_bg: '#e65100',
}

export const statuses = {
    error: 'error',
    info: 'info',
    loading: 'loading',
    success: 'success',
    warning: 'warning',
}

export const icons = {
    basic: '',
    error: '',
    loading: '',
    info: '',
    success: '',
    warning: '',
}

/**
 * @name    Message
 * @summary React component to display simple message with header text.
 * 
 * @example ```javascript
 * <Message {...{ 
 *   content: 'body',
 *   header: 'title',
 *   icon: true,
 *   status: 'success',
 * }} />
 * ```
 */
const Message = React.memo(({
    children,
    background,
    color,
    colorMapping,
    components: {
        Container = 'div',
        Header = 'div',
        Icon,
    },
    content = children,
    icon,
    iconMapping,
    iconProps = {},
    inverted = useInverted(),
    header,
    severity,
    status = severity,
    style = {},
    text = content,
    ...props
}) => {
    if (!text && !header) return ''

    const { opacity = dp?.style?.opacity } = style
    const dp = Message.defaultProps
    const headerProps = {
        ...isObj(dp.header) && dp.header,
        ...toProps(header),
    }
    text = isStr(text)
        ? text.replace('Error: ', '') // remove "Error: " from error messages
        : text
    const isLoading = status === statuses.loading
    status = isLoading
        // use 'warning' status apearance for 'loading' status
        ? statuses.warning
        : statuses[status] || statuses.info

    if (icon && !isValidElement(icon)) {
        icon = toProps(icon, 'name')
        // default status icon
        let statusIcon = !isStr(icon.name)
            ? isLoading
                ? iconMapping[statuses.loading]
                : iconMapping[status]
            : undefined
        const siEl = isValidElement(statusIcon)
        if (!siEl) statusIcon = toProps(statusIcon, 'name')

        const icStr = isStr(icon.name)
        if (!icStr && siEl) {
            // no icon name provided, use default status icon
            icon = statusIcon
        } else {
            icon = {
                ...statusIcon,
                ...icon,
                name: isStr(icon.name)
                    ? icon.name
                    : statusIcon.name,
            }
        }

        const icEl = isValidElement(icon)
        if (!icEl) {
            const { name } = icon
            icon = {
                ...iconProps,
                ...icon,
                icon: name,// Fontawesome React
                name,// semantic UI
                style: {
                    ...statusIcon?.style,
                    ...iconProps?.style,
                    ...isObj(icon) && icon.style,
                },
            }
        }
        icon = Icon && isObj(icon) && !icEl
            ? <Icon {...icon} />
            : icon

    }

    // Align text to center when only content or title is available and no icon
    const isContainerStr = isStr(Container)
    const shouldAlignCenter = !icon && (!text || !header)
    if (shouldAlignCenter) style.textAlign ??= 'center'

    const useChildren = !!Header || !text && isValidElement(children)
    const containerProps = {
        ...props,
        // use Header component provided
        children: !useChildren
            ? undefined
            : (
                <>
                    {Header && header && (
                        <Header {...{
                            ...headerProps,
                            style: {
                                fontWeight: 'bold',
                                ...headerProps?.style,
                            },
                        }} />
                    )}
                    {text}
                </>
            ),
        color,
        // no `Header` component, pass on `content` and `header` to `Container`
        content: !useChildren && text || undefined,
        header: !useChildren && header || undefined,
        icon: !isContainerStr
            && !useChildren
            && icon,
        // for compatibility with MUI <Alert/>
        severity: severity ||
            objWithoutKeys(statuses, ['basic', 'loading'])[status]
            || undefined,
        status,
        ...{
            // Semantic UI status
            positive: status === statuses.success,
            negative: status === statuses.error,
            warning: status === statuses.warning || isLoading,
        },
        style: {
            ...isContainerStr && {
                background: background || colorMapping[`${status}_bg`],
                color: color || colorMapping[status],
                borderRadius: 4,
                padding: '10px 15px',
            },
            margin: '5px 0',
            opacity: isDefined(opacity)
                ? opacity
                : inverted
                    ? 0.75
                    : 1,
            ...dp.style,
            ...style,
        },
    }
    return <Container {...containerProps} />
})
Message.defaultProps = {
    background: undefined,
    color: undefined,
    colorMapping: colors,
    components: {
        Content: 'div',
        Header: 'div',
    },
    iconMapping: icons,
}
Message.propTypes = {
    // background color if `Content` not supplied
    background: PropTypes.string,
    // text color if `Content` not supplied
    color: PropTypes.string,
    colorMapping: PropTypes.shape({
        error: PropTypes.string,
        error_bg: PropTypes.string,
        info: PropTypes.string,
        info_bg: PropTypes.string,
        loading: PropTypes.string,
        loading_bg: PropTypes.string,
        success: PropTypes.string,
        success_bg: PropTypes.string,
        warning: PropTypes.string,
        warning_bg: PropTypes.string,
    }),
    components: PropTypes.shape({
        Content: PropTypes.elementType,
        Header: PropTypes.elementType,
        Icon: PropTypes.elementType,
        // default icon props 
    }),
    content: PropTypes.any,
    icon: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.element,
        PropTypes.object,
        PropTypes.string,
    ]),
    iconMapping: PropTypes.any,
    // extra propeties to be supplied when `icon` is an object or `Icon` is being used
    iconProps: PropTypes.object,
    header: PropTypes.any,
    status: PropTypes.string,
    style: PropTypes.object,
}
export default Message

export const setupDefaults = (name, library) => {
    if (!name || !library) return

    const dp = Message.defaultProps
    switch (`${name}`.toLowerCase()) {
        case 'semantic-ui-react':
            dp.components.Container = library.Message
            dp.components.Header = null
            dp.iconMapping = { ...statusIcons }
            dp.iconProps = {
                style: { fontSize: 22 }
            }

            // for legacy status support in the totem-ui repo
            statuses.BASIC = ''
            statuses.ERROR = 'error'
            statuses.INFO = 'info'
            statuses.LOADING = 'loading'
            statuses.SUCCESS = 'success'
            statuses.WARNING = 'warning'
            break
        case '@mui/material':
            dp.components.Container = library.Alert
            dp.components.Header = library.AlertTitle
            // dp.components.Icon = Icon // ToDo: Use custom IconMUI 
            dp.header = { marginBottom: 0 }
            dp.iconProps = {
                style: { fontSize: 50, },
                size: 50,
            }
            dp.iconMapping = {
                basic: false, // no icon
                error: 'Error',
                info: 'InfoOutlined',
                loading: {
                    name: 'CircularProgress',
                    size: 37, // equivalent to size 50 of regular icons!!
                },
                success: 'CheckCircleOutline',
                warning: 'WarningAmberOutlined',
            }
    }
}