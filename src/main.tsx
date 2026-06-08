import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Toaster } from './lib/appToast'
import App from './App.tsx'
import { ThemeProvider } from './ThemeContext.tsx'
import {
  applyVisualPreferences,
  getUserPreferences,
  subscribePreferences,
} from './lib/userPreferences.ts'
import './index.css'

// Aplikuj kliencko-zapamiętane preferencje (gęstość UI, redukcja animacji)
// zanim React zamontuje drzewo, żeby uniknąć FOUC po przeładowaniu.
applyVisualPreferences()

/**
 * Most między `userPreferences` a framer-motion. CSS reguły z `index.css`
 * (`html[data-reduced-motion]`) wyłączają tylko CSS animations/transitions;
 * framer-motion gra przez Web Animations API i CSS go nie dotyczy. `MotionConfig`
 * z `reducedMotion="always"` mówi framerowi: pomiń cały movement.
 *
 * Tryb `"user"` (gdy toggle jest off) respektuje wciąż OS-level
 * `prefers-reduced-motion: reduce` — czyli a11y w systemie nie zostaje złamana.
 */
function MotionPrefsBridge({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState<boolean>(() => getUserPreferences().reducedMotion)
  useEffect(
    () => subscribePreferences((p) => setReduced(p.reducedMotion)),
    [],
  )
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      {children}
    </MotionConfig>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <MotionPrefsBridge>
          <App />
        </MotionPrefsBridge>
        <Toaster
          position="bottom-right"
          gutter={10}
          toastOptions={{
            duration: 3500,
            className: 'ujverse-toast',
            style: {
              borderRadius: '1rem',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              maxWidth: 'min(90vw, 360px)',
            },
            success: {
              iconTheme: { primary: '#c9a227', secondary: 'rgb(255 255 255 / 0.08)' },
            },
            error: {
              iconTheme: { primary: 'rgb(148 163 184)', secondary: 'rgb(255 255 255 / 0.06)' },
            },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

/**
 * Schowaj splash z `index.html` po pierwszym paint React.
 * Splash istnieje, żeby na mobile/produkcji nie było białej dziury między
 * HTML a załadowaniem JS-bundla (klasa `app-ready` triggeruje fade-out;
 * po `transitionend` element jest usuwany z DOM, żeby nie blokował kliknięć).
 */
requestAnimationFrame(() => {
  document.body.classList.add('app-ready')
  const splash = document.getElementById('ujverse-splash')
  if (!splash) return
  const cleanup = () => splash.remove()
  splash.addEventListener('transitionend', cleanup, { once: true })
  // Fallback gdy `transitionend` nie odpali (reduced motion / brak transition).
  window.setTimeout(cleanup, 600)
})