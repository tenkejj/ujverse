import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Users, X } from 'lucide-react'
import { sectionTitleCls, widgetGoldCls } from '../lib/sidePanelStyles'
import { toneClasses } from '../styles/theme'
import type { ClubMeta, UnifiedContent } from '../types/content'
import BaseCard from './ui/BaseCard'

type Props = {
  isOpen: boolean
  onClose: () => void
  clubs: UnifiedContent<ClubMeta>[]
  loading: boolean
  error: string | null
  onRetry: () => void
  /** Opcjonalny link zewnętrzny (np. oficjalna lista). Gdy brak — szukany w `actions[0]`. */
  sourceHref?: string
}

export default function ClubsModal({
  isOpen,
  onClose,
  clubs,
  loading,
  error,
  onRetry,
  sourceHref,
}: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 160)
    return () => window.clearTimeout(t)
  }, [query])

  const normalizedQuery = debouncedQuery.trim().toLowerCase()
  const visibleClubs = useMemo(() => {
    if (!normalizedQuery) return clubs
    return clubs.filter((club) => {
      return (
        club.title.toLowerCase().includes(normalizedQuery) ||
        club.metadata.tag.toLowerCase().includes(normalizedQuery) ||
        club.metadata.department.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, clubs])

  const resolvedSourceHref = sourceHref ?? clubs[0]?.actions[0]?.href

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Koła naukowe"
          className="fixed inset-0 z-[210] bg-black/95 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={onClose}
        >
          <motion.div
            className="mx-auto flex h-full w-full max-w-6xl flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/70 text-zinc-400 transition-colors hover:border-brand-gold/45 hover:text-brand-gold-bright"
              aria-label="Zamknij koła naukowe"
            >
              <X size={20} strokeWidth={2.1} />
            </button>

            <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col pt-16">
              <div className="mb-5 flex shrink-0 items-center gap-2">
                <Users size={14} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
                <span className={`${sectionTitleCls} text-[#D4AF37]`}>Koła Naukowe</span>
              </div>

              <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
                <div className="relative min-w-0 flex-1 rounded-2xl">
                  <Search
                    size={18}
                    strokeWidth={2}
                    className="pointer-events-none absolute left-3.5 top-1/2 z-[2] -translate-y-1/2 text-[#D4AF37]"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj koła po nazwie, tagu lub wydziale..."
                    className="ujverse-search-input relative z-[1] h-12 w-full rounded-2xl border border-zinc-800 bg-black/60 pl-11 pr-3 text-[15px] text-zinc-100 shadow-none outline-none ring-0 transition-[border-color] duration-300 placeholder:text-zinc-500 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/20 caret-[#D4AF37]"
                  />
                </div>
                {resolvedSourceHref && (
                  <a
                    href={resolvedSourceHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-[#D4AF37]/45 hover:text-[#D4AF37]"
                  >
                    Oficjalna lista WZiKS
                  </a>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
                {loading ? (
                  <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-black/60 p-6 text-sm text-zinc-400">
                    Ładowanie kół naukowych...
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-300">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 inline-flex rounded-lg border border-zinc-800 bg-black/70 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#D4AF37]/45 hover:text-[#D4AF37]"
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                ) : visibleClubs.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-black/60 p-6 text-sm text-zinc-400">
                    Nie znaleziono kół.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visibleClubs.map((club, idx) => {
                      const badge = club.badges?.[0]
                      return (
                        <motion.div
                          key={club.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.18) }}
                        >
                          <BaseCard as="article" variant="default" interactive className="group">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <h3 className="text-base font-semibold leading-snug text-zinc-100">
                                {club.title}
                              </h3>
                              {badge && (
                                <span
                                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[badge.tone]}`}
                                >
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400">{club.metadata.department}</p>
                          </BaseCard>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
