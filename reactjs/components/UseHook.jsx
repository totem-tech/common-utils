import React from 'react'
import { isArr, isFn } from '../../utils'

/**
 * @name    UseHook
 * @summary a component that simply invokes one or more React hooks to produce a result for displaying
 * 
 * @param   {Array}     props.args      (optional) arguments for a single hook
 * @param   {Function}  props.hook      (optional) single hook
 * @param   {Array<{args: Array, hook: Function}>} props.hooks (optional) to invoke multiple hooks.
 *                                      If `hooks` is provided, `hook` & `args` will be ignored.
 * @param   {Function}  props.render    (optional) callback to produce a view from the results from the hooks.
 *                                      If not provided, the array of results will be directly placed on the DOM.
 *                                      Arguments: `Array`
 * 
 * @returns {Array<{args: Array, hook: Function}>}
 * @example `javascript
 * const hooks = [
 *     [useIsMobile], // hook doesn't require any arguments
 *     [useInverted, true], // 2nd and onwards items will be passed on to the hook as arguments
 *     [useRxSubject, rxSidebarState, ({visible}) => visible], // pass on as many arguments as needed
 *     ['Not a hook'], // if first item isn't a function, it will be available as a result as provided.
 * ]
 * const render = ([
 *     isMobile,
 *     lightMode,
 *     [sidebarVisible],
 *     str
 * ]) => (
 *     <ul>
 *         <li>Layout: {isMobile ? 'mobile': 'desktop'}</li>
 *         <li>Dark mode: {lightMode ? 'no' : 'yes' }</li>
 *         <li>Sidebar: {sidebarVisible ? 'visible': 'hidden'}</li>
 *         <li>The string: {str}</li>
 *     </ul>
 * )
 * 
 * const element = <UseHook {...{ hooks, render }} />
 * 
 * // single hook
 * const hook = useIsMobile
 * const args = [] // no arguments needed
 * const render = isMobile => `Layout: ${isMobile ? 'mobile' : 'desktop'}`
 * const element = <UseHook {...{ args, hook, render }} />
 * `
 */
export const UseHook = React.memo((props) => {
    const {
        args,
        hook,
        hooks,
        render
    } = props
    const executeHook = ([hook, ...args] = []) => isFn(hook)
        ? hook(...args)
        : hook
    const result = isArr(hooks)
        ? hooks.map(executeHook)
        : executeHook([hook, ...args || []])

    return !isFn(render)
        ? result
        : render(result)
})
export default UseHook