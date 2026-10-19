import { useEffect, useState } from 'react'

/**
 * iOS Safari: przy scrollu chrome (URL bar) się zwija i `visualViewport.offsetTop`
 * staje się > 0. Elementy `position: fixed; top: 0` zostają przy layout viewport,
 * więc między Dynamic Island a belką pojawia się „dziura" z feedem.
 * Zwracany offset aplikujemy jako `translateY` na fixed header / logo.
 * Na desktop (`lg+`) zawsze 0 — `transform` psujełoby `sticky`.
 */
export function useVisualViewportOffset(): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    const mq = window.matchMedia('(max-width: 1023px)')
    if (!vv) return

    const sync = () => {
      setOffset(mq.matches ? vv.offsetTop : 0)
    }
    sync()
    vv.addEventListener('scroll', sync)
    vv.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, { passive: true })
    mq.addEventListener('change', sync)
    return () => {
      vv.removeEventListener('scroll', sync)
      vv.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync)
      mq.removeEventListener('change', sync)
    }
  }, [])

  return offset
}
