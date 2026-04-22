import { useEffect, useState } from 'react'
import { useScrollY } from '../../hooks/useScrollY'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

/** Wykrywanie breakpointu mobile (<md) z matchMedia. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}

/**
 * Czy inline button akcji (w hero) ma być widoczny? Na desktopie zawsze;
 * na mobile dopóki użytkownik nie przewinął poza hero.
 */
export function useShowInlineAction() {
  const scrollY = useScrollY()
  const isMobile = useIsMobile()
  return !isMobile || scrollY < PROFILE_MOBILE.fab.scrollActivateAt
}

/** Czy FAB ma być widoczny (lustro logiki `useShowInlineAction`). */
export function useShowFab() {
  const scrollY = useScrollY()
  const isMobile = useIsMobile()
  return isMobile && scrollY >= PROFILE_MOBILE.fab.scrollActivateAt
}
