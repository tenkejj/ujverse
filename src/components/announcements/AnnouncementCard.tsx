import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAnnouncementBadge } from '../../lib/announcementBranding'
import {
  ANNOUNCEMENT_STATUS_BADGE,
  ANNOUNCEMENT_STATUS_DOT,
  ANNOUNCEMENT_STATUS_LABEL,
} from '../../lib/announcementStatusStyles'
import { sideMutedCls } from '../../lib/sidePanelStyles'
import { DataService } from '../../services/DataService'
import type { AnnouncementMeta, UnifiedContent } from '../../types/content'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  CALENDAR_ENTRY_KIND_LABEL,
  type AnnouncementExtractedCalendar,
} from '../../types/calendar'
import BaseCard from '../ui/BaseCard'
import LecturerSubscribeBell from './LecturerSubscribeBell'

function formatAnnDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Wyciąga klucz dnia (YYYY-MM-DD, czas lokalny) z `extracted_calendar.starts_at`.
 * Identycznie z `formatDayKey` w `useCalendarEntries.ts` — duplikujemy lokalnie
 * żeby uniknąć tworzenia cyklicznej zależności (AnnouncementCard nie powinien
 * importować z hooka kalendarza, bo karta jest renderowana też na ścieżkach
 * gdzie kalendarz nie jest doładowany).
 */
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
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })
  }
  return d.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AnnouncementBodyClamp({
  body,
  expanded,
  onToggle,
}: {
  body: string
  expanded: boolean
  onToggle: () => void
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (expanded) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [body, expanded])

  return (
    <div className="min-h-0">
      <p
        ref={ref}
        className={`text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap break-words ${
          expanded ? '' : 'line-clamp-4'
        }`}
      >
        {body}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1.5 text-xs font-medium ${sideMutedCls} hover:text-logo-navy/80 dark:hover:text-slate-300 transition-colors`}
        >
          {expanded ? 'zwiń' : 'rozwiń'}
        </button>
      )}
    </div>
  )
}

type Props = {
  announcement: UnifiedContent<AnnouncementMeta>
  expanded?: boolean
  onToggleExpand?: () => void
  /** Gdy podane — cała karta jest klikalna (np. wyniki wyszukiwania). */
  onOpen?: () => void
  className?: string
}

export default function AnnouncementCard({
  announcement,
  expanded: expandedProp,
  onToggleExpand,
  onOpen,
  className = '',
}: Props) {
  const [expandedLocal, setExpandedLocal] = useState(false)
  const [displayBody, setDisplayBody] = useState(announcement.body)
  const [loadingFullBody, setLoadingFullBody] = useState(false)
  const fullBodyFetchedRef = useRef(false)
  const expanded = expandedProp ?? expandedLocal
  const toggleExpand =
    onToggleExpand ??
    (() => {
      setExpandedLocal((v) => !v)
    })

  // Reset przy zmianie komunikatu (realtime refetch / filtr wydziału).
  useLayoutEffect(() => {
    setDisplayBody(announcement.body)
    fullBodyFetchedRef.current = false
    setLoadingFullBody(false)
  }, [announcement.id, announcement.body])

  const handleToggleExpand = () => {
    const willExpand = !expanded
    toggleExpand()

    if (!willExpand || fullBodyFetchedRef.current || loadingFullBody) return

    const kind = announcement.metadata.sourceKind
    const mightHaveFullBody =
      kind === 'liferay' || kind === 'wordpress_cm' || Boolean(announcement.metadata.sourceUrl)
    if (!mightHaveFullBody) return

    setLoadingFullBody(true)
    void DataService.fetchAnnouncementById(announcement.id)
      .then((detail) => {
        if (!detail?.body || detail.body.length <= announcement.body.length) return
        setDisplayBody(detail.body)
        fullBodyFetchedRef.current = true
      })
      .catch((err) => {
        console.warn('[AnnouncementCard] full body fetch failed', err)
      })
      .finally(() => {
        setLoadingFullBody(false)
      })
  }

  const navigate = useNavigate()

  const { summary, extractedCalendar, title: facultyTitle, sourceUrl } = announcement.metadata
  const sourceBadge = getAnnouncementBadge(announcement.metadata.source)
  const calendarDayKey =
    extractedCalendar !== null ? isoStartsToCalendarDayKey(extractedCalendar.starts_at) : null
  const calendarColors =
    extractedCalendar !== null ? CALENDAR_ENTRY_KIND_COLORS[extractedCalendar.kind] : null

  const handleOpenInCalendar = (e: MouseEvent) => {
    // `stopPropagation` żeby na ścieżce z `onOpen` (wyniki wyszukiwania)
    // klik w deep-link nie otwierał drawera komunikatu zamiast kalendarza.
    e.stopPropagation()
    if (!calendarDayKey) return
    navigate('/events', {
      state: { tab: 'calendar', openCalendarDay: calendarDayKey },
    })
  }

  // Dla komunikatów wydziałowych (Liferay/WP) headline'em jest tytuł
  // ogłoszenia, a lecturer/fallback name schodzi do podpisu pod tytułem.
  // Dla ISI (lecturer-blocks) zostaje stary układ — nazwisko jest tym
  // co user chce zobaczyć najpierw.
  const hasFacultyTitle = facultyTitle != null && facultyTitle.trim().length > 0
  const headline = hasFacultyTitle ? facultyTitle!.trim() : announcement.author.displayName

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug min-w-0 break-words whitespace-normal">
            {headline}
          </p>
          {!hasFacultyTitle && (
            <LecturerSubscribeBell
              lecturerName={announcement.author.displayName}
              className="shrink-0 translate-y-[-2px]"
            />
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-0">
          {sourceBadge && (
            <span
              className="block text-[9px] font-medium leading-none whitespace-nowrap shrink-0 text-[#1e293b] dark:text-zinc-400 opacity-70 text-right"
              title={sourceBadge.title}
            >
              {sourceBadge.label}
            </span>
          )}
          {announcement.timestamp && (
            <time
              dateTime={announcement.timestamp}
              className={`text-[10px] tabular-nums ${sideMutedCls}`}
            >
              {formatAnnDate(announcement.timestamp)}
            </time>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className={`inline-block size-2 rounded-full shrink-0 ${ANNOUNCEMENT_STATUS_DOT[announcement.metadata.status]}`}
          aria-hidden
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-transparent ${ANNOUNCEMENT_STATUS_BADGE[announcement.metadata.status]}`}
        >
          {ANNOUNCEMENT_STATUS_LABEL[announcement.metadata.status]}
        </span>
        {extractedCalendar !== null && calendarDayKey !== null && calendarColors !== null && (
          // Deep-link do kalendarza — przycisk żeby był focusowalny (a11y),
          // ale wewnątrz BaseCard `interactive` button (`onOpen`) musimy
          // zatrzymać event. Pełen kontekst w handleOpenInCalendar.
          <button
            type="button"
            onClick={handleOpenInCalendar}
            title={`${CALENDAR_ENTRY_KIND_LABEL[extractedCalendar.kind]} — ${formatExtractedDate(extractedCalendar)}. Otwórz w kalendarzu.`}
            className={`group inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${calendarColors.badge} ${calendarColors.badgeText} hover:brightness-110`}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${calendarColors.dot}`}
              aria-hidden
            />
            <span>{formatExtractedDate(extractedCalendar)}</span>
            <span aria-hidden className="opacity-60 group-hover:opacity-100">
              →
            </span>
          </button>
        )}
      </div>
      {summary !== null && summary.length > 0 && (
        // TL;DR od Bielika — wizualnie podkreślone (pasek z lewej + większa
        // czcionka niż body). Świadomie NAD body clampem — to jest pierwsza
        // rzecz którą widzi user; surowy body służy do weryfikacji.
        <p className="mb-2 pl-2 border-l-2 border-brand-gold/60 dark:border-brand-gold-bright/60 text-xs font-medium leading-snug text-zinc-800 dark:text-zinc-200">
          {summary}
        </p>
      )}
      <AnnouncementBodyClamp
        body={displayBody}
        expanded={expanded}
        onToggle={handleToggleExpand}
      />
      {loadingFullBody && (
        <p className={`mt-1 text-[10px] ${sideMutedCls}`}>Ładuję pełną treść…</p>
      )}
      {sourceUrl && (
        // Deep-link do oryginalnego ogłoszenia na portalu wydziału (Liferay/WP).
        // `stopPropagation` — jeśli karta jest w trybie `onOpen` (search wynik
        // klikalny), klik w link nie odpala drawera tylko otwiera URL.
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`mt-2 inline-flex items-center gap-1 text-[10px] font-medium ${sideMutedCls} hover:text-logo-navy/80 dark:hover:text-slate-300 transition-colors`}
        >
          Otwórz oryginał <span aria-hidden>↗</span>
        </a>
      )}
    </>
  )

  if (onOpen) {
    return (
      <BaseCard
        as="button"
        type="button"
        variant="inner"
        interactive
        onClick={onOpen}
        className={`m-0 p-3 min-h-0 w-full text-left ${className}`}
      >
        {inner}
      </BaseCard>
    )
  }

  return (
    <BaseCard variant="inner" className={`m-0 p-3 min-h-0 ${className}`}>
      {inner}
    </BaseCard>
  )
}
