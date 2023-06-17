import React from 'react'
import PropTypes from 'prop-types'
import { isArr, objWithoutKeys } from '../../utils'

/**
 * @name    Grid
 * @summary a simple container to create CSS `display:grid`
 * 
 * @param   {*} props 
 * 
 * @returns {Element}
 * 
 * @example ```javascript
 * 
 * const rows = new Array(9)
 *  .fill(0)
 *  .map((_,i) => <div key={i}>{i}</div>})
 * const grid = <Grid children={rows} columns={3} />
 * ```
 */
export const Grid = React.memo(props => {
    const {
        children,
        columns = isArr(children) && children.length || 1,
        Component = 'div',
        style,
    } = props

    return (
        <Component {...{
            ...objWithoutKeys(props, [
                'columns',
                'Component',
            ]),
            style: {
                display: 'grid',
                gridGap: '0 5px',
                gridAutoRows: 'auto',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                ...style,
            },
        }} />
    )
})
const StringOrNumber = PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
])
Grid.defaultProps = {
    Component: 'div',
}
Grid.propTypes = {
    children: PropTypes.any,
    // number of columns per row.
    // if undefined, will use length of `children` (only when array)
    columns: PropTypes.number,
    Component: PropTypes.elementType,
    // add extra styles or override grid layout
    style: PropTypes.shape({
        // default: 'grid'
        display: PropTypes.string,
        // will override `columns` prop.
        // For details & examples: https://developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns
        gridTemplateColumns: StringOrNumber,
        // gap between cells (uses same format as padding/margin)
        gridGap: StringOrNumber,
        // Row height
        // Default: 'auto'
        // For details & examples: https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows
        gridAutoRows: StringOrNumber,
        //...
    }),
}
export default Grid