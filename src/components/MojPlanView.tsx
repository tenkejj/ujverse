/**
 * UJverse — „Mój Plan": unified hub akademicki.
 *
 * Świadomie ZASTĘPUJE `/dzis` + `/briefing` + (stary) `/moj-plan`. Wszystko
 * akademickie w jednym miejscu, w kolejności od najbardziej zaktualizowanego
 * do tła:
 *
 *   1. Data i krótkie powitanie
 *   2. Karta „teraz / następne”: godzina, nazwa, sala, prowadzący
 *   3. Tydzień jako plan: kolumny dni na desktopie, wybrany dzień na telefonie
 *   4. Terminy, zmiany i wydarzenia — na telefonie za zwinięciem
 *   5. Import planu z USOSweb
 *
 * Nawigacja: brak back-buttona, brak side-railu, brak duplikujących widgetów.
 *
 * Świadomie NIE rekonstruujemy tygodni z cyklu — pokazujemy wyłącznie to,
 * co realnie znajduje się w `user_timetable_entries`. Brak danych = pusty
 * tydzień (bez bursztynowych ozdóbek).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  GraduationCap,
  Megaphone,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  type LucideIcon,
} from 'lucide-react'
import EmptyState from './EmptyState'
import ImportTimetablePanel from './ImportTimetablePanel'
import { useDailyBrief } from '../hooks/useDailyBrief'
import { useWeeklyBriefing } from '../hooks/useWeeklyBriefing'
import { DataService } from '../services/DataService'
import { DailyBriefService } from '../services/ai/DailyBriefService'
import { theme } from '../styles/theme'
import {
  fmtDayDate,
  fmtHM as fmtHMIso,
  KIND_LABELS,
  KIND_TONE,
} from './briefing/briefingFormat'
import type { TodayClass } from '../hooks/useTodayClasses'
import type { TimetableEntryRow } from '../services/adapters/TimetableAdapter'
import type { Profile } from '../types'
import type { Cohort } from '../types/database'

const AiInsightModal = lazy(() => import('./aula/AiInsightModal'))

type Props = {
  userId: string | null
  myProfile: Profile | null
  cohort: Cohort | null
}

const DAY_NAMES_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb']
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
function fmtTodayLong(d: Date): string {
  const s = d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function buildSalutation(now: Date): { hello: string; Icon: LucideIcon } {
  const h = now.getHours()
  if (h < 5) return { hello: 'Dobranoc', Icon: Moon }
  if (h < 10) return { hello: 'Dzień dobry', Icon: Sunrise }
  if (h < 13) return { hello: 'Cześć', Icon: Coffee }
  if (h < 18) return { hello: 'Witaj', Icon: Sun }
  if (h < 22) return { hello: 'Dobry wieczór', Icon: Moon }
  return { hello: 'Dobranoc', Icon: Moon }
}
function firstName(p: Profile | null): string {
  if (!p) return ''
  const full = (p.full_name ?? '').trim()
  if (full) {
    const first = full.split(/\s+/)[0]
    if (first) return first
  }
  return (p.username ?? '').trim()
}
const GLASS_PANEL_CLS = [
  'relative overflow-hidden rounded-2xl border p-4 sm:p-5',
  'border-zinc-200/70 bg-white/75 backdrop-blur-xl backdrop-saturate-150',
  'shadow-[0_18px_60px_-30px_rgba(15,23,42,0.25)]',
  'dark:border-white/[0.07] dark:bg-zinc-950/45',
  'dark:shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]',
].join(' ')

const SECTION_TITLE_CLS =
  'flex items-center gap-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50'
const SECTION_BADGE_CLS =
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums ' +
  'border-brand-ink/25 bg-brand-ink/[0.06] text-brand-ink ' +
  'dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright/[0.08] dark:text-brand-gold-bright'
const SECTION_SUBTITLE_CLS = 'text-[12px] font-medium text-zinc-500 dark:text-zinc-500'

function SectionHeader({
  icon: Icon,
  title,
  count,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  count?: number
  subtitle?: string
}) {
  return (
    <header className="flex items-baseline justify-between gap-3 px-1">
      <h2 className={SECTION_TITLE_CLS}>
        <Icon size={14} strokeWidth={2.25} aria-hidden />
        {title}
        {typeof count === 'number' && count > 0 && (
          <span className={SECTION_BADGE_CLS}>{count}</span>
        )}
      </h2>
      {subtitle && <span className={SECTION_SUBTITLE_CLS}>{subtitle}</span>}
    </header>
  )
}

function GreetingBar({
  myProfile,
  onRefresh,
  refreshing,
  onOpenAi,
  showAiCta,
}: {
  myProfile: Profile | null
  onRefresh: () => void
  refreshing: boolean
  onOpenAi: () => void
  showAiCta: boolean
}) {
  const now = useMemo(() => new Date(), [])
  const salutation = useMemo(() => buildSalutation(now), [now])
  const greeting = firstName(myProfile)
  const todayLabel = fmtTodayLong(now)
  const SalIcon = salutation.Icon

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
          <SalIcon size={13} strokeWidth={2.25} />
          {todayLabel}
        </div>
        <p className={`mt-0.5 truncate text-base font-semibold leading-tight ${theme.text.primary}`}>
          {greeting ? `${salutation.hello}, ${greeting}` : salutation.hello}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {showAiCta && (
          <button
            type="button"
            onClick={onOpenAi}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-ink px-3 text-[13px] font-semibold text-white hover:bg-brand-ink/90 dark:bg-brand-gold-bright dark:text-zinc-950 dark:hover:bg-brand-gold-bright/90"
          >
            <Sparkles size={13} strokeWidth={2.5} />
            AI brief
          </button>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Odśwież"
          className="inline-flex size-9 items-center justify-center rounded-full text-zinc-600 hover:bg-black/5 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          <RefreshCw size={15} strokeWidth={2.25} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}

/** Pasek tygodnia: zakres, jedno zdanie ze statystyką, prev / dziś / next. */
function PlanHero({
  weekStart,
  isCurrentWeek,
  onPrev,
  onNext,
  onToday,
  stats,
}: {
  weekStart: Date
  isCurrentWeek: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  stats: { classes: number; hours: number; cancelled: number; daysWithClasses: number }
}) {
  const summary = [
    `${stats.classes} ${stats.classes === 1 ? 'zajęcie' : 'zajęć'}`,
    `${stats.hours} h`,
    stats.cancelled > 0 ? `${stats.cancelled} odwołane` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className={`truncate text-lg font-semibold leading-tight ${theme.text.primary}`}>
          {fmtWeekRange(weekStart)}
        </h1>
        <p className={`mt-0.5 text-[13px] ${theme.text.muted}`}>
          {isCurrentWeek ? 'Ten tydzień' : 'Inny tydzień'}
          {' · '}
          {summary}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          aria-label="Poprzedni tydzień"
          onClick={onPrev}
          className="inline-flex size-9 items-center justify-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-brand-ink hover:bg-black/5 dark:text-brand-gold-bright dark:hover:bg-white/10"
          >
            Dziś
          </button>
        )}
        <button
          type="button"
          aria-label="Następny tydzień"
          onClick={onNext}
          className="inline-flex size-9 items-center justify-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}

