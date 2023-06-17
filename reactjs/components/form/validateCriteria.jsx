import React, { isValidElement } from 'react'
import {
    isArr,
    isFn,
    isObj,
    isStr,
} from '../../../utils'
import {
    statusColors,
    statusIcons,
    statuses,
} from '../Message'

/**
 * @name    validateCriteria
 * @summary validate input value against a list of criteria.
 * Generate a message showing whether individual critera is valid or not
 * 
 * @param   {*}                     value                           input value
 * @param   {Object}                conf                            input props/validation configuration
 * @param   {Function|Object}       conf.components.CriteriaItem    (optional) criteria item component
 * @param   {Function|Object}       conf.components.CriteriaList    (optional) criteria list container component
 * @param   {Function|Object}       conf.components.Icon            (optional) icon component
 * @param   {Array}                 conf.criteria                   list of criteria
 * @param   {String|Element|Object} conf.criteria[].content         (optional) regular expression to test the criteria
 * Set criteria[i].style.verticalAlign = 'top' for multiline text
 * @param   {String|Element|Object} conf.criteria[].iconInvalid     (optional) criteria invalid icon 
 * @param   {String|Element|Object} conf.criteria[].iconInvalid     (optional) criteria valid icon
 * @param   {Bool}                  conf.criteria[].persist         (optional) if falsy, hides criteria element from 
 * message when value is valid against the criteria.
 * @param   {String|Element|Object} conf.criteria[].regex           (option) regular expression to test the criteria
 * @param   {String|Element|Object} conf.criteria[].validate        (option) use a function for custom validation.
 *                                                                  Either regex or plain function required.
 *                                                                  Function arguments: value.
 *                                                                  Function should return one of the following:
 *                                                                  - Boolean|String|Element (truthy = value is invalid)
 *                                                                  - Object with following properties:
 *                                                                      - content: String|Element
 *                                                                      - icon: String|Object|Element
 *                                                                      - status (optional): String (Default: "error")
 *                                                                      - style (optional): Object
 * @param   {*}                     conf.criteriaFooter             (optional) message footer
 * @param   {*}                     conf.criteriaHeader             (optional) message header
 * @param   {String|Element|Object} conf.criteriaIconInvalid        (optional) default value for `iconInvalid` 
 * @param   {String|Element|Object} conf.criteriaIconInvalid        (optional) default value for  `iconValid`
 * @param   {Boolean}               conf.criteriaPersist            (optional) default value for `criteria[0].persist`
 *                                                                  Default: `true`
 * 
 * @returns {Array} ```javascript
 * [
 *  message,        // object: criteria message
 *  invalid,        // boolean: whether one or more criteria is invalid
 *  criteriaItems,  // array: criteria items used to populate message
 *  numInvalid      // number: number of criteria is invalid
 * ]
 * ```
 */
export const validateCriteria = (value, conf, hasVal = true) => {
    const {
        components: {
            CriteriaItem = 'div',
            CriteriaList = 'div',
            Icon,
        } = {},
        criteria = [],
        criteriaFooter,
        criteriaHeader,
        criteriaIconInvalid: _iconInvalid = statusIcons.error,
        criteriaIconValid: _iconValid = statusIcons.success,
        criteriaPersist = true,
    } = conf
    if (!isArr(criteria) || !criteria.length) return []

    const criteriaItems = criteria.map((c, i) => {
        let {
            content,
            iconInvalid = _iconInvalid,
            iconValid = _iconValid,
            persist = criteriaPersist,
            regex,
            style = {},
            validate,
        } = c
        let icon, status
        let invalid = regex instanceof RegExp
            ? !regex.test(`${value}`)
            : isFn(validate) && validate(value)
        if (isStr(invalid) || isValidElement(content)) {
            content = invalid
        } else if (isObj(invalid)) {
            const o = invalid
            content = o.content
            icon = o.icon
            invalid = o.status === statuses.error
            status = statuses[o.status]
                ? o.status
                : statuses.error
            style = { ...style, ...o.style }
        }
        status ??= invalid
            ? statuses.error
            : statuses.success
        invalid = !!invalid
        c.valid = !invalid
        icon ??= !hasVal || invalid
            ? iconInvalid
            : status === statuses.success
                ? iconValid
                : statusIcons[status] || iconValid

        if (isStr(icon)) icon = { icon, name: icon }

        icon = !!Icon
            && !isValidElement(icon)
            && !!icon?.name
            ? <Icon {...icon} />
            : icon

        const color = !hasVal
            ? undefined
            : status === statuses.warning
                ? statusColors.warning_bg // regular warning color isn't visible 
                : statusColors[status]
        return content
            && (persist || invalid)
            && {
            color,
            icon: isValidElement(icon) && icon,
            invalid,
            style,
            content,
        }
    }).filter(Boolean)
    if (!criteriaItems.length) return [undefined, 0]

    const numInvalid = criteriaItems
        .filter(x => x.invalid)
        .length

    const getItem = (item, i) => {
        const {
            color,
            content,
            icon,
            style,
        } = item
        return (
            <CriteriaItem {...{
                content,
                icon,
                key: `${value}${i}`,
                style: {
                    color,
                    display: 'table-row',
                    marginTop: 2,
                    // set criteria[].style.verticalAlign = 'top' for multiline content
                    verticalAlign: 'middle',
                    width: '100%',
                    ...style,
                },
            }}>
                {icon && (
                    <div {...{
                        children: icon,
                        style: {
                            display: 'table-cell',
                            lineHeight: 1,
                            padding: '0 5px',
                            verticalAlign: 'inherit',
                        }
                    }} />
                )}
                <div {...{
                    children: content,
                    style: {
                        display: 'table-cell',
                        verticalAlign: 'inherit',
                    }
                }} />
            </CriteriaItem>
        )
    }
    const message = {
        content: (
            <CriteriaList>
                {criteriaItems.map(getItem)}
                {criteriaFooter}
            </CriteriaList >
        ),
        header: criteriaHeader,
        key: `${numInvalid}${value}`,
        icon: false,
        status: !hasVal
            ? statuses.info
            : !!numInvalid
                ? statuses.error
                : statuses.success,
        style: { textAlign: 'left' },
    }
    return [
        message,
        numInvalid > 0,
        criteriaItems,
        numInvalid,
    ]
}
export default validateCriteria