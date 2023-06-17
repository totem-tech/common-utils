import { useMemo } from 'react'
import { useUnmount } from './useMount'

export const useResizeObserver = (ref, callback) => {
    const observer = useMemo(() => new ResizeObserver(callback), [callback])

    useMemo(() => {
        try {
            const el = ref?.current
            // start observing
            el && observer.observe(el)
        } catch (_) {
        }
    }, [ref])

    // stop observing
    useUnmount(() => observer.disconnect())

    return ref
}
export default useResizeObserver