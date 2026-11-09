/**
 * Lokalny podgląd Versusia na stronie głównej (karta VersusEntry).
 * http://127.0.0.1:5173/versus-home-preview.html
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext'
import VersusEntry from './components/chat/VersusEntry'
import './index.css'

function HomeShell() {
  return (
    <div className="min-h-dvh bg-bg-app text-fg-primary">
      <header className="border-b border-white/10 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight">
            ujverse
            <span className="ml-2 text-[11px] font-normal text-fg-secondary">
              podgląd strony głównej · Versus
            </span>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-fg-secondary">
            Wszystkie wydziały
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-6">
        <VersusEntry />

        <section className="rounded-2xl border border-white/10 bg-zinc-950/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-fg-primary">
              Informacje z uczelni
            </h3>
            <span className="text-[11px] text-fg-secondary">makieta sekcji</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-fg-secondary">
            <span className="rounded-full border border-white/10 px-2.5 py-1">
              Komunikaty
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">
              Rejestracje
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">
              Kalendarz
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-10 rounded-xl border border-white/5 bg-black/25" />
            <div className="h-10 rounded-xl border border-white/5 bg-black/25" />
          </div>
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <HomeShell />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
