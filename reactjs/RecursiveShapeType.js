import PropTypes from 'prop-types'
/**
 * @name    RecursiveShapeType
 * @summary custom PropType for recursive shape validation
 *
 * @param   {Object}    propsTypes      property types of the shape (using PropTypes)
 * @param   {String}    recursiveKey    property that should be recursive.
 *                                      Default: 'children'
 *
 * @example
 * ```javascript
 * import PropTypes from 'prop-types'
 *
 * const ExampleComponent = (props) => { console.log({props}) }
 * ExampleComponent.propTypes = {
 *    items: PropTypes.arrayOf(RecursiveShapeType({
 *        // define shape properties here
 *        value: PropTypes.number.isRequired,
 *        // 'items' property will be automatically added
 *    }, 'items'))
 * }
 *
 * const childItems = [
 *    { value: 4 },
 *    { value: 5 },
 * ]
 * const items = [
 *   { value: 1 },
 *   { value: 2 },
 *   { value: 3, items: childItems },
 * ]
 * const el = <ExampleComponent items={items} />
 * ```
 */
export const RecursiveShapeType = (propsTypes = {}, recursiveKey = 'children') => {
    propsTypes[recursiveKey] = PropTypes.arrayOf(Type)
    function Type(...args) {
        return PropTypes
            .shape(propsTypes)
            .apply(null, args)
    }
    return Type
}

export default RecursiveShapeType