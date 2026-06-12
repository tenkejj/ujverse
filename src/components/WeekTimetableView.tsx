/**
 * UJverse — widok „Cały tydzień" w planie zajęć.
 *
 * Komplementarny do `TodayClassesWidget`: ten ostatni pokazuje TYLKO dzisiaj
 * (kompaktowo, do quick glance), a `WeekTimetableView` daje pełen tydzień
 * z nawigacją wstecz/naprzód — głównie żeby user mógł obejrzeć co miał
 * w poprzednim tygodniu (np. „kiedy mieliśmy ten wykład?").
 *
 * Reużywa istniejącego RPC `get_timetable_for_range` — żadnych nowych
 * endpointów. Zakres `[weekStart, weekStart+7)`, domyślne okno na anonse
 * 168h zostawia spójny match z TodayClassesWidget.
 *
 * UX:
 *   - Default = bieżący tydzień (poniedziałek-niedziela, ISO).
 *   - Prev/Next buttony przesuwają o 7 dni; „Dziś" wraca na current week
 *     (pokazuje się tylko gdy nie jesteśmy na bieżącym).
 *   - Każdy dzień jest sekcją: nagłówek + lista zajęć (lub „Brak zajęć").
 *   - Dni przeszłe są stłumione (`opacity`), dziś podświetlony złotym akcentem.
 *   - Odwołane zajęcia mają badge + klikalne body anonsa (deep-link do drawera).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, X as XIcon } from 'lucide-react'
import BaseCard from './ui/BaseCard'
import { theme } from '../styles/theme'
import { DataService } from '../services/DataService'
import type { TimetableEntryRow } from '../services/adapters/TimetableAdapter'

type Props = {
  userId: string
  /** Bumpowane przez parent po imporcie/clear/odwiedzonym anonsie żeby wymusić refetch. */
  refreshTick?: number
}

const DAY_NAMES_LONG = [
  'Niedziela',
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
]
const MONTH_NAMES_GENITIVE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]

function startOfIsoWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  // ISO Monday-first: Sun(0)→-6, Mon(1)→0, Tue(2)→-1, …
  const dow = x.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + offset)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtHM(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  if (
    weekStart.getMonth() === end.getMonth() &&
    weekStart.getFullYear() === end.getFullYear()
  ) {
    return `${weekStart.getDate()}–${end.getDate()} ${MONTH_NAMES_GENITIVE[weekStart.getMonth()]}`
  }
  if (weekStart.getFullYear() === end.getFullYear()) {
    return `${weekStart.getDate()} ${MONTH_NAMES_GENITIVE[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_GENITIVE[end.getMonth()]}`
  }
  return `${weekStart.getDate()} ${MONTH_NAMES_GENITIVE[weekStart.getMonth()]} ${weekStart.getFullYear()} – ${end.getDate()} ${MONTH_NAMES_GENITIVE[end.getMonth()]} ${end.getFullYear()}`
}

function pluralizeClasses(n: number): string {
  if (n === 1) return 'zajęcie'
  if (n >= 2 && n <= 4) return 'zajęcia'
  return 'zajęć'
}

export default function WeekTimetableView({ userId: _userId, refreshTick = 0 }: Props) {
  const navigate = useNavigate()

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])
  const currentWeekStart = useMemo(() => startOfIsoWeek(today), [today])

  const [weekStart, setWeekStart] = useState<Date>(() => startOfIsoWeek(new Date()))
  const [rows, setRows] = useState<TimetableEntryRow[]>([])
  const [loading, setLoading] = useState(false)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const isCurrentWeek = useMemo(
    () => isSameDay(weekStart, currentWeekStart),
    [weekStart, currentWeekStart],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await DataService.listTimetableForRange(weekStart, weekEnd, 168)
    setRows(data)
    setLoading(false)
  }, [weekStart, weekEnd])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshTick])

  const days = useMemo(() => {
    // Grupowanie po pełnej dacie (a nie tylko `getDay()`) — odporne na zmianę
    // tygodnia zachowując ten sam DOW.
    const byDate = new Map<string, TimetableEntryRow[]>()
    for (const r of rows) {
      const d = new Date(r.start_time)
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const arr = byDate.get(dateKey) ?? []
      arr.push(r)
      byDate.set(dateKey, arr)
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const entries = (byDate.get(dateKey) ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        )
      return { date, entries }
    })
  }, [rows, weekStart])

  const totalCount = rows.length
  const cancelledCount = useMemo(
    () => rows.filter((r) => r.cancelled_announcement_id).length,
    [rows],
  )

  const handleOpenCancellation = (announcementId: string) => {
    navigate(`/moj-plan?announcement=${announcementId}`)
  }

  const navButtonCls =
    'inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]'

  return (
    <BaseCard variant="default" className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarDays
            size={16}
            className="shrink-0 text-brand-gold dark:text-brand-gold-bright"
            strokeWidth={2.25}
          />
          <div className="min-w-0">
            <p className={`text-[15px] font-bold leading-tight ${theme.text.primary}`}>
              Cały tydzień
            </p>
            <p className={`mt-0.5 text-[11.5px] ${theme.text.muted}`}>
              {fmtWeekRange(weekStart)}
              {totalCount > 0
                ? ` · ${totalCount} ${pluralizeClasses(totalCount)}`
                : ''}
              {cancelledCount > 0 ? ` · ${cancelledCount} odwołanych` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Poprzedni tydzień"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className={navButtonCls}
          >
            <ChevronLeft size={14} strokeWidth={2.25} />
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(currentWeekStart)}
              className="inline-flex h-7 items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2.5 text-[11px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15 dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/15"
            >
              Dziś
            </button>
          )}
          <button
            type="button"
            aria-label="Następny tydzień"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className={navButtonCls}
          >
            <ChevronRight size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading && rows.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.03]"
              />
            ))
          : days.map(({ date, entries }) => {
              const isToday = isSameDay(date, today)
              const isPast = date.getTime() < today.getTime()
              const dayLabel = `${DAY_NAMES_LONG[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES_GENITIVE[date.getMonth()]}`
              return (
                <DaySection
                  key={date.toISOString()}
                  dayLabel={dayLabel}
                  isToday={isToday}
                  isPast={isPast}
                  entries={entries}
                  onOpenCancellation={handleOpenCancellation}
                />
              )
            })}
      </div>
    </BaseCard>
  )
}

