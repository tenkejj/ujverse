/**
 * UJverse — DzisView: "Morning brief" strona główna studenta.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Cel produktowy: zastąpić ranne otwarcie USOSweb. Jeden ekran = całokształt
 * dnia (zajęcia + deadliney Aula + świeże ogłoszenia + AI summary).
 *
 * Layout (PC ≥ lg, mobile-first):
 *   ── Greeting bar — pora dnia + imię + odśwież
 *   ── Stats strip — 4 metryki (zajęcia / odwołane / zadania / ogłoszenia)
 *
 *   ┌─────────────────────────┐  ┌────────────────────┐
 *   │  Hero NextClass (2/3)   │  │  Side panel (1/3): │
 *   │  + day progress bar     │  │  - "Co dalej"      │
 *   │  + quick AI prompts     │  │  - Wolne okna      │
 *   └─────────────────────────┘  │  - Quick links     │
 *                                 └────────────────────┘
 *   ┌── Tasks ──────┐ ┌── Announcements ──┐
 *   └───────────────┘ └───────────────────┘
 *   ┌── Pełny plan dnia ─────────────────────────────┐
 *
 * Routing:
 *   - `/dzis` z deep-link supportem do announcement drawer (`?announcement=X`)
 *
 * Brak query-state-management — wszystko snapshot-friendly z useDailyBrief.
 * Layout (max-w + padding) trzyma `<main>` w `App.tsx` — bez wewnętrznego
 * `mx-auto max-w-*`.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  Coffee,
  Compass,
  Headphones,
  MapPin,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  Sunrise,
  Tag,
  Users,
  X as XIcon,
  Zap,
} from 'lucide-react'
import BaseCard from './ui/BaseCard'
import AiInsightModal from './aula/AiInsightModal'
import { theme } from '../styles/theme'
import { widgetGoldCls } from '../lib/sidePanelStyles'
import { EVENTS_HUB } from '../styles/mobile-theme'
import { useDailyBrief } from '../hooks/useDailyBrief'
import { DailyBriefService } from '../services/ai/DailyBriefService'
import type { Profile } from '../types'
import type { Cohort, CohortChannelTask } from '../types/database'
import type { TodayClass } from '../hooks/useTodayClasses'
import type { AnnouncementRow } from '../services/adapters/AnnouncementsAdapter'

type Props = {
  userId: string | null
  cohort: Cohort | null
  myProfile: Profile | null
}

type QuickPrompt = {
  id: string
  label: string
  prompt: string
  icon: typeof Sparkles
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { id: 'tldr', label: 'Co najważniejsze?', prompt: 'Streść mi dzień w 3 punktach. Krótko i konkretnie.', icon: Zap },
  { id: 'announcements', label: 'Streść ogłoszenia', prompt: 'Streść mi tylko ogłoszenia z ostatnich 48h. Co muszę wiedzieć?', icon: Bell },
  { id: 'plan-tomorrow', label: 'Co jutro?', prompt: 'Co czeka mnie jutro? Czy są jakieś ważne deadliney lub odwołane zajęcia?', icon: ArrowRight },
]

function fmtHM(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDay(d: Date): string {
  const formatted = d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function startsInLabel(c: TodayClass): string {
  if (c.startsInMinutes === -1) return 'Skończone'
  if (c.startsInMinutes === 0) return 'Trwa teraz'
  if (c.startsInMinutes < 60) return `Za ${c.startsInMinutes} min`
  const h = Math.floor(c.startsInMinutes / 60)
  const m = c.startsInMinutes % 60
  return m === 0 ? `Za ${h} h` : `Za ${h} h ${m} min`
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

function fmtDueLabel(dueAt: string | null | undefined, now: Date): string | null {
  if (!dueAt) return null
  const due = new Date(dueAt)
  if (!Number.isFinite(due.getTime())) return null
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (24 * 3_600_000))
  const time = fmtHM(due)
  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays)
    if (overdueDays === 0) return `Po terminie · dziś ${time}`
    if (overdueDays === 1) return `Po terminie · wczoraj ${time}`
    return `Po terminie · ${overdueDays} dni temu`
  }
  if (diffDays === 0) return `Dziś ${time}`
  if (diffDays === 1) return `Jutro ${time}`
  if (diffDays <= 7) return `Za ${diffDays} dni · ${time}`
  return due.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Salutation = { hello: string; Icon: typeof Sun }

function buildSalutation(now: Date): Salutation {
  const h = now.getHours()
  if (h < 5) return { hello: 'Dobranoc', Icon: Moon }
  if (h < 10) return { hello: 'Dzień dobry', Icon: Sunrise }
  if (h < 13) return { hello: 'Cześć', Icon: Coffee }
  if (h < 18) return { hello: 'Witaj', Icon: Sun }
  if (h < 22) return { hello: 'Dobry wieczór', Icon: Moon }
  return { hello: 'Dobranoc', Icon: Moon }
}

/**
 * Znajdź "wolne okna" pomiędzy zajęciami (>= 60 min).
 * Tylko między zajęciami, które nie są jeszcze skończone (`startsInMinutes !== -1`)
 * i nie są anulowane.
 */
