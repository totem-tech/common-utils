import React, { useEffect } from 'react'
import PropTypes, { element } from 'prop-types'
import { translated } from '../../../languageHelper'
import { className, isFn, objWithoutKeys } from '../../../utils'
import { useRxSubject } from '../../hooks'
import toProps from '../../toProps'
import _Button from '../Button'
import ModalRoot from './ModalBasic'
import ModalTitle from './ModalTitle'

const textsCap = {
    close: 'close',
}
translated(textsCap, true)

const withClass = (
    Component,
    theClass,
    defaultProps = {}
) => {
    const ComponentWithClass = ({
        className: cls,
        ...props
    }) => (
        <Component {...{
            ...props,
            className: className([
                cls,
                theClass,
            ])
        }} />
    )
    ComponentWithClass.defaultProps = defaultProps

    return ComponentWithClass
}

const defaultComponents = Object.freeze({
    Actions: withClass('div', 'ModalActions'),
    Button: _Button,
    Content: withClass('div', 'ModalContent'),
    ContentInner: withClass('div', 'ModalContentInner'),
    Modal: ModalRoot,
    ModalInner: props => <div {...props} />,
    Subtitle: withClass('div', 'ModalSubtitle'),
    Title: ModalTitle,
})

export function ModalBuilder({
    actionButtons = [],
    actionsProps,
    closeButton,
    components,
    content,
    header,
    ignore = [],
    onClose,
    open: _open,
    prefix,
    subtitle,
    suffix,
    title = header,
    ...props
}) {
    components = {
        ...defaultComponents,
        ...components,
    }
    const {
        Actions,
        Button,
        Content,
        ContentInner,
        Modal,
        ModalInner,
        Subtitle,
        Title,
    } = components
    const [open, setOpen] = useRxSubject(_open ?? false)
    const handleClose = () => {
        setOpen(false)
        isFn(onClose) && onClose()
    }

    // keep an eye on open prop and change accordingly
    useEffect(() => {
        !_open
            ? handleClose()
            : setOpen(_open)
    }, [_open])

    if (!Modal) return

    const closeBtnProps = toProps(closeButton)
    if (closeBtnProps) {
        const { onClick } = closeBtnProps
        // if no color specified use grey background
        closeBtnProps.color ??= 'inherit'
        closeBtnProps.onClick = (...args) => {
            handleClose()
            isFn(onClick) && onClick(...args)
        }
    }
    // actions buttons
    const actionBtns = [
        closeBtnProps,
        ...(actionButtons || [])
            .map(x => ({
                variant: 'contained',
                ...toProps(x) || {},
            })),
    ]
        .filter(Boolean)
        .map((props, i) => {
            const btnProps = { ...props }
            const { Component = Button } = btnProps
            delete btnProps.Component
            return <Component {...{ ...btnProps, key: i }} />
        })

    const contentProps = toProps(content, undefined, false)
    const titleProps = toProps(title, undefined, false)
    return (
        <Modal {...{
            ['aria-describedby']: 'alert-dialog-description',
            ['aria-labelledby']: 'alert-dialog-title',
            ...objWithoutKeys(props, ignore),
            onClose: handleClose,
            open,
        }}>
            <ModalInner {...{ open, onClose: handleClose }}>
                {prefix}
                {(titleProps.children || subtitle) && (
                    <Title {...titleProps}>
                        {titleProps.children}

                        {subtitle && (
                            <Subtitle>
                                <small>{subtitle}</small>
                            </Subtitle>
                        )}
                    </Title>
                )}
                {contentProps && (
                    <Content {...contentProps}>
                        <ContentInner {...{ component: 'div' }}>
                            {contentProps.children}
                        </ContentInner>
                    </Content>
                )}
                {!!actionBtns.length && (
                    <Actions {...{
                        children: actionBtns,
                        ...actionsProps,
                        style: {
                            padding: '15px 0',
                            textAlign: 'right',
                            ...actionsProps?.style,
                        }
                    }} />
                )}
                {suffix}
            </ModalInner>
        </Modal>
    )
}
const actionPropType = PropTypes.oneOfType([
    PropTypes.string,
    // any props that are accepted by MUI Button component
    PropTypes.shape({
        Component: PropTypes.element,// for custom button
    }),
    PropTypes.element,
])
ModalBuilder.propTypes = {
    // Additional buttons to be displayed on the right side of the close button
    actionButtons: PropTypes.arrayOf(actionPropType),
    // Footer Actions component props
    actionsProps: PropTypes.object,
    // The close button
    closeButton: PropTypes.any,
    components: PropTypes.shape({
        // container for footer action buttons
        Actions: PropTypes.elementType,
        // Default Button component
        Button: PropTypes.elementType,
        Content: PropTypes.elementType,
        ContentInner: PropTypes.elementType,
        Modal: PropTypes.elementType,
        Subtitle: PropTypes.elementType,
        // Modal header/title component
        Title: PropTypes.elementType,
    }),
    // Modal body content
    content: PropTypes.any,
    // Callback to be triggered when modal is closed
    onClose: PropTypes.func,
    // Show or hide the modal. NB: if falsy, modal component will still be on the virtual DOM.
    // Default: true
    open: PropTypes.any,
    // Content to be displayed before the title. Eg: to add a mobile modal header
    prefix: PropTypes.any,
    // Modal subtitle/subheader displayed underneath the title.
    // A good place to place short explanation or guideline for the user.
    subtitle: PropTypes.any,
    // Content to be displayed after the action and close buttons.
    suffix: PropTypes.any,
    // Modal title/header
    title: PropTypes.any,
    //... any other props accepted by MUI Modal component
}
ModalBuilder.defaultProps = {
    closeButton: textsCap.close,
    components: { ...defaultComponents },
    // exclude props being passed on to Modals component
    ignore: [
        'actionButtons',
        'actionsProps',
        'closeButton',
        // 'content',
        'conntentInnder',
        'ignore',
        // 'prefix',
        // 'subtitle',
        // 'suffix',
        // 'title',
    ],
    open: true,
}
export default ModalBuilder