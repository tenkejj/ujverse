import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('uj-theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('uj-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    console.log('Theme toggle clicked');
    const newTheme = theme === 'dark' ? 'light' : 'dark';

    const updateDomAndState = () => {
      setTheme(newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    if (!document.startViewTransition) {
      updateDomAndState();
      return;
    }

    document.startViewTransition(() => {
      flushSync(() => {
        updateDomAndState();
      });
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
