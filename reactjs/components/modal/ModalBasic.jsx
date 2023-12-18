import React from 'react'
import { translated } from '../../../languageHelper'
import { className } from '../../../utils'
import {
    MOBILE,
    rxLayout,
    useInverted,
} from '../../../window'
import { useRxSubject } from '../../hooks'
import ScrollbarStyled from '../ScrollbarStyled'
import { ModalCloseIcon } from '../Button'

const textsCap = {
    close: 'close'
}
translated(textsCap, true)

export function ModalBasic({
    children,
    onClose,
    closeButton, //ToDo: remove
    closeIcon = closeButton,
    closeOnBackdropClick = true,
    isMobile,
    ignore,
    style,
    ...props
}) {
    isMobile ??= useRxSubject(rxLayout, l => l === MOBILE)[0]
    closeIcon ??= (
        <ModalCloseIcon {...{
            style: !isMobile
                ? undefined
                : {
                    background: 'black',
                    position: 'absolute',
                    right: 15,
                    top: 15,
                },
            title: textsCap.close,
        }} />
    )

    return (
        <ScrollbarStyled {...{
            ...props,
            className: className([
                'ModalBasic',
                props.className,
            ]),
            indicator: {
                styles: {
                    // places the indicator bar at the top and fixes placement issue due the 'fixed' positioning above
                    root: { position: 'fixed' },
                },
            },
            onClick: closeOnBackdropClick && onClose,
            style: {
                alignItems: 'start',
                background: '#000000eb',
                cursor: closeOnBackdropClick
                    ? 'pointer'
                    : '',
                display: 'flex',
                justifyContent: 'center',
                height: '100%',
                left: 0,
                overflowY: 'scroll',
                padding: isMobile
                    ? '6px 3px'
                    : '2.5% 0',
                // padding: '2.5% 0',
                position: 'fixed',
                top: 0,
                width: '100%',
            },
        }}>
            {closeIcon}
            <div {...{
                className: 'ModalBasicInner',
                onClick: e => e.stopPropagation(),
                style: {
                    background: useInverted()
                        ? '#212121'
                        : 'white',
                    borderRadius: 5,
                    cursor: 'initial',
                    maxHeight: '95%',
                    overflowY: 'auto',
                    padding: '20px 25px 15px',
                    ...style,
                },
            }}>
                {children}
            </div>
        </ScrollbarStyled>
    )
}
export default ModalBasic