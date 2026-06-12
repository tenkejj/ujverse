/**
 * UJverse — CalendarEntryCard: pojedynczy wpis w DayDrawer.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 *
 * Renderuje wpis kalendarza z chipem-kindem, tytułem, miejscem, wykładowcą
 * oraz linkiem do źródła (komunikat / wydarzenie) jeśli istnieje.
 *
 * Klik na karcie:
 *   - announcement → callback `onOpenAnnouncement` (otwiera AnnouncementDrawer
 *     z parent CalendarView'a)
 *   - official_event → callback `onOpenEvent` (otwiera EventModal)
 *   - inne → no-op (na razie nie ma deep-linka)
 */
import { MapPin, User, ArrowUpRight } from 'lucide-react'
import {
  CALENDAR_ENTRY_KIND_COLORS,
  CALENDAR_ENTRY_KIND_LABEL,
  type CalendarEntry,
} from '../../types/calendar'
import BaseCard from '../ui/BaseCard'

type Props = {
  entry: CalendarEntry
  onOpenAnnouncement?: (announcementId: string) => void
  onOpenEvent?: (officialEventId: string) => void
}

/**
 * Formatowanie godziny / zakresu. Dla all_day zwraca „Cały dzień".
 * Dla wielodniowego (start.day !== end.day) zwraca format dat z miesiącem.
 * Dla intradnia: HH:mm[—HH:mm].
 */
function formatTimeRange(entry: CalendarEntry): string {
  const start = new Date(entry.starts_at)
  const end = new Date(entry.ends_at)
  if (Number.isNaN(start.getTime())) return ''
  if (entry.all_day) return 'Cały dzień'

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  if (!sameDay) {
    const fmtDate = (d: Date) =>
      d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
    return `${fmtDate(start)} – ${fmtDate(end)}`
  }

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  const isPoint =
    start.getTime() === end.getTime() ||
    Math.abs(end.getTime() - start.getTime()) < 60_000
  return isPoint ? fmtTime(start) : `${fmtTime(start)} – ${fmtTime(end)}`
}

export default function CalendarEntryCard({
  entry,
  onOpenAnnouncement,
  onOpenEvent,
}: Props) {
  const colors = CALENDAR_ENTRY_KIND_COLORS[entry.kind]
  const label = CALENDAR_ENTRY_KIND_LABEL[entry.kind]
  const timeRange = formatTimeRange(entry)

  const hasDeepLink =
    (entry.source_announcement_id != null && onOpenAnnouncement != null) ||
    (entry.source_official_event_id != null && onOpenEvent != null)

  const handleClick = () => {
    if (entry.source_announcement_id && onOpenAnnouncement) {
      onOpenAnnouncement(entry.source_announcement_id)
      return
    }
    if (entry.source_official_event_id && onOpenEvent) {
      onOpenEvent(entry.source_official_event_id)
    }
  }

  return (
    <BaseCard
      variant="inner"
      interactive={hasDeepLink}
      as={hasDeepLink ? 'button' : 'div'}
      onClick={hasDeepLink ? handleClick : undefined}
      className="w-full p-3 text-left"
    >
      <div className="flex items-start gap-3">
        {/* Pionowy pasek koloru kindu — wizualny anchor w liście */}
        <span
          aria-hidden
          className={`mt-1 h-12 w-1 shrink-0 rounded-full ${colors.dot}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors.badge} ${colors.badgeText}`}
            >
              {label}
            </span>
            {timeRange ? (
              <span className="text-xs font-medium tabular-nums text-fg-secondary">
                {timeRange}
              </span>
            ) : null}
            {hasDeepLink ? (
              <ArrowUpRight
                size={14}
                className="ml-auto shrink-0 text-fg-secondary"
                aria-hidden
              />
            ) : null}
          </div>

          <h3 className="mt-1.5 text-sm font-bold leading-snug text-fg-primary">
            {entry.title}
          </h3>

          {entry.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-secondary">
              {entry.description}
            </p>
          ) : null}

          {/* Metadane: wykładowca, sala */}
          {(entry.lecturer_name || entry.location) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-secondary">
              {entry.lecturer_name ? (
                <span className="inline-flex items-center gap-1">
                  <User size={11} strokeWidth={2} className="shrink-0" aria-hidden />
                  {entry.lecturer_name}
                </span>
              ) : null}
              {entry.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} strokeWidth={2} className="shrink-0" aria-hidden />
                  {entry.location}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  )
}
