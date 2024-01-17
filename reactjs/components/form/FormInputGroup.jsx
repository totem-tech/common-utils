import React from 'react'
import { className, isPositiveInteger } from '../../../utils'
import Grid from '../Grid'

const FormInputGroup = props => {
    let {
        components: {
            Container = 'div',
            FormInput,
        } = {},
        containerProps = {},
        columns = 1,
        hidden,
        inputs = [],
        style,
    } = props
    const children = inputs?.map?.(x => <FormInput {...x} />)
    if (!children?.length || hidden) return ''

    columns = isPositiveInteger(columns)
        ? columns
        : columns === true && children?.length || 1

    return (
        <Grid {...{
            ...containerProps,
            children,
            className: className([
                'FormInput-Container',
                'FormInputGroup',
                containerProps?.className,
            ]),
            columns,
            Component: Container,
            style,
        }} />
    )
}

export default React.memo(FormInputGroup)