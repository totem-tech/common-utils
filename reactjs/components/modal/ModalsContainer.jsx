import PropTypes from 'prop-types'
import React, { isValidElement } from 'react'
import { BehaviorSubject } from 'rxjs'
import { className } from '../../../utils'
import { useRxSubject } from '../../hooks'
import toProps from '../../toProps'
import ModalBuilder from './ModalBuilder'

export function ModalsContainer(props) {
    let {
        components: {
            Container = 'div',
            Modal = ModalBuilder,
        },
        containerProps,
        // common/default props supplied to each modal
        modalProps,
        modals,
    } = { // merge 
        ...defaults,
        ...props,
        components: {
            ...defaults.components,
            ...props.components,
        },
        modalProps: {
            ...defaults.modalProps,
            ...props.modalProps,
        }
    }
    const [modalsArr] = useRxSubject(
        modals,
        (x = new Map()) => Array.from(x),
    )
    return (
        <Container {...{
            ...defaults.containerProps,
            ...containerProps,
            className: className([
                'modals-container',
                defaults.containerProps?.className,
                containerProps?.className,
            ]),
        }}>
            {modalsArr.map(([id, modalOrProps]) => {
                // element supplied > pass on as is
                if (isValidElement(modalOrProps)) return (
                    <div{...{ id, key: id }}>
                        {modalOrProps}
                    </div>
                )

                // object supplied > use the Modal component
                let iProps = toProps(modalOrProps)
                iProps = {
                    ...modalProps,
                    ...iProps,
                    components: {
                        ...modalProps?.components,
                        ...iProps.components,
                    },
                }
                iProps.ignore = [
                    ...Modal?.defaultProps?.ignore || [],
                    ...iProps.ignore || [],
                ]
                return (
                    <div {...{ id, key: id }}>
                        <Modal {...iProps} />
                    </div>
                )
            })}
        </Container>
    )
}
const defaults = {
    components: {
        Container: 'div',
        // without proper element (or style) modal will not work as expected
        Modal: ModalBuilder,
    },
    containerProps: {},
    modalProps: {},
    modals: undefined,
}
ModalsContainer.defaultProps = defaults
ModalsContainer.propTypes = {
    components: PropTypes.shape({
        Container: PropTypes.elementType,
        Modal: PropTypes.elementType,
    }),
    // Container component props
    containerProps: PropTypes.object,
    // common props for each Modal element
    modalProps: PropTypes.object,
    modals: PropTypes.oneOfType([
        PropTypes.instanceOf(BehaviorSubject),
        PropTypes.instanceOf(Map),
    ]).isRequired,
}
export default ModalsContainer