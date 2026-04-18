import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Users, X } from 'lucide-react'
import { CLUBS, CLUBS_SOURCE_URL, type ClubTagTone } from '../data/clubs'
import { sectionTitleCls, widgetGoldCls } from '../lib/sidePanelStyles'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const BADGE_TONE_CLASS: Record<ClubTagTone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-300 border-red-500/30',
  gold: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/35',
}

export default function ClubsModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('')

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

  const normalizedQuery = query.trim().toLowerCase()
  const visibleClubs = useMemo(() => {
    if (!normalizedQuery) return CLUBS
    return CLUBS.filter((club) => {
      return (
        club.name.toLowerCase().includes(normalizedQuery) ||
        club.tag.toLowerCase().includes(normalizedQuery) ||
        club.department.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery])

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
                <a
                  href={CLUBS_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-[#D4AF37]/45 hover:text-[#D4AF37]"
                >
                  Oficjalna lista WZiKS
                </a>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
                {visibleClubs.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-black/60 p-6 text-sm text-zinc-400">
                    Brak wyników dla podanej frazy.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visibleClubs.map((club, idx) => (
                      <motion.article
                        key={club.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.18) }}
                        className="group rounded-xl border border-zinc-800 bg-black/70 p-4 transition-all duration-200 hover:border-[#D4AF37]/45 hover:shadow-[0_0_26px_-14px_rgba(212,175,55,0.55)]"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold leading-snug text-zinc-100">{club.name}</h3>
                          <span
                            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE_TONE_CLASS[club.tone]}`}
                          >
                            {club.tag}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{club.department}</p>
                      </motion.article>
                    ))}
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
