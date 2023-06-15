import { MOBILE, rxLayout } from '../../window'
import useRxSubject from './useRxSubject'

const useIsMobile = () => useRxSubject(rxLayout, l => l === MOBILE)

export default useIsMobile