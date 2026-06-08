import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'

/**
 * SearchModal — pełnoekranowy overlay wyszukiwania (mobile-first).
 *
 * Spec z taska:
 *  - `fixed inset-0 z-50 bg-black`
 *  - `autoFocus` na inpucie
 *  - Esc zamyka modal
 *
 * Dodatki (UX):
 *  - X w prawym górnym rogu (mobile users oczekują widocznego close)
 *  - body scroll-lock przy otwarciu (spójnie z notif panelem w Header)
 *  - safe-area-top dla iOS notch
 *  - submit (Enter / przycisk) wywołuje `onSubmit(query)` i zamyka modal —
 *    konsument decyduje co dalej (np. nawigacja do `/search?q=…`).
 *
 * Header (z=50) jest renderowany przed modalem w DOM, więc modal wygrywa
 * tie na z-index dzięki kolejności DOM. Brak potrzeby portalu.
 */

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Zwracane query po `Enter` / kliknięciu submitu. Modal sam się zamknie. */
  onSubmit?: (query: string) => void
  /**
   * CTA „Otwórz pełną wyszukiwarkę →" — analogicznie do `Otwórz pełny czat`
   * w `ChatAssistant`. Jeśli podane, w body modala pojawia się przycisk
   * prowadzący do `/search` (dashboard) niezależnie od `query`. Modal sam
   * się zamknie po kliknięciu.
   */
  onOpenHub?: () => void
  initialQuery?: string
  placeholder?: string
}

export default function SearchModal({
  isOpen,
  onClose,
  onSubmit,
  onOpenHub,
  initialQuery = '',
  placeholder = 'Szukaj na UJverse...',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    if (isOpen) setQuery(initialQuery)
  }, [isOpen, initialQuery])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    onSubmit?.(trimmed)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wyszukiwarka"
      className="fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)]"
    >
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
      >
        <Search
          size={20}
          strokeWidth={2}
          className="shrink-0 text-white/60"
          aria-hidden
        />
        <input
          ref={inputRef}
          autoFocus
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Wpisz frazę wyszukiwania"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-white placeholder-white/40 outline-none caret-brand-gold-bright"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij wyszukiwarkę"
          className="shrink-0 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <X size={22} strokeWidth={2} />
        </button>
      </form>

      <div className="flex-1 overflow-y-auto px-4 py-6 text-white/60">
        {onOpenHub && (
          <button
            type="button"
            onClick={() => {
              onOpenHub()
              onClose()
            }}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-brand-gold-bright/40 bg-brand-gold-bright/10 px-3.5 py-1.5 text-xs font-semibold text-brand-gold-bright transition-colors hover:border-brand-gold-bright/60 hover:bg-brand-gold-bright/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-bright/40"
            aria-label="Otwórz pełną wyszukiwarkę"
          >
            Otwórz pełną wyszukiwarkę
            <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
          </button>
        )}
        {query.trim().length === 0 ? (
          <p className="text-sm">
            Zacznij pisać, żeby wyszukać posty, użytkowników, wydarzenia i więcej.
          </p>
        ) : (
          <p className="text-sm">
            Naciśnij <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-xs">Enter</kbd>,
            żeby przejść do wyników dla „<span className="text-white">{query.trim()}</span>".
          </p>
        )}
      </div>
    </div>
  )
}
