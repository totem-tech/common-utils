/*
 * a set of reusable React and state related utility functions
 */
import { BehaviorSubject, Subject } from 'rxjs'
import { query } from './polkadotHelper'
import PromisE from './PromisE'
import {
    isDefined,
    isFn,
    isSubjectLike,
    isValidNumber,
} from './utils'

const useEffect = (...args) => require('react').useEffect(...args)
const useReducer = (...args) => require('react').useReducer(...args)
const useState = (...args) => require('react').useState(...args)

/**
 * @name    copyRxSubject
 * @summary creates a new subject that automatically copies the value of the source subject.
 * 
 * @description The the changes are applied unidirectionally from the source subject to the destination subject.
 * Changes on the destination subject is NOT applied back into the source subject.
 * 
 * @param   {Object}    rxSource   RxJS source subject
 * @param   {Object}    rxCopy     (optional) RxJS copy/destination subject
 *                                 Default: `new BehaviorSubject()`
 * 
 * @returns {Object}    subjectCopy
 */
export const copyRxSubject = (rxSource, rxCopy) => {
    if (!isSubjectLike(rxSource)) return new Subject()
    if (!isSubjectLike(rxCopy)) {
        rxCopy = rxSource instanceof BehaviorSubject
            ? new BehaviorSubject(rxSource.value)
            : new Subject()
    }

    const subscribe = rxCopy.subscribe
    rxCopy.subscribe = (...args) => {
        const sourceSub = rxSource.subscribe(value => rxCopy.next(value))
        const localSub = subscribe.apply(rxCopy, args)
        const { unsubscribe } = localSub
        localSub.unsubscribe = (...args) => {
            unsubscribe.apply(localSub, ...args)
            sourceSub.unsubscribe()
        }
        return localSub
    }
    return rxCopy
}

/**
 * @name    isMemo
 * @summary checks if x is an `Reat.memo` element type
 * @param   {*} x
 *  
 * @returns {Boolean}
 */
export const isMemo = x => x['$$typeof'] === require('react').memo('div')['$$typeof']

/**
 * @name    iUseReducer
 * @summary A sugar for React `userReducer` with added benefit of tracking of component mounted status.
 *          Prevents state update if component is not mounted.
 * 
 * @param   {Function}          reducerFn       if falsy, will use `reducer` function
 * @param   {Object|Function}   initialState    if function, a RxJS Subject will be supplied as argument 
 *                                              as an alternative to setState
 * 
 * @returns {Array}     [@state {Object}, @setState {Function}]
 */
export const iUseReducer = (reducerFn, initialState = {}, onUnmount) => {
    const [[rxSetState, iniState]] = useState(() => {
        const rxSetState = isFn(initialState) && new BehaviorSubject({})
        initialState = !rxSetState
            ? initialState
            : initialState(rxSetState)

        return [
            rxSetState,
            {
                ...initialState,
                ...rxSetState && rxSetState.value || {},
            }
        ]
    })
    const [state, setStateOrg] = useReducer(
        isFn(reducerFn)
            ? reducerFn
            : reducer,
        iniState,
    )
    // ignores state update if component is unmounted
    const [setState] = useState(() =>
        (...args) => setStateOrg.mounted && setStateOrg(...args)
    )

    useEffect(() => {
        setStateOrg.mounted = true
        const subscription = rxSetState && rxSetState.subscribe(setState)

        return () => {
            setStateOrg.mounted = false
            isFn(onUnmount) && onUnmount()
            subscription && subscription.unsubscribe()
        }
    }, [setStateOrg, rxSetState])

    return [state, setState]
}

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
    const PropTypes = require('prop-types')
    propsTypes[recursiveKey] = PropTypes.arrayOf(Type)
    function Type(...args) {
        return PropTypes.shape(propsTypes).apply(null, args)
    }
    return Type
}

/**
 * @name    reducer
 * @summary simple reducer to mimic Class component setState behavior
 * 
 * @param   {Object}    state 
 * @param   {Object}    newValue 
 * 
 * @returns {Object}
 */