/**
 * Empty-state „Zmiany w planie" — pokazujemy gdy briefing nie zawiera żadnych
 * odwołań/zdalnych/przesunięć. Świadomie ciepły zielony akcent zamiast Sparkles
 * sugerujący „placeholder" — to jest pozytywny stan, nie brak danych.
 */
function ChangesEmptyCard() {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-3xl border p-5 sm:p-6',
        'border-zinc-200/70 bg-white/80 backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_25px_80px_-40px_rgba(15,23,42,0.20)]',
        'dark:border-white/[0.08] dark:bg-zinc-950/45',
        'dark:shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]',
      ].join(' ')}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/[0.10] blur-3xl dark:bg-emerald-400/[0.08]"
      />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/60 bg-emerald-100/80 dark:border-emerald-500/30 dark:bg-emerald-500/[0.14] sm:h-14 sm:w-14">
          <CheckCircle2
            size={22}
            strokeWidth={2.25}
            className="text-emerald-700 dark:text-emerald-300"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[16px] font-extrabold leading-tight sm:text-[18px] ${theme.text.primary}`}>
            Plan bez zmian
          </p>
          <p className={`mt-1 text-[13px] leading-relaxed sm:text-[13.5px] ${theme.text.muted}`}>
            Brak odwołań, zajęć zdalnych ani przesunięć od Twoich wykładowców
            w tym tygodniu.
          </p>
        </div>
      </div>
    </div>
  )
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function soonLabel(minutes: number): string | null {
  if (minutes <= 0) return null
  if (minutes < 60) return `za ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `za ${hours} h` : `za ${hours} h ${rest} min`
}

