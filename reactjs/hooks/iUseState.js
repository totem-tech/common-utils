import { useEffect, useState } from 'react'
import { BehaviorSubject } from 'rxjs'
import { isFn } from '../../utils'
import useRxSubject from './useRxSubject'

export const iUseState = (initialState = {}, onUnmount) => {
    const [[rxState, iniState]] = useState(() => {
        const rxState = new BehaviorSubject({})
        initialState = !isFn(initialState)
            ? initialState
            : initialState(rxState)
        rxState.next(initialState)
        return [
            rxState,
            initialState
        ]
    })
    const [state, setState] = useRxSubject(
        rxState,
        null,
        iniState,
        true,
        true,
    )

    useEffect(() => {
        return () => isFn(onUnmount) && onUnmount(state)
    }, [])

    return [state, setState, rxState]
}
export default iUseState