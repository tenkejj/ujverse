import { Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '../lib/appToast'
import {
  sectionTitleCls,
  sideMutedCls,
  sidePanelHoverFocus,
  widgetGoldCls,
} from '../lib/sidePanelStyles'
import { useClubs } from '../hooks/useContent'
import type { ClubMeta, UnifiedContent } from '../types/content'
import BaseCard from './ui/BaseCard'

/**
 * StudentClubsWidget — boczny widget z trzema kołami naukowymi.
 *
 * Dane pobierane wyłącznie przez `useClubs()` (czyli `DataService.listClubs()`).
 * Dzięki temu lista jest spójna z `ClubsModal` — brak duplikacji źródeł.
 */
export default function StudentClubsWidget() {
  const { clubs } = useClubs()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<UnifiedContent<ClubMeta> | null>(null)
  const [proposedClubName, setProposedClubName] = useState('')
  const [proposedClubDescription, setProposedClubDescription] = useState('')

  // Link do oficjalnego źródła pobieramy z actions pierwszego klubu (spójne z adapterem).
  const sourceHref = clubs[0]?.actions[0]?.href ?? 'https://wzks.uj.edu.pl/studenci/kola-naukowe'

  useEffect(() => {
    if (!isCreateModalOpen && !selectedClub) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCreateModalOpen(false)
        setSelectedClub(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCreateModalOpen, selectedClub])

  const handleCreateSubmit = () => {
    setIsCreateModalOpen(false)
    setProposedClubName('')
    setProposedClubDescription('')
    toast.success(
      'Zgłoszenie zostało wysłane do administratora wydziału. Powiadomimy Cię o statusie weryfikacji!',
    )
  }

  return (
    <>
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
            <span className={sectionTitleCls}>KOŁA NAUKOWE</span>
          </div>
        </div>

        <div className="space-y-3">
          {clubs.slice(0, 3).map((club) => (
            <button
              type="button"
              key={club.id}
              onClick={() => setSelectedClub(club)}
              className={`group w-full flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 transition-colors dark:border-zinc-800 dark:bg-zinc-950 ${sidePanelHoverFocus}`}
            >
              <div className="min-w-0 flex-1">
                <p className="min-w-0 truncate text-left text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                  {club.title}
                </p>
                <p className={`mt-0.5 text-left text-xs ${sideMutedCls}`}>
                  {club.metadata.department}
                  <span className="ml-1 text-zinc-500 dark:text-zinc-500">
                    {club.metadata.tag}
                  </span>
                </p>
              </div>
            </button>
          ))}
        </div>

        <a
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Zobacz wszystkie
        </a>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className={`group mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center text-sm font-medium text-zinc-900 transition-colors dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 ${sidePanelHoverFocus} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/35`}
        >
          <span className="inline-flex items-center justify-center gap-1.5">
            <span aria-hidden>+</span>
            <span>Załóż własne koło</span>
          </span>
        </button>
      </section>

      {isCreateModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) setIsCreateModalOpen(false)
            }}
          >
            <BaseCard
              variant="inner"
              className="w-full max-w-lg border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-black/40 p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold tracking-wide text-brand-gold [text-shadow:0_0_10px_rgba(201,162,39,0.25)]">
                    Proces zakładania koła
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Informacje bazowe na podstawie danych WZiKS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-1.5 text-zinc-600 dark:text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label="Zamknij modal"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed">
                Proces zakładania koła: 1. Weryfikacja pomysłu, 2. Znalezienie opiekuna,
                3. Zatwierdzenie przez Dziekanat.
              </p>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  Nazwa proponowanego koła
                </span>
                <input
                  type="text"
                  value={proposedClubName}
                  onChange={(event) => setProposedClubName(event.target.value)}
                  placeholder="Np. Koło Naukowe Analizy Komunikacji"
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-black/40 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/35"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  Krótki opis działalności
                </span>
                <textarea
                  value={proposedClubDescription}
                  onChange={(event) => setProposedClubDescription(event.target.value)}
                  rows={4}
                  placeholder="Opisz, czym zajmie się koło i jakie ma cele."
                  className="w-full resize-y rounded-xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-black/40 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/35"
                />
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-300 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Zobacz listę kół WZiKS
                </a>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all hover:bg-zinc-100 dark:hover:bg-white/10"
                  >
                    Zamknij
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSubmit}
                    className="rounded-xl border border-brand-gold/45 bg-brand-gold/80 px-3 py-2 text-xs font-bold text-[#1f1503] shadow-2xl transition-all hover:bg-brand-gold"
                  >
                    Prześlij zgłoszenie do weryfikacji
                  </button>
                </div>
              </div>
            </BaseCard>
          </div>,
          document.body,
        )}

      {selectedClub &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) setSelectedClub(null)
            }}
          >
            <BaseCard
              variant="inner"
              className="w-full max-w-md border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-black/40 p-5 shadow-2xl"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold tracking-wide text-brand-gold [text-shadow:0_0_10px_rgba(201,162,39,0.25)]">
                    {selectedClub.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {selectedClub.metadata.department}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClub(null)}
                  className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-1.5 text-zinc-600 dark:text-zinc-400 transition-all hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label="Zamknij modal koła"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed">
                To koło jest już zarejestrowane. Chcesz dołączyć?
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedClub(null)}
                  className="rounded-xl border border-brand-gold/45 bg-brand-gold/80 px-3 py-2 text-xs font-bold text-[#1f1503] shadow-2xl transition-all hover:bg-brand-gold"
                >
                  Skontaktuj się z liderem
                </button>
              </div>
            </BaseCard>
          </div>,
          document.body,
        )}
    </>
  )
}
