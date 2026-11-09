/**
 * Lokalny podgląd empty state Versusia (propozycja A) bez auth / Supabase.
 * Otwórz: http://127.0.0.1:5173/versus-empty-preview.html
 */

import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext'
import VersusEmptyStart from './components/chat/VersusEmptyStart'
import './index.css'

function PreviewShell() {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  return (
    <div className="flex min-h-dvh flex-col bg-bg-app">
      <header className="shrink-0 border-b border-white/10 bg-bg-app/90 px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="text-sm font-semibold tracking-tight text-fg-primary">
            VERSUŚ
            <span className="ml-2 text-[11px] font-normal text-fg-secondary">
              podgląd empty state · propozycja A
            </span>
          </div>
        </div>
      </header>
      <VersusEmptyStart
        draft={draft}
        onDraftChange={setDraft}
        onSend={(content) => {
          window.alert(`Wysłałoby: ${content}`)
          setDraft('')
        }}
        isTyping={false}
        inputRef={inputRef}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PreviewShell />
    </ThemeProvider>
  </StrictMode>,
)
