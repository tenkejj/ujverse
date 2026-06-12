/**
 * UJverse — DzisView: "Morning brief" strona główna studenta.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Cel produktowy: zastąpić ranne otwarcie USOSweb. Jeden ekran = całokształt
 * dnia (zajęcia + deadliney Aula + świeże ogłoszenia + AI summary).
 *
 * Layout:
 *   - Hero "Lecimy do" — najbliższe zajęcia z countdown i AI button
 *   - Grid 2-col (desktop) / stack (mobile): Deadliney + Świeże ogłoszenia
 *   - Sekcja "Dzisiaj plan" — pełna lista zajęć
 *
 * Routing:
 *   - `/dzis` z deep-link supportem do announcement drawer (`?announcement=X`)
 *
 * Brak query-state-management — wszystko snapshot-friendly z useDailyBrief.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
  X as XIcon,
} from 'lucide-react'
import BaseCard from './ui/BaseCard'
import AiInsightModal from './aula/AiInsightModal'
import { theme } from '../styles/theme'
import { widgetGoldCls } from '../lib/sidePanelStyles'
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

/** Hero: najbliższe zajęcia + AI brief CTA. */
function HeroNextClass({
  nextClass,
  cancelledCount,
  loading,
  onTriggerAiBrief,
  hasAnyContent,
}: {
  nextClass: TodayClass | null
  cancelledCount: number
  loading: boolean
  onTriggerAiBrief: () => void
  hasAnyContent: boolean
}) {
  if (loading && !nextClass) {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
    )
  }

  if (!nextClass) {
    return (
      <BaseCard variant="default" className="flex flex-col items-start gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className={widgetGoldCls} strokeWidth={2} />
          <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
            Dziś
          </span>
        </div>
        <h2 className={`text-xl font-bold leading-snug ${theme.text.primary}`}>
          Masz wolne od zajęć.
        </h2>
        <p className={`text-sm ${theme.text.muted}`}>
          Brak wpisów w planie dnia.{cancelledCount > 0 ? ` ${cancelledCount} zajęć w planie odwołano — sprawdź listę poniżej.` : ''}
        </p>
        {hasAnyContent && (
          <button
            type="button"
            onClick={onTriggerAiBrief}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90"
          >
            <Sparkles size={14} strokeWidth={2.5} />
            AI brief dnia
          </button>
        )}
      </BaseCard>
    )
  }

  const isImminent = nextClass.startsInMinutes >= 0 && nextClass.startsInMinutes <= 30
  return (
    <BaseCard
      variant="default"
      className={`relative overflow-hidden p-5 sm:p-6 ${
        isImminent
          ? 'ring-1 ring-brand-gold/40 dark:ring-brand-gold-bright/40'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className={widgetGoldCls} strokeWidth={2} />
            <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
              Najbliższe zajęcia
            </span>
            {cancelledCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
                {cancelledCount} odwołane dziś
              </span>
            )}
          </div>
          <h2 className={`mt-2 text-xl font-bold leading-snug sm:text-2xl ${theme.text.primary}`}>
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
                <MapPin size={12} className="shrink-0" /> <span className="truncate">{nextClass.location}</span>
              </span>
            )}
          </div>
          {nextClass.lecturer_name && (
            <p className={`mt-1 text-xs ${theme.text.muted}`}>{nextClass.lecturer_name}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onTriggerAiBrief}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold/90 dark:bg-brand-gold-bright dark:text-zinc-900 dark:hover:bg-brand-gold-bright/90"
      >
        <Sparkles size={14} strokeWidth={2.5} />
        AI brief dnia
      </button>
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

export default function DzisView({ userId, cohort, myProfile }: Props) {
  const navigate = useNavigate()
  const brief = useDailyBrief({ userId, cohort, myProfile })
  const [aiOpen, setAiOpen] = useState(false)
  const now = useMemo(() => new Date(), [brief.classes, brief.tasks, brief.announcements])
  const greeting = firstName(myProfile)
  const today = useMemo(() => fmtDay(new Date()), [])

  const startAi = useCallback(() => {
    const payload = brief.toBriefPayload()
    return DailyBriefService.generateBrief(payload)
  }, [brief])

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 pb-32 pt-4 sm:gap-6 sm:px-4 sm:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.sectionHeader}`}>
            {today}
          </p>
          <h1 className={`text-2xl font-bold leading-tight ${theme.text.primary} sm:text-3xl`}>
            {greeting ? `Cześć, ${greeting}!` : 'Dziś'}
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
          Odśwież
        </button>
      </div>

      <HeroNextClass
        nextClass={brief.nextClass}
        cancelledCount={brief.cancelledTodayCount}
        loading={brief.loading}
        onTriggerAiBrief={() => setAiOpen(true)}
        hasAnyContent={hasAnyContent}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
              <CheckSquare size={24} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
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
              <Bell size={24} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
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
      </div>

      {/* Pełny harmonogram dnia */}
      {brief.classes.length > 0 && (
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
      )}

      {aiOpen && (
        <AiInsightModal
          title="AI brief dnia"
          subtitle={today}
          start={startAi}
          onClose={() => setAiOpen(false)}
          fallbackErrorMessage="Nie udało się wygenerować briefu. Spróbuj za chwilę."
        />
      )}
    </div>
  )
}