/** Poniedziałek–piątek zawsze, weekend tylko gdy są zajęcia. */
function visiblePlanDays(days: { date: Date; entries: TimetableEntryRow[] }[]) {
  return days.filter((d) => {
    const dow = d.date.getDay()
    if (dow === 0 || dow === 6) return d.entries.length > 0
    return true
  })
}

/** Najważniejsza informacja: godzina, nazwa, sala i prowadzący, każde w osobnej linii. */
function NowCard({
  item,
  todayCount,
}: {
  item: TodayClass | null
  todayCount: number
}) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 dark:border-white/10 dark:bg-zinc-950/50">
        <p className={`text-[15px] font-semibold ${theme.text.primary}`}>
          {todayCount > 0 ? 'Na dziś koniec' : 'Dziś bez zajęć'}
        </p>
        <p className={`mt-1 text-[13px] ${theme.text.muted}`}>
          Reszta tygodnia jest w planie poniżej.
        </p>
      </div>
    )
  }

  const cancelled = item.isCancelled
  const soon = cancelled ? null : soonLabel(item.startsInMinutes)
  return (
    <div
      className={[
        'rounded-2xl border px-5 py-4',
        cancelled
          ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/[0.08]'
          : 'border-brand-ink/20 bg-white dark:border-brand-gold-bright/25 dark:bg-zinc-950/60',
      ].join(' ')}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
          cancelled ? 'text-red-600 dark:text-red-300' : 'text-brand-ink dark:text-brand-gold-bright'
        }`}
      >
        {cancelled ? 'Odwołane' : item.startsInMinutes === 0 ? 'Teraz' : 'Następne'}
        {soon && (
          <span className="ml-2 font-semibold normal-case tracking-normal">{soon}</span>
        )}
      </p>
      <p
        className={`mt-2 font-mono text-[1.75rem] font-bold tabular-nums leading-none tracking-tight ${
          cancelled
            ? 'text-red-800 line-through dark:text-red-200'
            : 'text-brand-ink dark:text-brand-gold-bright'
        }`}
      >
        <span>{fmtHM(item.startDate)}</span>
        <span className="mx-1 font-semibold opacity-45">–</span>
        <span>{fmtHM(item.endDate)}</span>
      </p>
      <p
        className={`mt-3 text-xl font-semibold leading-snug ${
          cancelled
            ? 'text-red-800 line-through dark:text-red-200'
            : 'text-zinc-950 dark:text-zinc-50'
        }`}
      >
        {item.summary}
      </p>
      {item.location && (
        <p className={`mt-2 text-[15px] ${cancelled ? 'text-red-700 dark:text-red-200' : theme.text.primary}`}>
          {item.location}
        </p>
      )}
      {item.lecturer_name && (
        <p className={`mt-0.5 text-[14px] ${theme.text.muted}`}>{item.lecturer_name}</p>
      )}
    </div>
  )
}

/** Jedno zajęcie w planie: zakres godzin, nazwa, sala. Odwołane otwiera komunikat. */
function PlanBlock({
  entry,
  emphasized,
  large,
  onOpenCancellation,
}: {
  entry: TimetableEntryRow
  emphasized: boolean
  large: boolean
  onOpenCancellation: (announcementId: string) => void
}) {
  const start = new Date(entry.start_time)
  const end = new Date(entry.end_time)
  const isCancelled = Boolean(entry.cancelled_announcement_id)

  const handleClick = () => {
    if (isCancelled && entry.cancelled_announcement_id) {
      onOpenCancellation(entry.cancelled_announcement_id)
    }
  }

  return (
    <div
      role={isCancelled ? 'button' : undefined}
      tabIndex={isCancelled ? 0 : undefined}
      onClick={isCancelled ? handleClick : undefined}
      onKeyDown={
        isCancelled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
      className={[
        large ? 'px-4 py-3.5' : 'rounded-xl border px-2.5 py-2.5',
        isCancelled
          ? 'cursor-pointer border-red-200/80 bg-red-50 dark:border-red-500/25 dark:bg-red-500/[0.08]'
          : emphasized
            ? 'border-brand-ink/30 bg-brand-ink/[0.06] dark:border-brand-gold-bright/40 dark:bg-brand-gold-bright/[0.10]'
            : large
              ? ''
              : 'border-zinc-200/90 bg-zinc-50/90 dark:border-white/[0.08] dark:bg-white/[0.03]',
      ].join(' ')}
    >
      <p
        className={[
          'font-mono font-bold tabular-nums leading-none tracking-tight',
          large ? 'text-[15px]' : 'text-[12.5px]',
          isCancelled
            ? 'text-red-700 line-through dark:text-red-300'
            : 'text-brand-ink dark:text-brand-gold-bright',
        ].join(' ')}
      >
        <span>{fmtHM(start)}</span>
        <span className="mx-0.5 font-semibold opacity-45">–</span>
        <span>{fmtHM(end)}</span>
      </p>
      <p
        className={[
          'mt-1.5 font-semibold leading-snug',
          large ? 'text-[16px]' : 'text-[13px]',
          isCancelled
            ? 'text-red-800 line-through dark:text-red-200'
            : 'text-zinc-900 dark:text-zinc-100',
        ].join(' ')}
      >
        {entry.summary}
      </p>
      {isCancelled && (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-300">
          Odwołane
        </p>
      )}
      {entry.location && (
        <p className={`mt-1 leading-snug ${large ? 'text-[13.5px]' : 'text-[12px]'} text-zinc-600 dark:text-zinc-400`}>
          {entry.location}
        </p>
      )}
      {large && entry.lecturer_name && (
        <p className="mt-0.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-500">
          {entry.lecturer_name}
        </p>
      )}
    </div>
  )
}

/**
 * Tydzień jako plan, nie lista.
 * Desktop: siedem kolumn w jednej tabeli. Telefon: wybór dnia i jego kolumna.
 */
function WeekBoard({
  days,
  today,
  nextEntryId,
  onOpenCancellation,
}: {
  days: { date: Date; entries: TimetableEntryRow[] }[]
  today: Date
  nextEntryId: number | null
  onOpenCancellation: (announcementId: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const weekId = dayKey(days[0]?.date ?? today)

  useEffect(() => {
    setPicked(null)
  }, [weekId])

  const visible = visiblePlanDays(days)
  const fallback =
    visible.find((d) => isSameDay(d.date, today)) ??
    visible.find((d) => d.entries.length > 0) ??
    visible[0]
  const active = visible.find((d) => dayKey(d.date) === picked) ?? fallback

  return (
    <div>
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 xl:hidden">
        {visible.map(({ date, entries }) => {
          const selected = active ? isSameDay(date, active.date) : false
          const isToday = isSameDay(date, today)
          return (
            <button
              key={dayKey(date)}
              type="button"
              onClick={() => setPicked(dayKey(date))}
              aria-pressed={selected}
              className={[
                'flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-xl px-2',
                selected
                  ? 'bg-brand-ink text-white dark:bg-brand-gold-bright dark:text-zinc-950'
                  : 'border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/50',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[10px] font-bold uppercase tracking-wide',
                  selected
                    ? ''
                    : 'text-brand-ink dark:text-brand-gold-bright',
                ].join(' ')}
              >
                {isToday ? 'Dziś' : DAY_NAMES_SHORT[date.getDay()]}
              </span>
              <span
                className={[
                  'text-[15px] font-semibold tabular-nums leading-none',
                  selected ? '' : 'text-zinc-800 dark:text-zinc-100',
                ].join(' ')}
              >
                {date.getDate()}
              </span>
              <span
                className={`mt-1 size-1 rounded-full ${
                  entries.length > 0 ? 'bg-current' : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}
      </div>

      {active && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40 xl:hidden">
          {active.entries.length === 0 ? (
            <p className="px-4 py-10 text-center text-[14px] text-zinc-500">Wolne</p>
          ) : (
            active.entries.map((entry, index) => (
              <div
                key={entry.id}
                className={index > 0 ? 'border-t border-zinc-200/90 dark:border-white/10' : ''}
              >
                <PlanBlock
                  entry={entry}
                  large
                  emphasized={entry.id === nextEntryId}
                  onOpenCancellation={onOpenCancellation}
                />
              </div>
            ))
          )}
        </div>
      )}

      <div
        className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white xl:grid dark:border-white/10 dark:bg-zinc-950/40"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map(({ date, entries }, column) => {
          const isToday = isSameDay(date, today)
          return (
            <div
              key={dayKey(date)}
              className={column > 0 ? 'border-l border-zinc-200 dark:border-white/10' : ''}
            >
              <div
                className={[
                  'border-b px-2 py-2.5 text-center',
                  isToday
                    ? 'border-brand-ink/20 bg-brand-ink text-white dark:border-brand-gold-bright/30 dark:bg-brand-gold-bright dark:text-zinc-950'
                    : 'border-zinc-200 bg-brand-ink/[0.04] dark:border-white/10 dark:bg-brand-gold-bright/[0.06]',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-[11px] font-bold uppercase tracking-wide',
                    isToday ? '' : 'text-brand-ink dark:text-brand-gold-bright',
                  ].join(' ')}
                >
                  {isToday ? 'Dziś' : DAY_NAMES_SHORT[date.getDay()]}
                </p>
                <p
                  className={[
                    'mt-0.5 text-lg font-semibold tabular-nums leading-none',
                    isToday ? '' : 'text-zinc-800 dark:text-zinc-100',
                  ].join(' ')}
                >
                  {date.getDate()}
                </p>
              </div>
              <div className="flex min-h-28 flex-col gap-1.5 p-1.5">
                {entries.length === 0 ? (
                  <p className="m-auto text-[12px] text-zinc-400">wolne</p>
                ) : (
                  entries.map((entry) => (
                    <PlanBlock
                      key={entry.id}
                      entry={entry}
                      large={false}
                      emphasized={entry.id === nextEntryId}
                      onOpenCancellation={onOpenCancellation}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function MojPlanView({ userId, myProfile, cohort }: Props) {
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
  const [timetableCount, setTimetableCount] = useState<number>(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [aiOpen, setAiOpen] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const isCurrentWeek = useMemo(
    () => isSameDay(weekStart, currentWeekStart),
    [weekStart, currentWeekStart],
  )

  // Daily brief (next class + AI brief payload + announcements) — używany tylko
  // jako data source dla sekcji DZIŚ i dla AI brief modal CTA.
  const daily = useDailyBrief({ userId, cohort, myProfile })

  // Weekly briefing — zmiany, komunikaty od wykładowców, eventy, next exam.
  // Bierzemy z poziomu bieżącego briefingu (RPC ensure_weekly_briefing).
  const weekly = useWeeklyBriefing({ userId, autoEnsure: isCurrentWeek })

  const refreshCount = useCallback(async () => {
    if (!userId) {
      setTimetableCount(0)
      return
    }
    setTimetableCount(await DataService.timetableEntryCount(userId))
  }, [userId])

  useEffect(() => {
    void refreshCount()
  }, [refreshCount, refreshTick])

  const refresh = useCallback(async () => {
    if (!userId) {
      setRows([])
      return
    }
    setLoading(true)
    const data = await DataService.listTimetableForRange(weekStart, weekEnd, 168)
    setRows(data)
    setLoading(false)
  }, [userId, weekStart, weekEnd])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshTick])

  const days = useMemo(() => {
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

  const daysWithEntries = useMemo(() => days.filter((d) => d.entries.length > 0), [days])

  const stats = useMemo(() => {
    let totalMs = 0
    let cancelled = 0
    for (const r of rows) {
      totalMs += new Date(r.end_time).getTime() - new Date(r.start_time).getTime()
      if (r.cancelled_announcement_id) cancelled += 1
    }
    return {
      classes: rows.length,
      hours: Math.round(totalMs / 3_600_000),
      cancelled,
      daysWithClasses: daysWithEntries.length,
    }
  }, [rows, daysWithEntries.length])

  const hasAiContent =
    daily.classes.length > 0 || daily.tasks.length > 0 || daily.announcements.length > 0
  const showAiCta = isCurrentWeek && hasAiContent

  const startAi = useCallback(() => {
    return DailyBriefService.generateBrief(daily.toBriefPayload())
  }, [daily])

  const handleRefreshAll = useCallback(async () => {
    setRefreshTick((t) => t + 1)
    await Promise.all([daily.refresh(), weekly.refresh()])
  }, [daily, weekly])

  if (!userId) {
    return (
      <div className="py-16">
        <EmptyState
          icon={CalendarDays}
          title="Mój Plan jest niedostępny"
          subtitle="Zaloguj się, żeby zaimportować plan zajęć i widzieć go w jednym miejscu."
        />
      </div>
    )
  }

  // Brak planu — dramatyczny hero CTA + import
  if (timetableCount === 0) {
    return (
      <div className="space-y-8">
        <div
          className={[
            'relative overflow-hidden rounded-2xl border px-5 py-8 text-center sm:px-8',
            'border-zinc-200/70 bg-white/80 backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_50px_120px_-50px_rgba(15,23,42,0.45)] ring-1 ring-zinc-900/5',
            'dark:border-white/10 dark:bg-zinc-950/50',
            'dark:shadow-[0_50px_120px_-50px_rgba(0,0,0,0.95)]',
          ].join(' ')}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-ink/[0.08] blur-3xl dark:bg-brand-gold-bright/[0.12]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-brand-ink/[0.05] blur-3xl dark:bg-brand-gold-bright/[0.08]"
          />
          <div className="relative">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-brand-ink/25 bg-brand-ink/[0.07] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.10]">
              <CalendarDays size={22} className="text-brand-ink dark:text-brand-gold-bright" strokeWidth={2.25} />
            </div>
            <h1 className={`text-2xl font-semibold tracking-tight ${theme.text.primary}`}>
              Twój plan w jednym miejscu
            </h1>
            <p className={`mx-auto mt-4 max-w-2xl text-[14.5px] leading-relaxed sm:text-[16px] ${theme.text.muted}`}>
              Wklej link z USOSweb (Mój USOSweb → Mój plan zajęć → eksport
              planu), a zobaczysz piękny tydzień, automatyczne powiadomienia
              o odwołaniach, komunikaty od wykładowców i wydarzenia UJ w jednym
              widoku.
            </p>
          </div>
        </div>

        <ImportTimetablePanel
          userId={userId}
          existingCount={timetableCount}
          onImported={() => setRefreshTick((t) => t + 1)}
          onCleared={() => setRefreshTick((t) => t + 1)}
        />
      </div>
    )
  }

  const handleOpenCancellation = (announcementId: string) => {
    navigate(`/moj-plan?announcement=${announcementId}`)
  }

  return (
    <div className="space-y-5">
      {/* 1. GREETING — datę + powitanie + AI brief / refresh */}
      <GreetingBar
        myProfile={myProfile}
        onRefresh={() => void handleRefreshAll()}
        refreshing={loading || daily.loading || weekly.loading}
        onOpenAi={() => setAiOpen(true)}
        showAiCta={showAiCta}
      />

      {isCurrentWeek && (
        <NowCard item={daily.nextClass} todayCount={daily.classes.length} />
      )}

      <section className="space-y-3">
        <PlanHero
          weekStart={weekStart}
          isCurrentWeek={isCurrentWeek}
          onPrev={() => setWeekStart(addDays(weekStart, -7))}
          onNext={() => setWeekStart(addDays(weekStart, 7))}
          onToday={() => setWeekStart(currentWeekStart)}
          stats={stats}
        />

        {loading && rows.length === 0 ? (
          <div className="h-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-white/[0.04]" />
        ) : daysWithEntries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-14 text-center dark:border-white/10 dark:bg-zinc-950/40">
            <p className={`text-xl font-semibold ${theme.text.primary}`}>Wolny tydzień</p>
            <p className={`mt-2 text-[14px] ${theme.text.muted}`}>Brak zajęć w tym tygodniu.</p>
          </div>
        ) : (
          <WeekBoard
            days={days}
            today={today}
            nextEntryId={isCurrentWeek ? daily.nextClass?.id ?? null : null}
            onOpenCancellation={handleOpenCancellation}
          />
        )}
      </section>

      {isCurrentWeek && (weekly.briefing || weekly.error) && (
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          className="text-left text-[13px] font-semibold text-brand-ink underline-offset-2 hover:underline lg:hidden dark:text-brand-gold-bright"
        >
          {extrasOpen ? 'Zwiń terminy i zmiany' : 'Terminy, zmiany i wydarzenia'}
        </button>
      )}

      <div className={extrasOpen ? 'space-y-5' : 'hidden space-y-5 lg:block'}>
      {/* Terminy, zmiany, komunikaty, eventy — na telefonie za zwinięciem */}
      {weekly.briefing && isCurrentWeek && (
        <>
          {weekly.briefing.payload.next_exam && (
            <section className="space-y-3">
              <SectionHeader icon={GraduationCap} title="Najbliższy termin" />
              <div
                className={[
                  'relative overflow-hidden rounded-3xl border p-6 sm:p-8',
                  'border-brand-ink/30 bg-gradient-to-br from-brand-ink/[0.06] via-white/80 to-white/80 backdrop-blur-xl',
                  'shadow-[0_25px_80px_-40px_rgba(15,23,42,0.30)]',
                  'dark:border-brand-gold-bright/40 dark:from-brand-gold-bright/[0.10] dark:via-zinc-950/55 dark:to-zinc-950/55',
                  'dark:shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className={`text-lg font-semibold leading-snug ${theme.text.primary}`}>
                      {weekly.briefing.payload.next_exam.title}
                    </p>
                    <p className={`mt-2 text-[13.5px] ${theme.text.muted} sm:text-[14.5px]`}>
                      {fmtDayDate(weekly.briefing.payload.next_exam.starts_at)}
                      {weekly.briefing.payload.next_exam.location
                        ? ` · ${weekly.briefing.payload.next_exam.location}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center rounded-2xl bg-brand-ink px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.55)] dark:bg-brand-gold-bright dark:text-black dark:shadow-[0_12px_30px_-12px_rgba(232,200,74,0.55)]">
                      {weekly.briefing.payload.next_exam.days_away === 0
                        ? 'Dzisiaj'
                        : weekly.briefing.payload.next_exam.days_away === 1
                          ? 'Jutro'
                          : `Za ${weekly.briefing.payload.next_exam.days_away} dni`}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <SectionHeader
              icon={AlertTriangle}
              title="Zmiany w planie"
              count={weekly.briefing.payload.changes.length}
              subtitle={weekly.briefing.payload.changes.length > 0 ? undefined : 'wszystko OK'}
            />
            {weekly.briefing.payload.changes.length === 0 ? (
              <ChangesEmptyCard />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {weekly.briefing.payload.changes.map((c) => {
                  const tone = KIND_TONE[c.kind]
                  return (
                    <li key={c.id} className={`${GLASS_PANEL_CLS} flex items-start gap-3`}>
                      <span className={`mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${tone.chip} ${tone.chipText}`}
                          >
                            {KIND_LABELS[c.kind]}
                          </span>
                          <span className={`text-[12px] ${theme.text.muted}`}>
                            {fmtDayDate(c.starts_at)}
                            {!c.all_day ? ` · ${fmtHMIso(c.starts_at)}–${fmtHMIso(c.ends_at)}` : ''}
                          </span>
                        </div>
                        <p className={`mt-2 text-[15px] font-bold leading-snug ${theme.text.primary}`}>
                          {c.title}
                        </p>
                        {c.lecturer_name && (
                          <p className={`mt-0.5 text-[12px] ${theme.text.muted}`}>{c.lecturer_name}</p>
                        )}
                        {c.description && (
                          <p className={`mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed ${theme.text.muted}`}>
                            {c.description}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {weekly.briefing.payload.announcements_from_subscribed.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={Megaphone}
                title="Od Twoich wykładowców"
                count={weekly.briefing.payload.announcements_from_subscribed.length}
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {weekly.briefing.payload.announcements_from_subscribed.map((a) => (
                  <li key={a.id} className={GLASS_PANEL_CLS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                          a.status === 'cancelled'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/[0.18] dark:text-red-200'
                            : a.status === 'remote'
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/[0.18] dark:text-sky-200'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/[0.18] dark:text-emerald-200'
                        }`}
                      >
                        {a.status === 'cancelled'
                          ? 'odwołane'
                          : a.status === 'remote'
                            ? 'zdalne'
                            : 'dyżur'}
                      </span>
                      <span className={`text-[13px] font-bold ${theme.text.primary}`}>
                        {a.lecturer_name}
                      </span>
                      <span className={`text-[11.5px] ${theme.text.muted}`}>
                        · {fmtDayDate(a.created_at)}
                      </span>
                    </div>
                    <p className={`mt-2 line-clamp-3 text-[13px] leading-relaxed ${theme.text.muted}`}>
                      {a.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weekly.briefing.payload.official_events.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={CalendarClock}
                title="Eventy UJ w tym tygodniu"
                count={weekly.briefing.payload.official_events.length}
              />
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {weekly.briefing.payload.official_events.map((ev) => (
                  <li key={ev.id} className={GLASS_PANEL_CLS}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[11.5px] font-semibold ${theme.text.muted}`}>
                        {fmtDayDate(ev.starts_at)}
                        {!ev.all_day ? ` · ${fmtHMIso(ev.starts_at)}` : ''}
                      </span>
                      {ev.department && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                          {ev.department}
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 text-[14px] font-bold leading-snug ${theme.text.primary}`}>
                      {ev.title}
                    </p>
                    {ev.location && (
                      <p className={`mt-1 text-[12px] ${theme.text.muted}`}>{ev.location}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </>
      )}

      {weekly.error && isCurrentWeek && (
        <div className={`${GLASS_PANEL_CLS} text-[13px] text-red-600 dark:text-red-400/90`}>
          {weekly.error}
        </div>
      )}
      </div>

      {/* Import planu zostaje na wierzchu — to jedyna droga, żeby lista żyła. */}
      <div className="pt-4">
        <ImportTimetablePanel
          userId={userId}
          existingCount={timetableCount}
          onImported={() => setRefreshTick((t) => t + 1)}
          onCleared={() => setRefreshTick((t) => t + 1)}
        />
      </div>

      {/* AI brief modal */}
      {aiOpen && (
        <Suspense fallback={null}>
          <AiInsightModal
            title="AI brief dnia"
            subtitle={fmtTodayLong(new Date())}
            start={startAi}
            onClose={() => setAiOpen(false)}
            fallbackErrorMessage="Nie udało się wygenerować briefu. Spróbuj za chwilę."
          />
        </Suspense>
      )}
    </div>
  )
}
