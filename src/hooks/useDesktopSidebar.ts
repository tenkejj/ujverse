import { useCallback, useState } from 'react'

const STORAGE_KEY = 'uj-desktop-sidebar-open'

function readOpen(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Desktopowy sidebar jest nakładką, nie kolumną układu.
 * Domyślnie schowany — treść i logo siedzą na środku okna.
 * Wybór zostaje w localStorage.
 */
export function useDesktopSidebar() {
  const [open, setOpen] = useState(readOpen)

  const setStored = useCallback((next: boolean) => {
    setOpen(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* tryb prywatny / pełny dysk */
    }
  }, [])

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* tryb prywatny / pełny dysk */
      }
      return next
    })
  }, [])

  const close = useCallback(() => setStored(false), [setStored])

  return { open, toggle, close }
}
