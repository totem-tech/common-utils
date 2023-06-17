import PropTypes from 'prop-types'
import { useMemo } from 'react'
import isMemo from '../isMemo'

const components = new Map()
export const Memo = ({ M, ...props }) => {
    Memo = useMemo(() => {
        if (isMemo(M)) return M

        return components.set(M, React.memo(M))
    }, [M])

    return <Memo {...props} />
}
Memo.propTypes = {
    M: PropTypes.elementType,
    // Rest of the props will be passed on to the component
}
export default Memo