function DaySection({
  dayLabel,
  isToday,
  isPast,
  entries,
  onOpenCancellation,
}: {
  dayLabel: string
  isToday: boolean
  isPast: boolean
  entries: TimetableEntryRow[]
  onOpenCancellation: (announcementId: string) => void
}) {
  const empty = entries.length === 0
  return (
    <div className={isPast && !isToday ? 'opacity-65' : ''}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p
          className={`text-[12px] font-bold uppercase tracking-wide ${
            isToday
              ? 'text-brand-gold dark:text-brand-gold-bright'
              : theme.text.primary
          }`}
        >
          {dayLabel}
          {isToday && (
            <span className="ml-1.5 rounded-full bg-brand-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-gold dark:bg-brand-gold-bright/20 dark:text-brand-gold-bright">
              Dziś
            </span>
          )}
        </p>
        <span className={`text-[10.5px] tabular-nums ${theme.text.muted}`}>
          {empty ? 'wolne' : `${entries.length} ${pluralizeClasses(entries.length)}`}
        </span>
      </div>

      {empty ? (
        <div
          className={`rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-center text-[11px] dark:border-white/10 ${theme.text.muted}`}
        >
          Brak zajęć
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <ClassRowMini
              key={entry.id}
              entry={entry}
              onOpenCancellation={onOpenCancellation}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClassRowMini({
  entry,
  onOpenCancellation,
}: {
  entry: TimetableEntryRow
  onOpenCancellation: (announcementId: string) => void
}) {
  const start = new Date(entry.start_time)
  const end = new Date(entry.end_time)
  const isCancelled = Boolean(entry.cancelled_announcement_id)

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 ${
        isCancelled
          ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/[0.06]'
          : 'border-zinc-200 bg-white/60 dark:border-white/10 dark:bg-white/[0.02]'
      }`}
    >
      <div
        className={`flex shrink-0 flex-col items-center justify-center rounded-md px-2 py-1 text-[10px] font-semibold tabular-nums leading-none ${
          isCancelled
            ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
            : 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200'
        }`}
      >
        <span>{fmtHM(start)}</span>
        <span className="mt-0.5 text-[9px] opacity-60">{fmtHM(end)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`min-w-0 truncate text-[12.5px] font-semibold leading-snug ${
              isCancelled
                ? 'text-red-800 line-through decoration-red-400/70 dark:text-red-100'
                : theme.text.primary
            }`}
          >
            {entry.summary}
          </p>
          {isCancelled && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
              <XIcon size={9} strokeWidth={3} />
              Odwołane
            </span>
          )}
        </div>
        {(entry.lecturer_name || entry.location) && (
          <p className={`mt-0.5 truncate text-[11px] ${theme.text.muted}`}>
            {entry.lecturer_name ?? ''}
            {entry.lecturer_name && entry.location ? ' · ' : ''}
            {entry.location ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={9} className="inline-block" /> {entry.location}
              </span>
            ) : null}
          </p>
        )}
        {isCancelled && entry.cancelled_announcement_id && entry.cancelled_announcement_body && (
          <button
            type="button"
            onClick={() =>
              entry.cancelled_announcement_id &&
              onOpenCancellation(entry.cancelled_announcement_id)
            }
            className="mt-1 line-clamp-1 w-full text-left text-[10.5px] leading-relaxed text-red-900/85 underline-offset-2 hover:underline dark:text-red-200/85"
          >
            {entry.cancelled_announcement_body.replace(/\s+/g, ' ').trim()}
          </button>
        )}
      </div>
    </div>
  )
}
