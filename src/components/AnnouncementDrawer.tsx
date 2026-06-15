import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { getAnnouncementBadge } from '../lib/announcementBranding'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../lib/announcementStatusStyles'
import type { AnnouncementMeta, UnifiedContent } from '../types/content'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  CALENDAR_ENTRY_KIND_LABEL,
  type AnnouncementExtractedCalendar,
} from '../types/calendar'
import UserAvatar from './UserAvatar'
import LecturerSubscribeBell from './announcements/LecturerSubscribeBell'

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Patrz `AnnouncementCard.isoStartsToCalendarDayKey` — ten sam algorytm. */
function isoStartsToCalendarDayKey(startsAt: string): string | null {
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatExtractedDate(cal: AnnouncementExtractedCalendar): string {
  const d = new Date(cal.starts_at)
  if (Number.isNaN(d.getTime())) return ''
  if (cal.all_day) {
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return d.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  announcement: UnifiedContent<AnnouncementMeta> | null
  onClose: () => void
}

export default function AnnouncementDrawer({ announcement, onClose }: Props) {
  const navigate = useNavigate()
  if (typeof document === 'undefined') return null

  const summary = announcement?.metadata.summary ?? null
  const extractedCalendar = announcement?.metadata.extractedCalendar ?? null
  const facultyTitle = announcement?.metadata.title ?? null
  const sourceUrl = announcement?.metadata.sourceUrl ?? null
  const sourceBadge = getAnnouncementBadge(announcement?.metadata.source)
  const hasFacultyTitle = facultyTitle != null && facultyTitle.trim().length > 0
  const calendarDayKey =
    extractedCalendar !== null ? isoStartsToCalendarDayKey(extractedCalendar.starts_at) : null
  const calendarColors =
    extractedCalendar !== null ? CALENDAR_ENTRY_KIND_COLORS[extractedCalendar.kind] : null

  const handleOpenInCalendar = () => {
    if (!calendarDayKey) return
    onClose()
    navigate('/events', {
      state: { tab: 'calendar', openCalendarDay: calendarDayKey },
    })
  }

  return createPortal(
    <AnimatePresence>
      {announcement && (
        <motion.div
          key={announcement.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-drawer-title"
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
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-300 dark:bg-white/15" aria-hidden />
            <div className="flex items-start gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
              <UserAvatar
                profile={null}
                name={announcement.author.displayName}
                className="h-11 w-11 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <p
                    id="announcement-drawer-title"
                    className="text-lg font-bold leading-snug text-fg-primary min-w-0 flex-1"
                  >
                    {hasFacultyTitle ? facultyTitle!.trim() : announcement.author.displayName}
                  </p>
                  {sourceBadge && (
                    <span
                      className="text-[9px] font-medium leading-none whitespace-nowrap text-fg-secondary opacity-70 shrink-0 text-right"
                      title={sourceBadge.title}
                    >
                      {sourceBadge.label}
                    </span>
                  )}
                </div>
                {hasFacultyTitle && announcement.author.displayName && (
                  // Sub-label z lecturer/fallback name — dla Liferay/WP zwykle
                  // to „Komunikat wydziałowy", ale gdy parser złapał konkretne
                  // nazwisko (np. ogłoszenie konkursu od profesora) pokażmy je.
                  <p className="mt-0.5 text-xs text-fg-secondary">
                    {announcement.author.displayName}
                  </p>
                )}
                {announcement.timestamp && (
                  <time
                    className="mt-0.5 block text-xs tabular-nums text-fg-secondary"
                    dateTime={announcement.timestamp}
                  >
                    {formatAnnDate(announcement.timestamp)}
                  </time>
                )}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-block size-2 shrink-0 rounded-full ${ANNOUNCEMENT_STATUS_DOT[announcement.metadata.status]}`}
                    aria-hidden
                  />
                  <span
                    className={`inline-flex rounded-full border bg-transparent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ANNOUNCEMENT_STATUS_BADGE[announcement.metadata.status]}`}
                  >
                    {ANNOUNCEMENT_STATUS_LABEL[announcement.metadata.status]}
                  </span>
                  {extractedCalendar !== null && calendarDayKey !== null && calendarColors !== null && (
                    <button
                      type="button"
                      onClick={handleOpenInCalendar}
                      title={`${CALENDAR_ENTRY_KIND_LABEL[extractedCalendar.kind]}. Otwórz w kalendarzu.`}
                      className={`group inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${calendarColors.badge} ${calendarColors.badgeText} hover:brightness-110`}
                    >
                      <span
                        className={`inline-block size-1.5 rounded-full ${calendarColors.dot}`}
                        aria-hidden
                      />
                      <span>{formatExtractedDate(extractedCalendar)}</span>
                      <span aria-hidden className="opacity-60 group-hover:opacity-100">→</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            {summary !== null && summary.length > 0 && (
              // TL;DR od Bielika — pierwsza sekcja po headerze, podkreślone
              // wizualnie złotym paskiem (brand). Świadomie NAD pełnym body,
              // żeby user mógł zorientować się w komunikacie w 2 sekundy.
              <p className="mt-4 pl-3 border-l-2 border-brand-gold/70 dark:border-brand-gold-bright/70 text-[15px] font-medium leading-snug text-fg-primary">
                {summary}
              </p>
            )}
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-primary/90 dark:text-zinc-300">
              {announcement.body}
            </p>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-logo-navy underline-offset-2 hover:underline dark:text-slate-300"
              >
                Otwórz oryginalne ogłoszenie <span aria-hidden>↗</span>
              </a>
            )}
            {!hasFacultyTitle && (
              // Subskrybowanie po wykładowcy ma sens tylko dla ISI lecturer-blocks
              // (gdzie author = realna osoba). Liferay/WP mają zwykle fallback
              // „Komunikat wydziałowy" — bell pod nim byłby mylący.
              <div className="mt-5 flex justify-center">
                <LecturerSubscribeBell
                  lecturerName={announcement.author.displayName}
                  variant="pill"
                  stopPropagation={false}
                />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-zinc-900/6 py-3 text-sm font-semibold text-fg-primary transition-colors hover:bg-zinc-900/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Zamknij
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