type FreeSlot = { start: Date; end: Date; minutes: number }

function findFreeSlots(classes: TodayClass[], minMinutes = 60): FreeSlot[] {
  const active = classes
    .filter((c) => !c.isCancelled && c.startsInMinutes !== -1)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const slots: FreeSlot[] = []
  for (let i = 0; i < active.length - 1; i++) {
    const cur = active[i]
    const nxt = active[i + 1]
    if (!cur || !nxt) continue
    const gapMs = nxt.startDate.getTime() - cur.endDate.getTime()
    const gapMin = Math.round(gapMs / 60_000)
    if (gapMin >= minMinutes) {
      slots.push({ start: cur.endDate, end: nxt.startDate, minutes: gapMin })
    }
  }
  return slots
}

function dayProgressPercent(classes: TodayClass[], now: Date): number {
  const active = classes.filter((c) => !c.isCancelled)
  if (active.length === 0) return 0
  const total = active.length
  const done = active.filter((c) => c.endDate.getTime() <= now.getTime()).length
  return Math.round((done / total) * 100)
}

/** Hero: najbliższe zajęcia + AI brief CTA + quick prompts. */
function HeroNextClass({
  nextClass,
  cancelledCount,
  loading,
  progressPct,
  onTriggerAiBrief,
  onTriggerPrompt,
  hasAnyContent,
  hasMap,
}: {
  nextClass: TodayClass | null
  cancelledCount: number
  loading: boolean
  progressPct: number
  onTriggerAiBrief: (preset?: QuickPrompt) => void
  onTriggerPrompt: (preset: QuickPrompt) => void
  hasAnyContent: boolean
  hasMap: boolean
}) {
  if (loading && !nextClass) {
    return (
      <div className="h-56 animate-pulse rounded-3xl bg-black/[0.05] dark:bg-white/[0.04]" />
    )
  }

  if (!nextClass) {
    return (
      <BaseCard
        variant="default"
        className="relative overflow-hidden p-5 sm:p-6 lg:p-7"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10"
        />
        <div className="relative flex flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Sparkles size={12} strokeWidth={2.4} />
              Lajt dzień
            </span>
            {cancelledCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
                {cancelledCount} odwołane
              </span>
            )}
          </div>
          <h2 className={`text-2xl font-bold leading-snug ${theme.text.primary} sm:text-3xl`}>
            Masz dziś wolne od zajęć.
          </h2>
          <p className={`max-w-prose text-sm leading-relaxed ${theme.text.muted}`}>
            Brak wpisów w planie dnia.{cancelledCount > 0 ? ` ${cancelledCount} zajęć odwołano — zobacz listę niżej.` : ''}
            {' '}
            Dobry moment, żeby zająć się tym co naprawdę ważne.
          </p>
          {hasAnyContent && (
            <button
              type="button"
              onClick={() => onTriggerAiBrief()}
              className="inline-flex items-center gap-2 rounded-full bg-[#1e293b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e293b]/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90"
            >
              <Sparkles size={14} strokeWidth={2.5} />
              AI brief dnia
            </button>
          )}
        </div>
      </BaseCard>
    )
  }

  const isImminent = nextClass.startsInMinutes >= 0 && nextClass.startsInMinutes <= 30
  const isLive = nextClass.startsInMinutes === 0

  return (
    <BaseCard
      variant="default"
      className={`relative overflow-hidden p-5 sm:p-6 lg:p-7 ${
        isImminent
          ? 'ring-1 ring-brand-gold/40 dark:ring-brand-gold-bright/40'
          : ''
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-gold/20 blur-3xl dark:bg-brand-gold-bright/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-[#1e293b]/10 blur-3xl dark:bg-blue-500/10"
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className={widgetGoldCls} strokeWidth={2.2} />
          <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
            {isLive ? 'Trwa teraz' : 'Najbliższe zajęcia'}
          </span>
          {isLive && (
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          {cancelledCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
              {cancelledCount} odwołane
            </span>
          )}
        </div>
        <h2 className={`mt-2 text-xl font-bold leading-snug sm:text-2xl lg:text-[26px] ${theme.text.primary}`}>
          {nextClass.summary}
        </h2>
        <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${theme.text.muted}`}>
          <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-brand-gold dark:text-brand-gold-bright">
            <Clock size={14} strokeWidth={2.5} />
            {startsInLabel(nextClass)}
          </span>
          <span className="tabular-nums">
            {fmtHM(nextClass.startDate)}–{fmtHM(nextClass.endDate)}
          </span>
          {nextClass.location && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={12} className="shrink-0" />{' '}
              <span className="truncate">{nextClass.location}</span>
            </span>
          )}
        </div>
        {nextClass.lecturer_name && (
          <p className={`mt-1 text-xs ${theme.text.muted}`}>{nextClass.lecturer_name}</p>
        )}

        {/* Day progress bar */}
        {progressPct > 0 && (
          <div className="mt-4">
            <div className={`mb-1 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide ${theme.text.muted}`}>
              <span>Postęp dnia</span>
              <span className="tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#1e293b] to-brand-gold transition-all duration-500 dark:from-brand-gold-bright dark:to-brand-gold"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTriggerAiBrief()}
            className="inline-flex items-center gap-2 rounded-full bg-[#1e293b] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1e293b]/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90"
          >
            <Sparkles size={14} strokeWidth={2.5} />
            AI brief dnia
          </button>
          {hasMap && nextClass.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextClass.location + ' Kraków UJ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <MapPin size={12} strokeWidth={2.2} />
              Mapa
            </a>
          )}
        </div>

        {/* Quick AI prompts */}
        {hasAnyContent && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onTriggerPrompt(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-[#1e293b]/35 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-brand-gold-bright/40 dark:hover:bg-brand-gold-bright/10"
                  title={p.prompt}
                >
                  <Icon size={11} strokeWidth={2.3} />
                  {p.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </BaseCard>
  )
}

function TaskRow({
  t,
  channelLabel,
  now,
  onNavigate,
}: {
  t: CohortChannelTask
  channelLabel: string | null
  now: Date
  onNavigate: () => void
}) {
  const due = fmtDueLabel(t.due_at, now)
  const overdue = t.due_at ? new Date(t.due_at).getTime() < now.getTime() : false
  const isHigh = t.priority === 'high'
  const surface = overdue
    ? 'border-red-300 bg-red-50/70 dark:border-red-500/40 dark:bg-red-500/[0.06]'
    : isHigh
      ? 'border-brand-gold/35 bg-brand-gold/[0.06] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]'
      : 'border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]'

  return (
    <button
      type="button"
      onClick={onNavigate}
      className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] ${surface}`}
    >
      <CheckSquare
        size={16}
        strokeWidth={2}
        className={`mt-0.5 shrink-0 ${overdue ? 'text-red-600 dark:text-red-300' : isHigh ? widgetGoldCls : 'text-zinc-400'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`min-w-0 truncate text-[13px] font-semibold leading-snug ${theme.text.primary}`}>
          {t.title}
        </p>
        <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] ${theme.text.muted}`}>
          {due && (
            <span className={`tabular-nums ${overdue ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>
              {due}
            </span>
          )}
          {channelLabel && <span className="truncate">sala "{channelLabel}"</span>}
          {isHigh && !overdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-gold dark:bg-brand-gold-bright/20 dark:text-brand-gold-bright">
              Wysoki
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function AnnouncementRowItem({
  a,
  onClick,
}: {
  a: AnnouncementRow
  onClick: () => void
}) {
  const statusLabel =
    a.status === 'cancelled' ? 'ODWOŁANE' : a.status === 'remote' ? 'ZDALNIE' : 'DYŻUR'
  const statusCls =
    a.status === 'cancelled'
      ? 'bg-red-600 text-white dark:bg-red-500'
      : a.status === 'remote'
        ? 'bg-blue-600 text-white dark:bg-blue-500'
        : 'bg-zinc-600 text-white dark:bg-zinc-500'
  const bodyText = a.summary ?? a.body
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${statusCls}`}>
            {statusLabel}
          </span>
          <span className={`truncate text-[12px] font-semibold ${theme.text.primary}`}>
            {a.lecturer_name || 'Prowadzący'}
          </span>
          {a.department && (
            <span className={`shrink-0 text-[10px] ${theme.text.muted}`}>· {a.department}</span>
          )}
        </div>
        <p className={`mt-1 line-clamp-2 text-[12px] leading-relaxed ${theme.text.muted}`}>
          {bodyText}
        </p>
      </div>
    </button>
  )
}

/** Stats strip — 4 small KPI cards. Mobile: 2x2 grid, PC: 4-col row. */
function StatsStrip({
  totalClasses,
  cancelledCount,
  tasksCount,
  overdueTasksCount,
  announcementsCount,
}: {
  totalClasses: number
  cancelledCount: number
  tasksCount: number
  overdueTasksCount: number
  announcementsCount: number
}) {
  const items = [
    {
      icon: CalendarDays,
      label: 'Zajęcia dziś',
      value: totalClasses,
      tint: 'text-[#1e293b] dark:text-brand-gold-bright',
    },
    {
      icon: XIcon,
      label: 'Odwołane',
      value: cancelledCount,
      tint: cancelledCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500',
    },
    {
      icon: ClipboardList,
      label: 'Otwarte zadania',
      value: tasksCount,
      tint: overdueTasksCount > 0 ? 'text-red-600 dark:text-red-400' : widgetGoldCls,
      badge: overdueTasksCount > 0 ? `${overdueTasksCount} po terminie` : null,
    },
    {
      icon: Bell,
      label: 'Świeże ogłoszenia',
      value: announcementsCount,
      tint: widgetGoldCls,
    },
  ] as const

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <BaseCard
            key={it.label}
            variant="default"
            className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-50/60 ${it.tint} dark:border-white/[0.08] dark:bg-white/[0.04]`}>
              <Icon size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.text.muted}`}>
                {it.label}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-extrabold tabular-nums leading-none ${theme.text.primary}`}>
                  {it.value}
                </span>
                {'badge' in it && it.badge && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-500/20 dark:text-red-300">
                    {it.badge}
                  </span>
                )}
              </div>
            </div>
          </BaseCard>
        )
      })}
    </div>
  )
}

