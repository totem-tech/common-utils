import React from 'react'
import { isArr, isFn } from '../../utils'

/**
 * @name    UseHook
 * @summary a component that simply invokes one or more React hooks to produce a result for displaying
 * 
 * @param   {Array}     props.hooks     2D Array of React hooks/functions and relevant arguments for the hook
 * @param   {Function}  props.render    (optional) callback to produce a view from the results from the hooks.
 *                                      If not provided, the array of results will be directly placed on the DOM.
 *                                      Arguments: `Array`
 * 
 * @example `javascript
 * const hooks = [
 *     [useIsMobile], // hook doesn't require any arguments
 *     [useInverted, true], // 2nd and onwards items will be passed on to the hook as arguments
 *     [useRxSubject, rxSidebarState, ({visible}) => visible], // pass on as many arguments as needed
 * ]
 * const render = ([ isMobile, lightMode, [sidebarVisible] ]) => (
 *     <ul>
 *         <li>Layout: {isMobile ? 'mobile': 'desktop'}</li>
 *         <li>Dark mode: {lightMode ? 'no' : 'yes' }</li>
 *         <li>Sidebar: {sidebarVisible ? 'visible': 'hidden'}</li>
 *     </ul>
 * )
 * 
 * const element = <UseHook {...{ hooks, render }} />
 * `
 */
export const UseHook = React.memo(({
    args,
    hook,
    hooks,
    render
}) => {
    const executeHook = ({ args = [], hook }) => isFn(hook)
        ? hook(...args)
        : hook
    const result = isArr(hooks)
        ? hooks.map(executeHook)
        : executeHook({ args, hook })

    return !isFn(render)
        ? result
        : render(result)
})
export default UseHook