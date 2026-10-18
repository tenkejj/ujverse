import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

/**
 * Motywy UJverse:
 * - `light` — kość słoniowa + granat logo
 * - `dark` — czarny + złoto
 * - `uj` — „Kolory UJ”: oficjalny błękit Pantone 2945 (#00519E) i
 *   złoto/beż Pantone 465 (#CDB590) ze SIW UJ, stonowane pod czytelność UI
 */
export type Theme = 'light' | 'dark' | 'uj'

export const THEME_ORDER: readonly Theme[] = ['light', 'uj', 'dark'] as const

export const THEME_META: Record<
  Theme,
  { label: string; shortLabel: string; hint: string }
> = {
  light: {
    label: 'Jasny',
    shortLabel: 'Jasny',
    hint: 'Kość słoniowa i granat logo.',
  },
  uj: {
    label: 'Kolory UJ',
    shortLabel: 'Kolory UJ',
    hint: 'Oficjalny błękit i złoto UJ — stonowane pod czytelność.',
  },
  dark: {
    label: 'Ciemny',
    shortLabel: 'Ciemny',
    hint: 'Czerń i złoto.',
  },
}

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Jasny ↔ ciemny (slash-komendy / stary toggle). */
  toggleTheme: () => void
  /** Jasny → Kolory UJ → Ciemny → Jasny. */
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  cycleTheme: () => {},
})

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'uj'
}

function applyThemeClass(next: Theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'theme-uj')
  if (next === 'dark') root.classList.add('dark')
  if (next === 'uj') root.classList.add('theme-uj')
}

function readInitialTheme(): Theme {
  const stored = localStorage.getItem('uj-theme')
  if (isTheme(stored)) return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme())

  useEffect(() => {
    applyThemeClass(theme)
    localStorage.setItem('uj-theme', theme)
  }, [theme])

  const commitTheme = useCallback((next: Theme) => {
    const run = () => {
      setThemeState(next)
      applyThemeClass(next)
    }

    if (!document.startViewTransition) {
      run()
      return
    }

    document.startViewTransition(() => {
      flushSync(run)
    })
  }, [])

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return
      commitTheme(next)
    },
    [commitTheme, theme],
  )

  const toggleTheme = useCallback(() => {
    commitTheme(theme === 'dark' ? 'light' : 'dark')
  }, [commitTheme, theme])

  const cycleTheme = useCallback(() => {
    const idx = THEME_ORDER.indexOf(theme)
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length] ?? 'light'
    commitTheme(next)
  }, [commitTheme, theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
