import { MOBILE, rxLayout } from '../../window'
import useRxSubject from './useRxSubject'

export const useIsMobile = () => useRxSubject(rxLayout, l => l === MOBILE)[0]

export default useIsMobile