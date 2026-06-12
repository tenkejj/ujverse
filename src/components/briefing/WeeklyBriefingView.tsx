/**
 * UJverse — pełen widok briefingu tygodnia (`/briefing`).
 *
 * Layout zgodny z `/events` (EVENTS_HUB):
 *   - Container: `max-w-7xl` (App.tsx).
 *   - Top bar: back + "Przelicz" (statyczne na górze, scrolluje się z resztą).
 *   - Grid: `grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:..._360px]`
 *   - Main column: hero (premium glass + gold accent) + sekcje
 *     (zmiany / komunikaty / eventy) — każda używa
 *     `EVENTS_HUB.section.*` (uppercase tracking title + count badge).
 *   - Side rail (aside): sticky panele z `EVENTS_HUB.rail.*` —
 *     1) statystyki tygodnia (4 kafle), 2) najbliższy termin (highlight),
 *     3) szybkie akcje (Mój Plan / Kalendarz).
 *
 * Pełna spójność wizualna z `/events` — ten sam glass, ten sam gold akcent,
 * te same tokeny dla section headerów; brak osobnego języka briefingu.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Clock,
  GraduationCap,
  Megaphone,
  RefreshCcw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { DataService } from '../../services/DataService'
import { useWeeklyBriefing } from '../../hooks/useWeeklyBriefing'
import { theme } from '../../styles/theme'
import { toast } from '../../lib/appToast'
import EmptyState from '../EmptyState'
import { EVENTS_HUB } from '../../styles/mobile-theme'
import {
  fmtDayDate,
  fmtHM,
  fmtHours,
  fmtWeekRange,
  KIND_LABELS,
  KIND_TONE,
} from './briefingFormat'

type Props = {
  userId: string | null
}

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
    <header className={EVENTS_HUB.section.headerClass}>
      <h2 className={EVENTS_HUB.section.titleClass}>
        <Icon size={12} strokeWidth={2.25} className={EVENTS_HUB.section.titleIconClass} aria-hidden />
        {title}
        {typeof count === 'number' && count > 0 && (
          <span className={EVENTS_HUB.section.countBadgeClass}>{count}</span>
        )}
      </h2>
      {subtitle && <span className={EVENTS_HUB.section.subtitleClass}>{subtitle}</span>}
    </header>
  )
}

function RailPanelTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <h3 className={EVENTS_HUB.rail.panelTitleClass}>
      <Icon size={12} strokeWidth={2.25} className={EVENTS_HUB.rail.panelTitleIconClass} aria-hidden />
      {label}
    </h3>
  )
}

export default function WeeklyBriefingView({ userId }: Props) {
  const navigate = useNavigate()
  const { briefing, loading, error, refresh } = useWeeklyBriefing({ userId })
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
    toast.success('Briefing odświeżony.')
  }

  const handleHardRefresh = async () => {
    setRefreshing(true)
    const { row, error: err } = await DataService.ensureWeeklyBriefing()
    if (!err && row) {
      await refresh()
      toast.success('Briefing przeliczony od nowa.')
    } else if (err) {
      toast.error(err)
    }
    setRefreshing(false)
  }

  const headerSubtitle = useMemo(() => {
    if (!briefing) return null
    return fmtWeekRange(briefing.payload.week_start, briefing.payload.week_end)
  }, [briefing])

  if (!userId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <EmptyState
          icon={BarChart3}
          title="Przegląd tygodnia"
          subtitle="Zaloguj się, żeby zobaczyć spersonalizowany przegląd tygodnia: plan zajęć, odwołania, najbliższe egzaminy i komunikaty od Twoich wykładowców w jednym miejscu."
        />
      </div>
    )
  }

  const stats = briefing
    ? [
        { label: 'Zajęć', value: String(briefing.payload.classes.total) },
        { label: 'Godzin', value: fmtHours(briefing.payload.classes.hours) },
        { label: 'Aktywne dni', value: String(briefing.payload.classes.days_with_classes) },
        { label: 'Odwołane', value: String(briefing.payload.classes.cancelled) },
      ]
    : null

  return (
    <div className="space-y-4">
      {/* TOP BAR — back + przelicz */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`inline-flex items-center gap-1 text-[12px] ${theme.text.muted} hover:text-zinc-900 dark:hover:text-white`}
        >
          <ChevronLeft size={14} /> Wstecz
        </button>
        <button
          type="button"
          onClick={loading ? handleRefresh : handleHardRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]"
          aria-label="Przelicz briefing"
        >
          <RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} />
          Przelicz
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* MAIN COLUMN */}
        <div className="min-w-0 space-y-6">
          {/* HERO */}
          <div className={`${EVENTS_HUB.hero.cardClass} p-5 sm:p-6 md:p-7`}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#1e293b]/[0.06] blur-3xl dark:bg-brand-gold-bright/10"
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#1e293b]/25 bg-[#1e293b]/[0.05] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.08]">
                <BarChart3
                  size={26}
                  strokeWidth={2.25}
                  className="text-[#1e293b] dark:text-brand-gold-bright"
                  aria-hidden
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#1e293b] dark:text-brand-gold-bright`}>
                  Przegląd tygodnia
                </p>
                <h1 className={`mt-1 text-2xl font-extrabold tracking-tight sm:text-[28px] ${theme.text.primary}`}>
                  {headerSubtitle ?? 'Twój tydzień'}
                </h1>
                <p className={`mt-1.5 text-[13px] leading-relaxed ${theme.text.muted}`}>
                  Zajęcia, zmiany w planie, komunikaty od wykładowców i wydarzenia UJ — wszystko w jednym miejscu.
                </p>
              </div>
            </div>
          </div>

          {loading && !briefing && (
            <div className={`${EVENTS_HUB.rail.panelClass}`}>
              <div className="space-y-3">
                <div className="h-5 w-48 animate-pulse rounded-md bg-black/[0.06] dark:bg-white/[0.05]" />
                <div className="h-16 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.03]" />
                <div className="h-16 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.03]" />
              </div>
            </div>
          )}

          {error && (
            <div className={`${EVENTS_HUB.rail.panelClass} text-[13px] text-red-600 dark:text-red-400/90`}>
              {error}
            </div>
          )}

          {briefing && (
            <>
              {/* ZMIANY W PLANIE */}
              <section className={EVENTS_HUB.section.wrapClass}>
                <SectionHeader
                  icon={AlertTriangle}
                  title="Zmiany w planie"
                  count={briefing.payload.changes.length}
                  subtitle={
                    briefing.payload.changes.length > 0
                      ? `${briefing.payload.changes.length} ${briefing.payload.changes.length === 1 ? 'wpis' : 'wpisy'}`
                      : 'plan stoi'
                  }
                />
                {briefing.payload.changes.length === 0 ? (
                  <div className={`${EVENTS_HUB.rail.panelClass} flex items-center gap-3`}>
                    <Sparkles size={16} className="shrink-0 text-emerald-500 dark:text-emerald-400" strokeWidth={2.25} aria-hidden />
                    <p className={`text-[13px] ${theme.text.muted}`}>
                      Brak odwołań, zdalnych ani przesunięć od Twoich wykładowców.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {briefing.payload.changes.map((c) => {
                      const tone = KIND_TONE[c.kind]
                      return (
                        <li key={c.id} className={`${EVENTS_HUB.rail.panelClass} flex items-start gap-3`}>
                          <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.chip} ${tone.chipText}`}
                              >
                                {KIND_LABELS[c.kind]}
                              </span>
                              <span className={`text-[12px] ${theme.text.muted}`}>
                                {fmtDayDate(c.starts_at)}
                                {!c.all_day ? ` · ${fmtHM(c.starts_at)}–${fmtHM(c.ends_at)}` : ''}
                              </span>
                            </div>
                            <p className={`mt-1 text-[13.5px] font-semibold ${theme.text.primary}`}>
                              {c.title}
                            </p>
                            {c.lecturer_name && (
                              <p className={`text-[11.5px] ${theme.text.muted}`}>{c.lecturer_name}</p>
                            )}
                            {c.description && (
                              <p className={`mt-1 line-clamp-2 text-[12px] ${theme.text.muted}`}>
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

              {/* KOMUNIKATY */}
              <section className={EVENTS_HUB.section.wrapClass}>
                <SectionHeader
                  icon={Megaphone}
                  title="Od Twoich wykładowców"
                  count={briefing.payload.announcements_from_subscribed.length}
                  subtitle={
                    briefing.payload.announcements_from_subscribed.length > 0
                      ? 'subskrypcje'
                      : 'cisza'
                  }
                />
                {briefing.payload.announcements_from_subscribed.length === 0 ? (
                  <div className={`${EVENTS_HUB.rail.panelClass} text-[13px] ${theme.text.muted}`}>
                    Brak nowych komunikatów. Zasubskrybuj więcej wykładowców w{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/moj-plan')}
                      className="underline hover:text-zinc-900 dark:hover:text-white"
                    >
                      Moim Planie
                    </button>
                    .
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {briefing.payload.announcements_from_subscribed.map((a) => (
                      <li key={a.id} className={EVENTS_HUB.rail.panelClass}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
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
                          <span className={`text-[12.5px] font-semibold ${theme.text.primary}`}>
                            {a.lecturer_name}
                          </span>
                          <span className={`text-[11px] ${theme.text.muted}`}>
                            · {fmtDayDate(a.created_at)}
                          </span>
                        </div>
                        <p className={`mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed ${theme.text.muted}`}>
                          {a.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* EVENTY UJ */}
              {briefing.payload.official_events.length > 0 && (
                <section className={EVENTS_HUB.section.wrapClass}>
                  <SectionHeader
                    icon={CalendarClock}
                    title="Eventy UJ w tym tygodniu"
                    count={briefing.payload.official_events.length}
                  />
                  <ul className="space-y-2">
                    {briefing.payload.official_events.map((ev) => (
                      <li key={ev.id} className={EVENTS_HUB.rail.panelClass}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-semibold ${theme.text.muted}`}>
                            {fmtDayDate(ev.starts_at)}
                            {!ev.all_day ? ` · ${fmtHM(ev.starts_at)}` : ''}
                          </span>
                          {ev.department && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                              {ev.department}
                            </span>
                          )}
                        </div>
                        <p className={`mt-1 text-[13px] font-semibold ${theme.text.primary}`}>
                          {ev.title}
                        </p>
                        {ev.location && (
                          <p className={`text-[11.5px] ${theme.text.muted}`}>{ev.location}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className={`pt-2 text-center text-[11px] ${theme.text.muted}`}>
                Briefing wygenerowany {new Date(briefing.generated_at).toLocaleString('pl-PL')}.
              </p>
            </>
          )}
        </div>

        {/* SIDE RAIL */}
        <aside className={EVENTS_HUB.rail.wrapClass}>
          {/* STATS PANEL */}
          {stats && (
            <div className={EVENTS_HUB.rail.panelClass}>
              <RailPanelTitle icon={BarChart3} label="Statystyki tygodnia" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {stats.map((s, i) => {
                  const isCancelledStat = i === 3 && briefing && briefing.payload.classes.cancelled > 0
                  return (
                    <div
                      key={s.label}
                      className={`${EVENTS_HUB.rail.statCellClass} ${
                        isCancelledStat
                          ? 'border-amber-300/60 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/[0.08]'
                          : ''
                      }`}
                    >
                      <span
                        className={`${EVENTS_HUB.rail.statValueClass} ${
                          isCancelledStat ? '!text-amber-700 dark:!text-amber-300' : ''
                        }`}
                      >
                        {s.value}
                      </span>
                      <span className={EVENTS_HUB.rail.statLabelClass}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* NEXT EXAM */}
          {briefing?.payload.next_exam && (
            <div
              className={`${EVENTS_HUB.rail.panelClass} border-brand-gold/35 bg-brand-gold/[0.07] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]`}
            >
              <RailPanelTitle icon={GraduationCap} label="Najbliższy termin" />
              <p className={`mt-3 text-[15px] font-bold leading-snug ${theme.text.primary}`}>
                {briefing.payload.next_exam.title}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-brand-gold dark:bg-brand-gold-bright/15 dark:text-brand-gold-bright">
                  {briefing.payload.next_exam.days_away === 0
                    ? 'dzisiaj'
                    : briefing.payload.next_exam.days_away === 1
                      ? 'jutro'
                      : `za ${briefing.payload.next_exam.days_away} dni`}
                </span>
              </div>
              <p className={`mt-1.5 text-[12px] ${theme.text.muted}`}>
                {fmtDayDate(briefing.payload.next_exam.starts_at)}
                {briefing.payload.next_exam.location ? ` · ${briefing.payload.next_exam.location}` : ''}
              </p>
            </div>
          )}

          {/* QUICK ACTIONS */}
          <div className={EVENTS_HUB.rail.panelClass}>
            <RailPanelTitle icon={ClipboardList} label="Skoki" />
            <div className={EVENTS_HUB.rail.filterListClass}>
              <button
                type="button"
                onClick={() => navigate('/moj-plan')}
                className={`${EVENTS_HUB.rail.filterButtonBase} ${EVENTS_HUB.rail.filterButtonInactive}`}
              >
                <span className="flex items-center gap-2">
                  <ClipboardList size={14} strokeWidth={2.25} aria-hidden />
                  Mój Plan
                </span>
                <ChevronLeft size={14} strokeWidth={2} className="rotate-180 opacity-60" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => navigate('/events', { state: { tab: 'calendar' } })}
                className={`${EVENTS_HUB.rail.filterButtonBase} ${EVENTS_HUB.rail.filterButtonInactive}`}
              >
                <span className="flex items-center gap-2">
                  <Calendar size={14} strokeWidth={2.25} aria-hidden />
                  Kalendarz UJ
                </span>
                <ChevronLeft size={14} strokeWidth={2} className="rotate-180 opacity-60" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => navigate('/dzis')}
                className={`${EVENTS_HUB.rail.filterButtonBase} ${EVENTS_HUB.rail.filterButtonInactive}`}
              >
                <span className="flex items-center gap-2">
                  <Clock size={14} strokeWidth={2.25} aria-hidden />
                  Dzisiaj
                </span>
                <ChevronLeft size={14} strokeWidth={2} className="rotate-180 opacity-60" aria-hidden />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
