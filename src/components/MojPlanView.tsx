/**
 * UJverse — „Mój Plan": unified hub akademicki.
 *
 * Świadomie ZASTĘPUJE `/dzis` + `/briefing` + (stary) `/moj-plan`. Wszystko
 * akademickie w jednym miejscu, w kolejności od najbardziej zaktualizowanego
 * do tła:
 *
 *   1. Greeting bar (powitanie + data + AI brief CTA)
 *   2. Hero tygodnia (zakres + 4 stat-kafle + nav prev/dziś/next)
 *   3. (gdy current week) DZIŚ — najbliższe zajęcia + status dnia
 *   4. Plan tygodnia — dni z zajęciami jako szklane bilety
 *   5. Najbliższy termin (egzamin) — wyróżniona karta
 *   6. Zmiany w planie (z tygodniowego briefingu)
 *   7. Komunikaty od Twoich wykładowców
 *   8. Eventy UJ w tym tygodniu
 *   9. Import / aktualizuj plan z USOSweb
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
  Clock,
  Coffee,
  GraduationCap,
  MapPin,
  Megaphone,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  TrendingUp,
  X as XIcon,
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
  fmtHours as fmtHoursBriefing,
  KIND_LABELS,
  KIND_TONE,
} from './briefing/briefingFormat'
import type { TimetableEntryRow } from '../services/adapters/TimetableAdapter'
import type { TodayClass } from '../hooks/useTodayClasses'
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
function durationLabel(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m}m`
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
function startsInLabel(c: TodayClass): string {
  if (c.startsInMinutes === -1) return 'Skończone'
  if (c.startsInMinutes === 0) return 'Trwa teraz'
  if (c.startsInMinutes < 60) return `Za ${c.startsInMinutes} min`
  const h = Math.floor(c.startsInMinutes / 60)
  const m = c.startsInMinutes % 60
  return m === 0 ? `Za ${h} h` : `Za ${h} h ${m} min`
}

// ─── Shared glass tokens ────────────────────────────────────────────────────
const GLASS_HERO_CLS = [
  'relative overflow-hidden rounded-[28px] border p-8 sm:p-10 md:p-12 lg:p-14',
  'border-zinc-200/80 bg-white/85 backdrop-blur-2xl backdrop-saturate-150',
  'shadow-[0_50px_120px_-50px_rgba(15,23,42,0.45)] ring-1 ring-zinc-900/5',
  'dark:border-white/10 dark:bg-zinc-950/55',
  'dark:shadow-[0_50px_120px_-50px_rgba(0,0,0,0.95)] dark:ring-white/[0.04]',
].join(' ')

const GLASS_PANEL_CLS = [
  'relative overflow-hidden rounded-2xl border p-4 sm:p-5',
  'border-zinc-200/70 bg-white/75 backdrop-blur-xl backdrop-saturate-150',
  'shadow-[0_18px_60px_-30px_rgba(15,23,42,0.25)]',
  'dark:border-white/[0.07] dark:bg-zinc-950/45',
  'dark:shadow-[0_25px_70px_-30px_rgba(0,0,0,0.9)]',
].join(' ')

const SECTION_TITLE_CLS =
  'flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.24em] text-[#1e293b] dark:text-brand-gold-bright sm:text-[13px]'
const SECTION_BADGE_CLS =
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums ' +
  'border-[#1e293b]/25 bg-[#1e293b]/[0.06] text-[#1e293b] ' +
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
        <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.24em] text-[#1e293b] dark:text-brand-gold-bright sm:text-[11.5px]">
          <SalIcon size={12} strokeWidth={2.5} />
          {todayLabel}
        </div>
        <p className={`mt-1 text-[18px] font-extrabold leading-tight sm:text-[22px] ${theme.text.primary}`}>
          {greeting ? `${salutation.hello}, ${greeting}!` : salutation.hello}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {showAiCta && (
          <button
            type="button"
            onClick={onOpenAi}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1e293b] px-4 text-[12px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_10px_28px_-12px_rgba(15,23,42,0.55)] transition-colors hover:bg-[#1e293b]/90 dark:bg-brand-gold-bright dark:text-black dark:shadow-[0_10px_28px_-12px_rgba(232,200,74,0.55)] dark:hover:bg-brand-gold-bright/90"
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
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/70 text-zinc-700 backdrop-blur-md transition-colors hover:bg-white hover:text-zinc-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
        >
          <RefreshCw size={15} strokeWidth={2.25} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}

/**
 * Wielka hero karta tygodnia — dramatyczna „okładka": zakres dat (gigantyczne
 * typo), 4 stat-kafle (zajęcia / godziny / odwołane / aktywne dni) i kontrolki
 * nawigacji prev / dziś / next.
 */
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
  return (
    <div className={GLASS_HERO_CLS}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#1e293b]/[0.08] blur-3xl dark:bg-brand-gold-bright/[0.12]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-[#1e293b]/[0.05] blur-3xl dark:bg-brand-gold-bright/[0.08]"
      />

      <div className="relative flex flex-col gap-8 lg:gap-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.28em] text-[#1e293b] dark:text-brand-gold-bright sm:text-[12px]">
              <CalendarDays size={13} strokeWidth={2.5} />
              {isCurrentWeek ? 'Bieżący tydzień' : 'Plan tygodnia'}
            </div>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl md:text-7xl lg:text-8xl">
              {fmtWeekRange(weekStart)}
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
              Twój plan zajęć, zmiany od wykładowców i terminy w jednym widoku.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Poprzedni tydzień"
              onClick={onPrev}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/70 text-zinc-700 backdrop-blur-md transition-colors hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={onToday}
                className="inline-flex h-11 items-center rounded-2xl border border-[#1e293b]/30 bg-[#1e293b]/[0.07] px-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#1e293b] transition-colors hover:bg-[#1e293b]/12 dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/18"
              >
                Dziś
              </button>
            )}
            <button
              type="button"
              aria-label="Następny tydzień"
              onClick={onNext}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/70 text-zinc-700 backdrop-blur-md transition-colors hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <ChevronRight size={20} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          <StatTile icon={CalendarDays} value={stats.classes} label="zajęć" />
          <StatTile icon={Clock} value={`${stats.hours}h`} label="godzin" isText />
          <StatTile
            icon={XIcon}
            value={stats.cancelled}
            label="odwołanych"
            tone={stats.cancelled > 0 ? 'danger' : 'neutral'}
          />
          <StatTile icon={TrendingUp} value={stats.daysWithClasses} label="dni z zajęciami" />
        </div>
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  value,
  label,
  isText = false,
  tone = 'neutral',
}: {
  icon: LucideIcon
  value: number | string
  label: string
  isText?: boolean
  tone?: 'neutral' | 'danger'
}) {
  const toneCls =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-300'
      : 'text-[#1e293b] dark:text-brand-gold-bright'
  return (
    <div
      className={[
        'group relative overflow-hidden rounded-3xl border p-5 sm:p-6',
        'border-zinc-200/60 bg-white/70 backdrop-blur-md',
        'dark:border-white/[0.07] dark:bg-white/[0.03]',
        'transition-colors hover:border-[#1e293b]/25 dark:hover:border-brand-gold-bright/30',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
          {label}
        </p>
        <Icon size={14} strokeWidth={2.5} className={`shrink-0 ${toneCls}`} />
      </div>
      <p
        className={`mt-3 text-4xl font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl lg:text-6xl ${toneCls}`}
      >
        {isText ? value : String(value)}
      </p>
    </div>
  )
}

/**
 * Empty-state „Dziś" — dwie odmiany:
 *  - `free`:  brak zajęć w ogóle dziś (lajt dzień)
 *  - `done`:  były zajęcia, wszystkie skończone (dzień zamknięty)
 *
 * Świadomie BEZ ikony Sparkles — była identyczna jak w innych sekcjach
 * i wyglądała jak placeholder. Tu daje większy, bardziej „dashboardowy"
 * akcent z kolorowanym tile-em po lewej.
 */
function TodayEmptyCard({
  variant,
  todayClassesCount,
  doneTodayCount,
}: {
  variant: 'free' | 'done'
  todayClassesCount: number
  doneTodayCount: number
}) {
  const isFree = variant === 'free'
  const Icon = isFree ? Coffee : CheckCircle2
  const title = isFree ? 'Lajt dzień' : 'Dzień zamknięty'
  const description = isFree
    ? 'Brak zaplanowanych zajęć. Dobry moment, żeby zająć się tym, co naprawdę ważne.'
    : todayClassesCount > 0
      ? `Wszystkie ${doneTodayCount} ${doneTodayCount === 1 ? 'zajęcia' : 'zajęcia'} na dziś za Tobą. Plan tygodnia poniżej.`
      : 'Wszystkie zajęcia na dziś za nami. Plan tygodnia poniżej.'

  const accent = isFree
    ? {
        tileBg: 'bg-emerald-100/80 dark:bg-emerald-500/[0.14]',
        tileBorder: 'border-emerald-300/60 dark:border-emerald-500/30',
        tileIcon: 'text-emerald-700 dark:text-emerald-300',
        ringGlow:
          'bg-emerald-400/[0.10] dark:bg-emerald-400/[0.10]',
      }
    : {
        tileBg: 'bg-zinc-100/80 dark:bg-white/[0.05]',
        tileBorder: 'border-zinc-200/80 dark:border-white/[0.08]',
        tileIcon: 'text-zinc-600 dark:text-zinc-300',
        ringGlow:
          'bg-zinc-400/[0.08] dark:bg-zinc-300/[0.04]',
      }

  return (
    <div
      className={[
        'relative overflow-hidden rounded-3xl border p-5 sm:p-6 md:p-7',
        'border-zinc-200/70 bg-white/80 backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_25px_80px_-40px_rgba(15,23,42,0.25)]',
        'dark:border-white/[0.08] dark:bg-zinc-950/45',
        'dark:shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]',
      ].join(' ')}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl ${accent.ringGlow}`}
      />
      <div className="relative flex items-center gap-4 sm:gap-5">
        <div
          className={[
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border sm:h-16 sm:w-16',
            accent.tileBg,
            accent.tileBorder,
          ].join(' ')}
        >
          <Icon size={26} strokeWidth={2.25} className={accent.tileIcon} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[18px] font-extrabold leading-tight sm:text-[22px] ${theme.text.primary}`}
          >
            {title}
          </p>
          <p
            className={`mt-1 text-[13.5px] leading-relaxed sm:text-[14.5px] ${theme.text.muted}`}
          >
            {description}
          </p>
        </div>
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

/**
 * „Dziś" — sekcja z najbliższym (lub trwającym) zajęciem dnia. Renderowana
 * TYLKO gdy jesteśmy na bieżącym tygodniu. Pokazuje highlight kursu, progress
 * bar dnia i meta (lokacja, prowadzący).
 */
function TodaySection({
  nextClass,
  cancelledTodayCount,
  todayClassesCount,
  doneTodayCount,
}: {
  nextClass: TodayClass | null
  cancelledTodayCount: number
  todayClassesCount: number
  doneTodayCount: number
}) {
  const progressPct =
    todayClassesCount > 0 ? Math.round((doneTodayCount / todayClassesCount) * 100) : 0

  if (!nextClass) {
    const isFreeDay = cancelledTodayCount === 0 && todayClassesCount === 0
    return (
      <section className="space-y-3">
        <SectionHeader
          icon={Sun}
          title="Dziś"
          subtitle={isFreeDay ? 'lajt dzień' : 'dzień skończony'}
        />
        <TodayEmptyCard
          variant={isFreeDay ? 'free' : 'done'}
          todayClassesCount={todayClassesCount}
          doneTodayCount={doneTodayCount}
        />
      </section>
    )
  }

  const isLive = nextClass.startsInMinutes === 0
  const isImminent = nextClass.startsInMinutes >= 0 && nextClass.startsInMinutes <= 30
  const isCancelled = nextClass.isCancelled

  return (
    <section className="space-y-3">
      <SectionHeader
        icon={Sun}
        title="Dziś"
        subtitle={isLive ? 'trwa teraz' : isImminent ? 'za chwilę' : 'nadchodzi'}
      />
      <div
        className={[
          'relative overflow-hidden rounded-3xl border p-6 sm:p-8',
          'backdrop-blur-xl backdrop-saturate-150',
          isCancelled
            ? 'border-red-300/70 bg-red-50/75 dark:border-red-500/30 dark:bg-red-500/[0.06]'
            : 'border-zinc-200/70 bg-white/85 dark:border-white/[0.09] dark:bg-zinc-950/50',
          isImminent && !isCancelled
            ? 'ring-1 ring-[#1e293b]/30 dark:ring-brand-gold-bright/35'
            : '',
          'shadow-[0_30px_90px_-40px_rgba(15,23,42,0.30)] dark:shadow-[0_35px_100px_-40px_rgba(0,0,0,0.95)]',
        ].join(' ')}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#1e293b]/[0.05] blur-3xl dark:bg-brand-gold-bright/[0.10]"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Clock size={14} strokeWidth={2.25} className="text-[#1e293b] dark:text-brand-gold-bright" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright">
              {isLive ? 'Trwa teraz' : 'Najbliższe zajęcia'}
            </span>
            {isLive && (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            {cancelledTodayCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
                {cancelledTodayCount} odwołane
              </span>
            )}
          </div>

          <h2
            className={`mt-2 text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl ${
              isCancelled
                ? 'text-red-800 line-through decoration-red-400/60 dark:text-red-100'
                : theme.text.primary
            }`}
          >
            {nextClass.summary}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] sm:text-[14.5px]">
            <span className="inline-flex items-center gap-1.5 font-extrabold tabular-nums text-[#1e293b] dark:text-brand-gold-bright">
              <Clock size={14} strokeWidth={2.5} />
              {startsInLabel(nextClass)}
            </span>
            <span className={`tabular-nums font-mono ${theme.text.muted}`}>
              {fmtHM(nextClass.startDate)}–{fmtHM(nextClass.endDate)}
            </span>
            {nextClass.location && (
              <span className={`inline-flex min-w-0 items-center gap-1.5 ${theme.text.muted}`}>
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{nextClass.location}</span>
              </span>
            )}
            {nextClass.lecturer_name && (
              <span className={`inline-flex items-center gap-1.5 ${theme.text.muted}`}>
                <GraduationCap size={13} className="shrink-0" />
                {nextClass.lecturer_name}
              </span>
            )}
          </div>

          {progressPct > 0 && todayClassesCount > 0 && (
            <div className="mt-5">
              <div className={`mb-1.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.2em] ${theme.text.muted}`}>
                <span>Postęp dnia · {doneTodayCount} z {todayClassesCount}</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1e293b] to-[#1e293b]/60 transition-all duration-500 dark:from-brand-gold-bright dark:to-brand-gold-bright/60"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * Pojedyncze zajęcie w timetable — wielki szklany bilet z czasówką po lewej
 * i meta po prawej (lokacja + prowadzący). Cancelled = czerwone + clickable
 * (deep-link do komunikatu).
 */
function ClassTicket({
  entry,
  onOpenCancellation,
}: {
  entry: TimetableEntryRow
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

  const cardCls = [
    'group relative overflow-hidden rounded-3xl border',
    'backdrop-blur-xl backdrop-saturate-150',
    isCancelled
      ? 'border-red-300/70 bg-red-50/75 dark:border-red-500/30 dark:bg-red-500/[0.06]'
      : 'border-zinc-200/70 bg-white/80 dark:border-white/[0.09] dark:bg-zinc-950/45',
    'shadow-[0_25px_80px_-40px_rgba(15,23,42,0.30)] dark:shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]',
    'transition-all duration-150',
    isCancelled
      ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/[0.10] hover:-translate-y-px'
      : 'hover:border-[#1e293b]/25 dark:hover:border-brand-gold-bright/30',
  ].join(' ')

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
      className={cardCls}
    >
      <div className="flex">
        <div
          className={[
            'flex flex-col items-center justify-center gap-2 border-r px-5 py-6 sm:px-7 sm:py-7 md:px-8 md:py-8',
            isCancelled
              ? 'border-red-200/70 bg-red-100/55 dark:border-red-500/22 dark:bg-red-500/[0.10]'
              : 'border-zinc-200/70 bg-zinc-50/80 dark:border-white/[0.07] dark:bg-white/[0.025]',
          ].join(' ')}
        >
          <span
            className={`font-mono text-2xl font-extrabold tabular-nums leading-none sm:text-3xl md:text-4xl ${
              isCancelled
                ? 'text-red-700 line-through decoration-red-400/60 dark:text-red-200'
                : 'text-zinc-900 dark:text-zinc-50'
            }`}
          >
            {fmtHM(start)}
          </span>
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
            <span className="inline-block h-px w-3 bg-current opacity-50" />
            {durationLabel(end.getTime() - start.getTime())}
            <span className="inline-block h-px w-3 bg-current opacity-50" />
          </div>
          <span
            className={`font-mono text-base font-semibold tabular-nums leading-none sm:text-lg md:text-xl ${
              isCancelled
                ? 'text-red-600/70 line-through dark:text-red-300/70'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {fmtHM(end)}
          </span>
        </div>

        <div className="min-w-0 flex-1 px-5 py-5 sm:px-7 sm:py-6 md:px-8 md:py-7">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={`min-w-0 text-lg font-extrabold leading-tight sm:text-xl md:text-2xl ${
                isCancelled
                  ? 'text-red-800 line-through decoration-red-400/60 dark:text-red-100'
                  : 'text-zinc-900 dark:text-zinc-50'
              }`}
            >
              {entry.summary}
            </h3>
            {isCancelled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_8px_22px_-8px_rgba(220,38,38,0.6)] dark:bg-red-500">
                <XIcon size={10} strokeWidth={3} />
                odwołane
              </span>
            )}
          </div>

          {(entry.location || entry.lecturer_name) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-400 sm:text-[14px]">
              {entry.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} strokeWidth={2} className="text-[#1e293b]/70 dark:text-brand-gold-bright/75" />
                  <span className="font-medium">{entry.location}</span>
                </span>
              )}
              {entry.lecturer_name && (
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap size={13} strokeWidth={2} className="text-[#1e293b]/70 dark:text-brand-gold-bright/75" />
                  <span className="font-medium">{entry.lecturer_name}</span>
                </span>
              )}
            </div>
          )}

          {isCancelled && entry.cancelled_announcement_body && (
            <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-red-900/90 dark:text-red-200/90 sm:text-[13.5px]">
              {entry.cancelled_announcement_body.replace(/\s+/g, ' ').trim()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function DayBlock({
  date,
  isToday,
  isPast,
  entries,
  onOpenCancellation,
}: {
  date: Date
  isToday: boolean
  isPast: boolean
  entries: TimetableEntryRow[]
  onOpenCancellation: (announcementId: string) => void
}) {
  return (
    <div
      className={`grid grid-cols-[80px_1fr] gap-4 sm:grid-cols-[110px_1fr] sm:gap-6 lg:grid-cols-[140px_1fr] lg:gap-8 ${
        isPast && !isToday ? 'opacity-55' : ''
      }`}
    >
      <div className="flex flex-col items-start gap-1 pt-3 sm:pt-4">
        <span
          className={`text-[11px] font-bold uppercase tracking-[0.22em] sm:text-[12px] ${
            isToday
              ? 'text-[#1e293b] dark:text-brand-gold-bright'
              : 'text-zinc-500 dark:text-zinc-500'
          }`}
        >
          {isToday ? 'Dziś' : DAY_NAMES_SHORT[date.getDay()]}
        </span>
        <span
          className={`text-5xl font-extrabold leading-none tabular-nums sm:text-6xl lg:text-7xl ${
            isToday
              ? 'text-[#1e293b] dark:text-brand-gold-bright'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {date.getDate()}
        </span>
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500 sm:text-[12px]">
          {MONTH_NAMES_GENITIVE[date.getMonth()].slice(0, 3)}
        </span>
      </div>
      <div className="space-y-3 sm:space-y-3.5">
        {entries.map((entry) => (
          <ClassTicket key={entry.id} entry={entry} onOpenCancellation={onOpenCancellation} />
        ))}
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

  const doneTodayCount = useMemo(
    () => daily.classes.filter((c) => c.startsInMinutes === -1 && !c.isCancelled).length,
    [daily.classes],
  )
  const todayActiveCount = useMemo(
    () => daily.classes.filter((c) => !c.isCancelled).length,
    [daily.classes],
  )

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
            'relative overflow-hidden rounded-[28px] border p-10 text-center sm:p-16 md:p-20',
            'border-zinc-200/70 bg-white/80 backdrop-blur-2xl backdrop-saturate-150',
            'shadow-[0_50px_120px_-50px_rgba(15,23,42,0.45)] ring-1 ring-zinc-900/5',
            'dark:border-white/10 dark:bg-zinc-950/50',
            'dark:shadow-[0_50px_120px_-50px_rgba(0,0,0,0.95)]',
          ].join(' ')}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#1e293b]/[0.08] blur-3xl dark:bg-brand-gold-bright/[0.12]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-[#1e293b]/[0.05] blur-3xl dark:bg-brand-gold-bright/[0.08]"
          />
          <div className="relative">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#1e293b]/25 bg-[#1e293b]/[0.07] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.10]">
              <CalendarDays size={36} className="text-[#1e293b] dark:text-brand-gold-bright" strokeWidth={2.25} />
            </div>
            <h1 className={`text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl ${theme.text.primary}`}>
              Twój plan — w jednym miejscu
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
    <div className="space-y-8 sm:space-y-10">
      {/* 1. GREETING — datę + powitanie + AI brief / refresh */}
      <GreetingBar
        myProfile={myProfile}
        onRefresh={() => void handleRefreshAll()}
        refreshing={loading || daily.loading || weekly.loading}
        onOpenAi={() => setAiOpen(true)}
        showAiCta={showAiCta}
      />

      {/* 2. HERO — okładka tygodnia */}
      <PlanHero
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
        onToday={() => setWeekStart(currentWeekStart)}
        stats={stats}
      />

      {/* 3. DZIŚ — tylko gdy bieżący tydzień */}
      {isCurrentWeek && (
        <TodaySection
          nextClass={daily.nextClass}
          cancelledTodayCount={daily.cancelledTodayCount}
          todayClassesCount={todayActiveCount}
          doneTodayCount={doneTodayCount}
        />
      )}

      {/* 4. TYDZIEŃ — lista dni */}
      <section className="space-y-3">
        <SectionHeader
          icon={CalendarClock}
          title="Plan tygodnia"
          subtitle={
            daysWithEntries.length === 0
              ? 'wolne'
              : `${daysWithEntries.length} ${daysWithEntries.length === 1 ? 'dzień' : 'dni'}`
          }
        />

        {loading && rows.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-3xl bg-zinc-100 dark:bg-white/[0.04]"
              />
            ))}
          </div>
        ) : daysWithEntries.length === 0 ? (
          <div
            className={[
              'rounded-3xl border px-6 py-16 text-center',
              'border-zinc-200/70 bg-white/65 backdrop-blur-md',
              'dark:border-white/[0.07] dark:bg-zinc-950/40',
            ].join(' ')}
          >
            <p className={`text-2xl font-extrabold ${theme.text.primary}`}>Wolny tydzień</p>
            <p className={`mt-2 text-[14px] ${theme.text.muted}`}>
              Brak zajęć w tym tygodniu.
            </p>
          </div>
        ) : (
          <div className="space-y-5 sm:space-y-7">
            {daysWithEntries.map(({ date, entries }) => (
              <DayBlock
                key={date.toISOString()}
                date={date}
                isToday={isSameDay(date, today)}
                isPast={date.getTime() < today.getTime()}
                entries={entries}
                onOpenCancellation={handleOpenCancellation}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5–8: WEEKLY BRIEFING — next exam, zmiany, komunikaty, eventy */}
      {weekly.briefing && isCurrentWeek && (
        <>
          {weekly.briefing.payload.next_exam && (
            <section className="space-y-3">
              <SectionHeader icon={GraduationCap} title="Najbliższy termin" />
              <div
                className={[
                  'relative overflow-hidden rounded-3xl border p-6 sm:p-8',
                  'border-[#1e293b]/30 bg-gradient-to-br from-[#1e293b]/[0.06] via-white/80 to-white/80 backdrop-blur-xl',
                  'shadow-[0_25px_80px_-40px_rgba(15,23,42,0.30)]',
                  'dark:border-brand-gold-bright/40 dark:from-brand-gold-bright/[0.10] dark:via-zinc-950/55 dark:to-zinc-950/55',
                  'dark:shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)]',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className={`text-2xl font-extrabold leading-tight ${theme.text.primary} sm:text-3xl`}>
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
                    <span className="inline-flex items-center rounded-2xl bg-[#1e293b] px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.55)] dark:bg-brand-gold-bright dark:text-black dark:shadow-[0_12px_30px_-12px_rgba(232,200,74,0.55)]">
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

          {/* Stats meta — krótki znacznik briefingu (zniknie po sygnaturze
              "ostatnio zaktualizowano"), żeby kontekst nie zniknął całkiem. */}
          <p className={`text-center text-[11px] ${theme.text.muted}`}>
            Briefing zaktualizowany {new Date(weekly.briefing.generated_at).toLocaleString('pl-PL')} ·{' '}
            tydzień: {fmtHoursBriefing(weekly.briefing.payload.classes.hours)} ·{' '}
            {weekly.briefing.payload.classes.cancelled} odwołanych
          </p>
        </>
      )}

      {/* Weekly briefing error — pokazujemy tylko gdy current week, żeby nie
          straszyć usera na historycznych podglądach. */}
      {weekly.error && isCurrentWeek && (
        <div className={`${GLASS_PANEL_CLS} text-[13px] text-red-600 dark:text-red-400/90`}>
          {weekly.error}
        </div>
      )}

      {/* 9. IMPORT — utility band na dole */}
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
