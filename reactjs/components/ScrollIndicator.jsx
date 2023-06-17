import React, {
    useCallback,
    useRef,
    useState,
} from 'react'
import { deferred } from '../../utils'
import useMutationObserver from '../hooks/useMutationObserver'

const defaultStyles = {
    root: {
        backgroundColor: '#f1f1f1',
        left: 0,
        position: 'sticky',
        top: 0,
        zIndex: 1,
        width: '100%',
    },
    progressBar: {
        height: 3,
        background: '#04AA6D',
    },
    progressContainer: {
        width: '100%',
        // height: 3,
        background: '#ccc',
    },
}

export const ScrollIndicator = React.memo(({
    children,
    Component = 'div',
    mutationConf: conf = {
        childList: true,
        subtree: true
    },
    mutationDefer = 1000,
    styles = {},
    width: defaultWidth = '0.00%',
    ...props
}) => {
    const ref = useRef()
    const [state, setState] = useState({ width: defaultWidth })
    const { width } = state
    const updateWidth = useCallback(target => {
        if (!target) return
        const {
            offsetHeight,
            scrollHeight,
            scrollTop,
        } = target
        const height = scrollHeight - offsetHeight
        const percentage = ((scrollTop / height) * 100) || 0
        const isUnscrollable = !scrollTop
            && offsetHeight === scrollHeight
        const newWidth = isUnscrollable
            ? null
            : `${percentage.toFixed(2)}%`
        const changed = width !== newWidth
            || isUnscrollable !== state.isUnscrollable
        changed && setState({
            isUnscrollable,
            width: newWidth,
        })
    })

    conf && useMutationObserver(
        ref,
        useCallback(
            deferred(
                () => updateWidth(ref?.current),
                mutationDefer,
            )
        ),
        conf,
    )

    return (
        <Component {...{
            ...props,
            ref,
            onScroll: (e, ...args) => {
                updateWidth(ref.current)
                props.onScroll?.(e, ...args)
            },
        }}>
            {width !== null && (
                <div style={{
                    ...defaultStyles.root,
                    ...styles?.root,
                }}>
                    <div style={{
                        ...defaultStyles.progressContainer,
                        ...styles?.progressContainer,
                    }}>
                        <div style={{
                            ...defaultStyles.progressBar,
                            ...styles?.progressBar,
                            width,
                        }} />
                    </div>
                </div>
            )}
            <div>{children}</div>
        </Component >
    )
})
ScrollIndicator.defaultProps = {
    styles: defaultStyles
}
export default ScrollIndicator