export const reducer = (state = {}, newValue = {}) => ({ ...state, ...newValue })

/**
 * @name    subjectAsPromise
 * @summary sugar for RxJS subject as promise and, optionally, wait until an expected value is received
 * 
 * @param   {Subject}           subject         RxJS subject or similar subscribable
 * @param   {*|Function}        expectedValue   (optional) if undefined, will resolve as soon as any value is received
 * @param   {Number|Function}   timeout         (optional) will reject if no value received within given time
 * 
 * @returns {[Promise, Function]}   will reject with: 
 *                                  - `null` if times out
 *                                  - `undefined` if @subject is not a valid RxJS subject like subscribable
 */
export const subjectAsPromise = (subject, expectedValue, timeout) => {
    if (!isSubjectLike(subject)) return

    let subscription, timeoutId
    const unsubscribe = () => setTimeout(() => {
        subscription.unsubscribe()
        clearTimeout(timeoutId)
    }, 50)
    const promise = new PromisE((resolve, reject) => {
        subscription = subject.subscribe(value => {
            const isExpectedValue = isFn(expectedValue)
                ? expectedValue(value) === value
                : isDefined(expectedValue)
                    ? value === expectedValue
                    : true
            if (!isExpectedValue) return
            unsubscribe()
            resolve(value)
        })
        timeoutId = isValidNumber(timeout) && setTimeout(() => {
            unsubscribe()
            reject(null)
        }, timeout)

    })
    return [promise, unsubscribe]
}

/**
 * @name    unsubscribe
 * @summary unsubscribe to multiple RxJS subscriptions
 * @param   {Object|Array} subscriptions 
 */
export const unsubscribe = (subscriptions = {}) => Object.values(subscriptions)
    .forEach(x => {
        try {
            if (!x) return
            const fn = isFn(x)
                ? x
                : isFn(x.unsubscribe)
                    ? x.unsubscribe
                    : null
            fn && fn()
        } catch (e) { } // ignore
    })

/**
 * @name        usePromise
 * @summary     a custom React hook for use with a Promise
 * @description state update will occur only once when then @promise is either rejected or resolved.
 *              
 * 
 * @param   {Promise|Function}  promise
 * @param   {Function}          resultModifier 
 * @param   {Function}          errorModifier 
 * 
 * @returns {Array} [
 *                      0. @result : anyting the promise resolves with
 *                      1. @error  : anything the promise rejects with
 *                  ]
 * 
 * @example
 * ```javascript
 * const [result, error] = usePromise(Promise.resolve(1))
 * ```
 */
export const usePromise = (promise, resultModifier, errorModifier) => {
    const [state, setState] = useState({})

    useState(() => {
        let mounted = true
        const handler = (key, modifier, setState) => value => {
            if (!mounted) return
            const newState = {}
            newState[key] = isFn(modifier)
                ? modifier(value)
                : value
            setState(newState)
        }
        new PromisE(promise)
            .then(handler('result', resultModifier, setState))
            .catch(handler('error', errorModifier, setState))
        return () => mounted = false
    }, [setState, promise])

    return [state.result, state.error]
}

/**
 * @name    useQueryBlockchain
 * @summary a React Hook to query (and optionally subscribe) blockchain storage
 * 
 * @param   {Object|Promise}    connection
 * @param   {Object}            connection.api  ApiPromise 
 * @param   {String|Function}   func
 * @param   {Array|*}           args    (optional)
 * @param   {Boolean}           multi   (optional)
 * @param   {Function}          resultModifier (optional)
 * @param   {Boolean}           subscribe (optional)
 * @param   {Boolean}           print   (optional)
 * 
 * @returns {Object} { message, result, unsubscribe }
 */
