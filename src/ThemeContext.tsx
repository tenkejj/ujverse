import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark' | 'uj'

const THEME_ORDER: readonly Theme[] = ['light', 'dark', 'uj'] as const

type ThemeContextValue = {
  theme: Theme
  /** Cycles through themes: light → dark → uj → light. */
  toggleTheme: () => void
  /** Sets a specific theme. */
  setTheme: (next: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
})

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark' || v === 'uj'
}

/**
 * Synchronizuje klasy `dark` / `uj` na <html> z aktualnym motywem.
 * Wywoływane z efektu i z `setThemeWithTransition`, żeby DOM był spójny
 * jeszcze zanim React zaktualizuje stan w `flushSync`.
 */
function applyThemeClasses(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'uj')
  if (theme === 'dark') root.classList.add('dark')
  else if (theme === 'uj') root.classList.add('uj')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('uj-theme')
    if (isTheme(stored)) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    applyThemeClasses(theme)
    localStorage.setItem('uj-theme', theme)
  }, [theme])

  const setThemeWithTransition = (next: Theme) => {
    if (next === theme) return

    const update = () => {
      setThemeState(next)
      applyThemeClasses(next)
    }

    if (!document.startViewTransition) {
      update()
      return
    }

    document.startViewTransition(() => {
      flushSync(() => {
        update()
      })
    })
  }

  const toggleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    setThemeWithTransition(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeWithTransition }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export type { Theme }
