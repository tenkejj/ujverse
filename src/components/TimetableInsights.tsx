/**
 * UJverse — karta „Twój plan w liczbach" + auto-subscribe wykładowców.
 *
 * Konsumowane przez `MojPlanView`. Łączy w jeden widget:
 *   - statystyki bieżącego tygodnia (ile zajęć / ile godzin / busiest day),
 *   - ostatni import (z CTA do re-importu jeśli > 7 dni temu),
 *   - banner auto-subskrypcji wykładowców z planu (one-click „Powiadom
 *     mnie o ogłoszeniach wszystkich moich wykładowców").
 *
 * Wszystkie sekcje są opcjonalne — jeśli plan pusty, cała karta NIE
 * renderuje się (caller decyduje).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  CalendarClock,
  Clock,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import BaseCard from './ui/BaseCard'
import { theme } from '../styles/theme'
import { DataService } from '../services/DataService'
import { useLecturerSubscriptionsContext } from '../lib/lecturerSubscriptionsContext'
import { deriveKeyClient } from '../services/adapters/LecturerSubscriptionsAdapter'
import type {
  DistinctLecturerRow,
  TimetableStats,
} from '../services/adapters/TimetableAdapter'

const POLISH_DAY_NAMES = [
  'Niedziela',
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
]

const STALE_IMPORT_DAYS = 7

type Props = {
  userId: string
  /** Bumpowane przez parent po imporcie/clear żeby wymusić refetch. */
  refreshTick?: number
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  // ISO Monday-based week: 0(Sun)→-6, 1(Mon)→0, 2(Tue)→-1, …
  const dow = x.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  x.setDate(x.getDate() + offset)
  return x
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d)
  const x = new Date(start)
  x.setDate(x.getDate() + 7)
  return x
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function formatHours(h: number): string {
  if (h === 0) return '0 h'
  // np. 12.5 → „12,5 h", 13 → „13 h"
  const rounded = Math.round(h * 10) / 10
  const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1).replace('.', ',')
  return `${text} h`
}

export default function TimetableInsights({ userId, refreshTick = 0 }: Props) {
  const ctx = useLecturerSubscriptionsContext()
  const [stats, setStats] = useState<TimetableStats | null>(null)
  const [lecturers, setLecturers] = useState<DistinctLecturerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [s, ls] = await Promise.all([
      DataService.timetableStats(userId, startOfWeek(new Date()), endOfWeek(new Date())),
      DataService.listTimetableLecturers(userId),
    ])
    setStats(s)
    setLecturers(ls)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshTick])

  const unsubscribed = useMemo(() => {
    if (!ctx) return [] as DistinctLecturerRow[]
    return lecturers.filter((l) => !ctx.subscribedKeys.has(deriveKeyClient(l.lecturer_name)))
  }, [ctx, lecturers])

  const handleBulkSubscribe = async () => {
    if (!ctx || unsubscribed.length === 0) return
    setBulkLoading(true)
    await ctx.subscribeMany(unsubscribed.map((l) => l.lecturer_name))
    setBulkLoading(false)
  }

  // Brak planu → cała karta ukryta
  if (!stats || stats.totalEntries === 0) return null

  const lastImportDays = daysSince(stats.lastImportedAt)
  const isStale = lastImportDays !== null && lastImportDays >= STALE_IMPORT_DAYS

  return (
    <BaseCard variant="default" className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles
          size={16}
          className="text-brand-gold dark:text-brand-gold-bright"
          strokeWidth={2.25}
        />
        <p className={`text-[15px] font-bold ${theme.text.primary}`}>Twój plan w liczbach</p>
      </div>

      {loading && !stats ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatTile
              icon={CalendarClock}
              label="W tym tygodniu"
              value={`${stats.thisWeekCount}`}
              hint={stats.thisWeekCount === 1 ? 'zajęcie' : 'zajęć'}
            />
            <StatTile
              icon={Clock}
              label="Łącznie godzin"
              value={formatHours(stats.thisWeekHours)}
              hint="w tygodniu"
            />
            <StatTile
              icon={TrendingUp}
              label="Najwięcej w"
              value={
                stats.busiestDay
                  ? POLISH_DAY_NAMES[stats.busiestDay.dayOfWeek]?.slice(0, 3) ?? '—'
                  : '—'
              }
              hint={
                stats.busiestDay
                  ? `${stats.busiestDay.count} ${stats.busiestDay.count === 1 ? 'zajęcie' : 'zajęć'}`
                  : 'brak'
              }
            />
          </div>

          {lastImportDays !== null && (
            <p
              className={`mt-3 text-[11.5px] ${
                isStale
                  ? 'text-amber-700 dark:text-amber-300'
                  : theme.text.muted
              }`}
            >
              Plan zaimportowany{' '}
              {lastImportDays === 0
                ? 'dziś'
                : lastImportDays === 1
                  ? 'wczoraj'
                  : `${lastImportDays} dni temu`}
              {isStale ? ' — sprawdź USOSweb i odśwież jeśli był update.' : '.'}
            </p>
          )}
        </>
      )}

      {ctx && unsubscribed.length > 0 && (
        <div className="mt-4 rounded-xl border border-brand-gold/35 bg-brand-gold/[0.06] p-3 dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 dark:bg-brand-gold-bright/20">
              <BellRing
                size={16}
                className="text-brand-gold dark:text-brand-gold-bright"
                strokeWidth={2.25}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${theme.text.primary}`}>
                Powiadom mnie o ogłoszeniach moich wykładowców
              </p>
              <p className={`mt-0.5 text-[11.5px] leading-relaxed ${theme.text.muted}`}>
                Wykryliśmy w Twoim planie{' '}
                <strong className={theme.text.primary}>
                  {unsubscribed.length} {unsubscribed.length === 1 ? 'wykładowcę' : 'wykładowców'}
                </strong>{' '}
                bez subskrypcji. Włącz powiadomienia jednym kliknięciem.
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {unsubscribed.slice(0, 6).map((l) => (
                  <span
                    key={l.lecturer_key}
                    className={`inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-2 py-0.5 text-[10.5px] font-medium ${theme.text.muted} dark:border-white/10 dark:bg-white/[0.04]`}
                  >
                    {l.lecturer_name}
                  </span>
                ))}
                {unsubscribed.length > 6 && (
                  <span className={`text-[10.5px] ${theme.text.muted}`}>
                    + {unsubscribed.length - 6} więcej
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleBulkSubscribe()}
                disabled={bulkLoading}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1e293b] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e293b]/90 disabled:opacity-50 dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85"
              >
                {bulkLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <BellRing size={12} />
                )}
                Zasubskrybuj{' '}
                {unsubscribed.length === 1 ? '1 wykładowcę' : `wszystkich ${unsubscribed.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <Icon
          size={12}
          className="text-brand-gold dark:text-brand-gold-bright"
          strokeWidth={2.25}
        />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${theme.text.muted}`}>
          {label}
        </span>
      </div>
      <p className={`mt-1 text-[18px] font-bold tabular-nums leading-none ${theme.text.primary}`}>
        {value}
      </p>
      {hint && <p className={`mt-1 text-[10.5px] ${theme.text.muted}`}>{hint}</p>}
    </div>
  )
}
