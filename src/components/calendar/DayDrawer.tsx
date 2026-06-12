/**
 * UJverse — DayDrawer: bottom-sheet (mobile) / sticky panel (desktop) z listą
 * wpisów dla wybranego dnia.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Wzór wizualny: `AnnouncementDrawer` (bottom-sheet z swipe handle), tylko
 * lista zamiast pojedynczego wpisu. Na desktopie (lg+) ten sam komponent
 * renderuje się jako panel obok grid'u — kontroluje to parent przez
 * `displayMode`.
 */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CalendarEntry } from '../../types/calendar'
import { sortEntriesForDay } from '../../hooks/useCalendarEntries'
import CalendarEntryCard from './CalendarEntryCard'

type Props = {
  day: Date | null
  entries: CalendarEntry[]
  onClose: () => void
  onOpenAnnouncement?: (announcementId: string) => void
  onOpenEvent?: (officialEventId: string) => void
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DayDrawer({
  day,
  entries,
  onClose,
  onOpenAnnouncement,
  onOpenEvent,
}: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {day && (
        <motion.div
          key={day.toISOString()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-day-drawer-title"
          className="fixed inset-0 z-[200] md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Zamknij"
            className="fixed inset-0 z-0 bg-black/55 backdrop-blur-sm dark:bg-black/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1] max-h-[88vh] overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-24px_60px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md backdrop-saturate-150 dark:border-white/10 dark:bg-bg-card/97 dark:shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-white/15"
              aria-hidden
            />
            <div className="mb-3 flex items-start justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-white/10">
              <div className="min-w-0">
                <h3
                  id="calendar-day-drawer-title"
                  className="text-base font-bold leading-snug text-fg-primary first-letter:uppercase"
                >
                  {formatDayHeader(day)}
                </h3>
                <p className="mt-0.5 text-xs text-fg-secondary">
                  {entries.length === 0
                    ? 'Brak wpisów'
                    : `${entries.length} ${entries.length === 1 ? 'wpis' : entries.length < 5 ? 'wpisy' : 'wpisów'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-zinc-100 dark:hover:bg-white/5"
                aria-label="Zamknij"
              >
                <X size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>

            <div className="space-y-2">
              {sortEntriesForDay(entries).map((entry) => (
                <CalendarEntryCard
                  key={entry.id}
                  entry={entry}
                  onOpenAnnouncement={onOpenAnnouncement}
                  onOpenEvent={onOpenEvent}
                />
              ))}
              {entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-xs text-fg-secondary dark:border-white/10">
                  Nic się dzisiaj nie dzieje. Czysty kalendarz, czyste sumienie.
                </p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/**
 * Wariant desktopowy — sticky panel obok grid'u, bez portala/backdrop.
 * Renderujemy ZAWSZE (placeholder gdy `day === null`), żeby nie rzucało
 * layoutem przy wyborze dnia.
 */
type InlineProps = {
  day: Date | null
  entries: CalendarEntry[]
  onOpenAnnouncement?: (announcementId: string) => void
  onOpenEvent?: (officialEventId: string) => void
}

export function DayPanelInline({
  day,
  entries,
  onOpenAnnouncement,
  onOpenEvent,
}: InlineProps) {
  return (
    <aside className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white/85 p-4 backdrop-blur-md dark:border-white/10 dark:bg-bg-card/80">
      {day ? (
        <>
          <header className="mb-3 border-b border-zinc-200 pb-3 dark:border-white/10">
            <h3 className="text-sm font-bold leading-snug text-fg-primary first-letter:uppercase">
              {formatDayHeader(day)}
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-secondary">
              {entries.length === 0
                ? 'Brak wpisów'
                : `${entries.length} ${entries.length === 1 ? 'wpis' : entries.length < 5 ? 'wpisy' : 'wpisów'}`}
            </p>
          </header>
          <div className="space-y-2">
            {sortEntriesForDay(entries).map((entry) => (
              <CalendarEntryCard
                key={entry.id}
                entry={entry}
                onOpenAnnouncement={onOpenAnnouncement}
                onOpenEvent={onOpenEvent}
              />
            ))}
            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-fg-secondary dark:border-white/10">
                Nic się tego dnia nie dzieje.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-center text-xs text-fg-secondary">
          Wybierz dzień w siatce, żeby zobaczyć wpisy.
        </p>
      )}
    </aside>
  )
}