export const useQueryBlockchain = (connection, func, args = [], multi, resultModifier, subscribe = true, print) => {
    const [data, setData] = useState({
        message: {
            content: 'Loading...',
            icon: true,
            status: 'loading',
        }
    })

    useEffect(() => {
        let mounted = true
        let unsubscribed = false
        let unsubscribe
        const callback = args.slice(-1)
        const handleConnection = async ({ api }) => {
            unsubscribed = false
            const result = await query(
                api,
                func,
                args,
                multi,
                print,
            )
            // once-off query
            if (!isFn(result)) return handleResult(result)

            // subscription
            unsubscribe = result
        }
        const handleError = err => setData({
            message: err && {
                content: `${err}`,
                icon: true,
                status: 'error',
            }
        })
        const handleResult = (resultSanitised, resultOriginal) => {
            setData({
                message: null,
                result: isFn(resultModifier)
                    ? resultModifier(resultSanitised)
                    : resultSanitised,
                unsubscribe: handleUnsubscribe,
            })
            isFn(callback) && callback(resultSanitised, resultOriginal)
        }
        const handleUnsubscribe = () => {
            if (!isFn(unsubscribe)) return // || unsubscribed

            unsubscribed = true
            unsubscribe()
        }

        if (!isFn(callback)) {
            subscribe && args.push(handleResult)
        } else {
            // args[args.indexOf(callback)] = handleResult
        }
        func && PromisE(connection)
            .then(handleConnection)
            .catch(handleError)

        return () => {
            mounted = false
            handleUnsubscribe()
        }
    }, [func, args, multi])

    const { message, result, unsubscribe } = data || {}
    return { message, result, unsubscribe }
}

/**
 * @name    useRxSubject
 * @summary custom React hook for use with RxJS subjects
 * 
 * @param   {BehaviorSubject|Subject}   subject RxJS subject or subject like Object (with subscribe function)
 *              If not object or doesn't have subcribe function will assume subject to be a static value.
 * @param   {Boolean}   ignoreFirst whether to ignore first change. 
 *              Setting `true`, will prevent an additional state update after first load.
 * @param   {Function}  valueModifier (optional) value modifier. 
 *              If an async function is supplied, `ignoreFirst` will be assumed `false`.
 *              Args: [newValue, oldValue, rxSubject]
 * @param   {*}         initialValue (optional) initial value where appropriate
 * @
 * @param   {Boolean}   allowSubjectUpdate whether to allow update of the subject or only state.
 *              CAUTION: if true and @subject is sourced from a DataStorage instance,
 *              it may override values in the LocalStorage values.
 *              Default: false
 * 
 * @returns {Array}     [value, setvalue]
 */
export const useRxSubject = (subject, valueModifier, initialValue, allowMerge = false, allowSubjectUpdate = false) => {
    const [_subject] = useState(() =>
        isSubjectLike(subject)
            ? allowSubjectUpdate
                ? subject
                : copyRxSubject(subject)
            : new BehaviorSubject(initialValue)
    )

    const [{ firstValue, value }, _setState] = iUseReducer(reducer, () => {
        let value = _subject instanceof BehaviorSubject
            ? _subject.value
            : initialValue
        value = !isFn(valueModifier)
            ? value
            : valueModifier(
                value,
                undefined,
                _subject,
            )
        if (value === useRxSubject.IGNORE_UPDATE) {
            value = undefined
        }
        return { firstValue: value, value }
    })

    useEffect(() => {
        let ignoreFirst = !(_subject instanceof BehaviorSubject)
        const subscribed = _subject.subscribe((newValue) => {
            if (!ignoreFirst) {
                ignoreFirst = true
                if (firstValue === newValue) return
            }

            const promise = PromisE(
                !isFn(valueModifier)
                    ? newValue
                    : valueModifier(
                        newValue,
                        value,
                        _subject,
                    )
            )
            promise.then(newValue => {
                if (newValue === useRxSubject.IGNORE_UPDATE) return
                _setState({
                    value: allowMerge
                        ? { ...value, ...newValue }
                        : newValue
                })
            })
            promise.catch(err => console.log('useRxSubject => unexpected error:', err))
        })
        return () => subscribed.unsubscribe()
    }, [])

    const setValue = newValue => _subject.next(newValue)
    return [value, setValue, _subject]
}
// To prevent an update return this in valueModifier
useRxSubject.IGNORE_UPDATE = Symbol('ignore-rx-subject-update')