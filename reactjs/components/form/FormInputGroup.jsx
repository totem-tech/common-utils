import React from 'react'
import { className, isValidNumber } from '../../../utils'
import Grid from '../Grid'

const FormInputGroup = props => {
    let {
        components: {
            Container = 'div',
            FormInput,
        } = {},
        containerProps = {},
        columns = true,
        hidden,
        inputs = [],
    } = props
    const children = inputs?.map?.(x => <FormInput {...x} />)
    if (!children?.length || hidden) return ''

    columns = isValidNumber(columns) && columns > 0
        ? columns
        : columns === true && children?.length || 0

    return (
        <Grid {...{
            ...containerProps,
            children,
            className: className([
                'FormInput-Container',
                'FormInputGroup',
                containerProps?.className,
            ]),
            columns: 2,
            Component: Container,
        }} />
    )
}

export default React.memo(FormInputGroup)