/** Side panel: "Co dalej" mini timeline + Wolne okna + Quick links. */
function SidePanel({
  upcomingClasses,
  freeSlots,
  onNavigate,
  cohort,
}: {
  upcomingClasses: TodayClass[]
  freeSlots: FreeSlot[]
  onNavigate: (path: string) => void
  cohort: Cohort | null
}) {
  return (
    <div className="space-y-4">
      {/* Co dalej */}
      {upcomingClasses.length > 0 && (
        <BaseCard variant="default" className="flex flex-col gap-2.5 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Clock size={14} className={widgetGoldCls} strokeWidth={2.2} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text.sectionHeader}`}>
              Co dalej dziś
            </span>
            <span className={`text-[10px] tabular-nums ${theme.text.muted}`}>· {upcomingClasses.length}</span>
          </div>
          <div className="relative space-y-2">
            <div
              aria-hidden
              className="absolute bottom-2 left-[7px] top-2 w-px bg-zinc-200 dark:bg-white/[0.08]"
            />
            {upcomingClasses.map((c) => (
              <div key={c.id} className="relative flex items-start gap-3 pl-4">
                <span
                  aria-hidden
                  className={`absolute left-0 top-2 h-2 w-2 rounded-full ring-2 ring-white dark:ring-bg-app ${
                    c.startsInMinutes <= 30
                      ? 'bg-brand-gold dark:bg-brand-gold-bright'
                      : 'bg-zinc-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12.5px] font-semibold leading-snug ${theme.text.primary}`}>
                    {c.summary}
                  </p>
                  <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10.5px] ${theme.text.muted}`}>
                    <span className="tabular-nums">{fmtHM(c.startDate)}</span>
                    <span>·</span>
                    <span>{startsInLabel(c)}</span>
                    {c.location && (
                      <>
                        <span>·</span>
                        <span className="truncate">{c.location}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </BaseCard>
      )}

      {/* Wolne okna */}
      {freeSlots.length > 0 && (
        <BaseCard variant="default" className="flex flex-col gap-2.5 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Coffee size={14} className={widgetGoldCls} strokeWidth={2.2} />
            <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text.sectionHeader}`}>
              Wolne okna
            </span>
          </div>
          <div className="space-y-2">
            {freeSlots.slice(0, 3).map((s, idx) => {
              const h = Math.floor(s.minutes / 60)
              const m = s.minutes % 60
              const label = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/[0.06]"
                >
                  <p className="text-[12px] font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                    {fmtHM(s.start)} – {fmtHM(s.end)}
                  </p>
                  <p className="text-[10.5px] text-emerald-700/85 dark:text-emerald-300/80">
                    {label} luki — kawa / projekt / przerwa
                  </p>
                </div>
              )
            })}
          </div>
        </BaseCard>
      )}

      {/* Quick links */}
      <BaseCard variant="default" className="flex flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Compass size={14} className={widgetGoldCls} strokeWidth={2.2} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text.sectionHeader}`}>
            Skróty
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <QuickLinkBtn
            icon={Users}
            label="Aula"
            onClick={() => onNavigate('/aula')}
            disabled={!cohort}
          />
          <QuickLinkBtn icon={CalendarDays} label="Mój plan" onClick={() => onNavigate('/moj-plan')} />
          <QuickLinkBtn icon={Headphones} label="Wydarzenia" onClick={() => onNavigate('/events')} />
          <QuickLinkBtn icon={Tag} label="Zniżki" onClick={() => onNavigate('/znizki')} />
        </div>
      </BaseCard>
    </div>
  )
}

function QuickLinkBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Compass
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 text-left text-[12.5px] font-medium text-zinc-700 transition-colors hover:border-[#1e293b]/30 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:border-brand-gold-bright/35 dark:hover:bg-white/[0.06]"
    >
      <Icon size={14} className={widgetGoldCls} strokeWidth={2.2} />
      {label}
    </button>
  )
}

export default function DzisView({ userId, cohort, myProfile }: Props) {
  const navigate = useNavigate()
  const brief = useDailyBrief({ userId, cohort, myProfile })
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPreset, setAiPreset] = useState<QuickPrompt | null>(null)
  const now = useMemo(() => new Date(), [brief.classes, brief.tasks, brief.announcements])
  const greeting = firstName(myProfile)
  const today = useMemo(() => fmtDay(new Date()), [])
  const salutation = useMemo(() => buildSalutation(now), [now])

  const upcomingClasses = useMemo(() => {
    if (!brief.nextClass) return []
    const idx = brief.classes.findIndex((c) => c.id === brief.nextClass?.id)
    if (idx === -1) return []
    return brief.classes
      .slice(idx + 1)
      .filter((c) => !c.isCancelled && c.startsInMinutes !== -1)
      .slice(0, 3)
  }, [brief.classes, brief.nextClass])

  const freeSlots = useMemo(() => findFreeSlots(brief.classes), [brief.classes])
  const progressPct = useMemo(() => dayProgressPercent(brief.classes, now), [brief.classes, now])
  const overdueTasksCount = useMemo(
    () => brief.tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < now.getTime()).length,
    [brief.tasks, now],
  )

  const startAi = useCallback(() => {
    const payload = brief.toBriefPayload()
    if (aiPreset) {
      return DailyBriefService.generateBrief({ ...payload, userPrompt: aiPreset.prompt })
    }
    return DailyBriefService.generateBrief(payload)
  }, [aiPreset, brief])

  const handleOpenAi = useCallback((preset?: QuickPrompt) => {
    setAiPreset(preset ?? null)
    setAiOpen(true)
  }, [])

  const handleOpenTask = useCallback(
    (t: CohortChannelTask) => {
      navigate(`/aula?task=${t.id}`)
    },
    [navigate],
  )

  const handleOpenAnnouncement = useCallback(
    (a: AnnouncementRow) => {
      navigate(`/moj-plan?announcement=${a.id}`)
    },
    [navigate],
  )

  const handleRefresh = useCallback(() => {
    void brief.refresh()
  }, [brief])

  const hasAnyContent =
    brief.classes.length > 0 || brief.tasks.length > 0 || brief.announcements.length > 0

  const SalIcon = salutation.Icon

  return (
    <motion.div
      variants={EVENTS_HUB.motion.page}
      initial="hidden"
      animate="show"
      className="min-w-0 space-y-5 sm:space-y-6"
    >
      {/* ── Greeting bar ───────────────────────────────────────────────── */}
      <motion.div variants={EVENTS_HUB.motion.fadeUp} className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SalIcon size={14} className={widgetGoldCls} strokeWidth={2.4} />
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
              {today}
            </p>
          </div>
          <h1 className={`mt-1 text-2xl font-bold leading-tight ${theme.text.primary} sm:text-3xl`}>
            {greeting ? `${salutation.hello}, ${greeting}!` : salutation.hello}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={brief.loading}
          className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04] ${theme.text.muted} ${
            brief.loading ? 'opacity-60' : ''
          }`}
          aria-label="Odśwież brief dnia"
        >
          <RefreshCw size={13} className={brief.loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Odśwież</span>
        </button>
      </motion.div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <motion.div variants={EVENTS_HUB.motion.fadeUp}>
        <StatsStrip
          totalClasses={brief.classes.filter((c) => !c.isCancelled).length}
          cancelledCount={brief.cancelledTodayCount}
          tasksCount={brief.tasks.length}
          overdueTasksCount={overdueTasksCount}
          announcementsCount={brief.announcements.length}
        />
      </motion.div>

      {/* ── Hero (2/3) + side panel (1/3 PC) ───────────────────────────── */}
      <motion.div
        variants={EVENTS_HUB.motion.fadeUp}
        className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <HeroNextClass
          nextClass={brief.nextClass}
          cancelledCount={brief.cancelledTodayCount}
          loading={brief.loading}
          progressPct={progressPct}
          onTriggerAiBrief={handleOpenAi}
          onTriggerPrompt={handleOpenAi}
          hasAnyContent={hasAnyContent}
          hasMap={Boolean(brief.nextClass?.location)}
        />
        <div className="hidden lg:block">
          <SidePanel
            upcomingClasses={upcomingClasses}
            freeSlots={freeSlots}
            onNavigate={(p) => navigate(p)}
            cohort={cohort}
          />
        </div>
      </motion.div>

      {/* ── Tasks + Announcements (PC: 2-col, Mobile: stack) ────────────── */}
      <motion.div
        variants={EVENTS_HUB.motion.fadeUp}
        className="grid grid-cols-1 gap-5 md:grid-cols-2"
      >
        {/* Tasks column */}
        <BaseCard variant="default" className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className={widgetGoldCls} strokeWidth={2} />
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
                Co masz oddać
              </span>
              {brief.tasks.length > 0 && (
                <span className={`text-[11px] tabular-nums ${theme.text.muted}`}>· {brief.tasks.length}</span>
              )}
              {overdueTasksCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-500/20 dark:text-red-300">
                  {overdueTasksCount} po terminie
                </span>
              )}
            </div>
            {cohort && (
              <button
                type="button"
                onClick={() => navigate('/aula')}
                className={`text-[11px] font-medium ${theme.text.muted} hover:underline`}
              >
                Otwórz salę →
              </button>
            )}
          </div>

          {brief.loading && brief.tasks.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.04]" />
              ))}
            </div>
          ) : brief.tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50/60 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300">
                <CheckSquare size={20} strokeWidth={2} />
              </div>
              <p className={`text-[13px] font-semibold ${theme.text.primary}`}>Brak otwartych zadań</p>
              <p className={`max-w-[240px] text-[11.5px] leading-relaxed ${theme.text.muted}`}>
                {cohort
                  ? 'Wszystko ogarnięte. Dodaj zadanie w sali Aula gdy coś nowego wpadnie.'
                  : 'Dołącz do swojego rocznika żeby widzieć zadania.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {brief.tasks.slice(0, 6).map((t) => (
                <TaskRow
                  key={t.id}
                  t={t}
                  channelLabel={t.channel_id != null ? brief.channelLabelsById.get(t.channel_id) ?? null : null}
                  now={now}
                  onNavigate={() => handleOpenTask(t)}
                />
              ))}
              {brief.tasks.length > 6 && (
                <button
                  type="button"
                  onClick={() => navigate('/aula')}
                  className={`flex w-full items-center justify-center rounded-lg border border-zinc-200 px-3 py-1.5 text-[11.5px] font-medium ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04]`}
                >
                  + {brief.tasks.length - 6} kolejnych
                </button>
              )}
            </div>
          )}
        </BaseCard>

        {/* Announcements column */}
        <BaseCard variant="default" className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell size={16} className={widgetGoldCls} strokeWidth={2} />
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
                Świeże ogłoszenia
              </span>
              {brief.announcements.length > 0 && (
                <span className={`text-[11px] tabular-nums ${theme.text.muted}`}>· {brief.announcements.length}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`text-[11px] font-medium ${theme.text.muted} hover:underline`}
            >
              Wszystkie →
            </button>
          </div>

          {brief.loading && brief.announcements.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.04]" />
              ))}
            </div>
          ) : brief.announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50/60 text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-400">
                <Bell size={20} strokeWidth={2} />
              </div>
              <p className={`text-[13px] font-semibold ${theme.text.primary}`}>Brak nowych ogłoszeń</p>
              <p className={`max-w-[240px] text-[11.5px] leading-relaxed ${theme.text.muted}`}>
                Cisza spokojnie. Damy znać gdy coś wpadnie z UJ.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {brief.announcements.slice(0, 6).map((a) => (
                <AnnouncementRowItem
                  key={a.id}
                  a={a}
                  onClick={() => handleOpenAnnouncement(a)}
                />
              ))}
            </div>
          )}
        </BaseCard>
      </motion.div>

      {/* ── Side panel (Mobile: stack — pokazane na końcu) ─────────────── */}
      <motion.div variants={EVENTS_HUB.motion.fadeUp} className="lg:hidden">
        <SidePanel
          upcomingClasses={upcomingClasses}
          freeSlots={freeSlots}
          onNavigate={(p) => navigate(p)}
          cohort={cohort}
        />
      </motion.div>

      {/* ── Pełny harmonogram dnia ─────────────────────────────────────── */}
      {brief.classes.length > 0 && (
        <motion.div variants={EVENTS_HUB.motion.fadeUp}>
          <BaseCard variant="default" className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className={widgetGoldCls} strokeWidth={2} />
                <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
                  Dzisiaj — plan
                </span>
                <span className={`text-[11px] tabular-nums ${theme.text.muted}`}>
                  · {brief.classes.length} {brief.classes.length === 1 ? 'wpis' : 'wpisów'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/moj-plan')}
                className={`text-[11px] font-medium ${theme.text.muted} hover:underline`}
              >
                Mój plan →
              </button>
            </div>
            <div className="space-y-2">
              {brief.classes.map((c) => {
                const isCancelled = c.isCancelled
                const past = c.startsInMinutes === -1
                const surface = isCancelled
                  ? 'border-red-300 bg-red-50/70 dark:border-red-500/40 dark:bg-red-500/[0.06]'
                  : past
                    ? 'border-zinc-200 bg-zinc-50/60 opacity-60 dark:border-white/10 dark:bg-white/[0.03]'
                    : c.startsInMinutes <= 30
                      ? 'border-brand-gold/35 bg-brand-gold/[0.06] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]'
                      : 'border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]'
                return (
                  <div key={c.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${surface}`}>
                    <div className={`flex shrink-0 flex-col items-center justify-center rounded-lg px-2 py-1 ${
                      isCancelled
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200'
                    }`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                        {fmtHM(c.startDate)}
                      </span>
                      <span className="mt-0.5 text-[9px] leading-none opacity-70">
                        {fmtHM(c.endDate)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`min-w-0 truncate text-[13px] font-semibold leading-snug ${
                          isCancelled ? 'text-red-800 line-through decoration-red-400/70 dark:text-red-100' : theme.text.primary
                        }`}>
                          {c.summary}
                        </p>
                        {isCancelled ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
                            <XIcon size={10} strokeWidth={3} /> Odwołane
                          </span>
                        ) : (
                          <span className={`shrink-0 text-[10px] font-medium tabular-nums ${theme.text.muted}`}>
                            {startsInLabel(c)}
                          </span>
                        )}
                      </div>
                      {(c.lecturer_name || c.location) && (
                        <p className={`mt-0.5 truncate text-[11.5px] ${theme.text.muted}`}>
                          {c.lecturer_name ?? ''}
                          {c.lecturer_name && c.location ? ' · ' : ''}
                          {c.location ?? ''}
                        </p>
                      )}
                      {isCancelled && c.cancelled_announcement_body && (
                        <button
                          type="button"
                          onClick={() => c.cancelled_announcement_id && navigate(`/moj-plan?announcement=${c.cancelled_announcement_id}`)}
                          className="mt-1.5 line-clamp-2 w-full text-left text-[11.5px] leading-relaxed text-red-900/85 underline-offset-2 hover:underline dark:text-red-200/85"
                        >
                          {c.cancelled_announcement_body.replace(/\s+/g, ' ').trim().slice(0, 220)}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </BaseCard>
        </motion.div>
      )}

      {aiOpen && (
        <AiInsightModal
          title={aiPreset ? aiPreset.label : 'AI brief dnia'}
          subtitle={today}
          start={startAi}
          onClose={() => {
            setAiOpen(false)
            setAiPreset(null)
          }}
          fallbackErrorMessage="Nie udało się wygenerować briefu. Spróbuj za chwilę."
        />
      )}
    </motion.div>
  )
}
