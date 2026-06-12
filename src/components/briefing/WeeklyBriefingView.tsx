/**
 * UJverse — pełen widok tygodniowego briefingu (`/briefing`).
 *
 * Sekcje:
 *   1. Header z zakresem tygodnia + akcją „odśwież teraz" (re-trigger
 *      `ensure_weekly_briefing`; w MVP RPC tylko zwraca istniejący wiersz, więc
 *      odświeżenie nie regeneruje — to do follow-up, na razie pokazuje toast).
 *   2. Stat-cards: zajęcia / godziny / dni z zajęciami / odwołane.
 *   3. „Twoje zmiany w planie" — z `changes` (calendar_entries po subskrypcji).
 *   4. „Komunikaty od Twoich wykładowców" — embedded z brief preview.
 *   5. „Najbliższy egzamin" — hero card jeśli istnieje.
 *   6. „Eventy UJ w tym tygodniu".
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Clock,
  GraduationCap,
  Megaphone,
  RefreshCcw,
  Sparkles,
} from 'lucide-react'
import { DataService } from '../../services/DataService'
import { useWeeklyBriefing } from '../../hooks/useWeeklyBriefing'
import { theme } from '../../styles/theme'
import { toast } from '../../lib/appToast'
import BaseCard from '../ui/BaseCard'
import EmptyState from '../EmptyState'
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
  label,
  badge,
}: {
  icon: typeof Calendar
  label: string
  badge?: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={16} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2} />
      <h2 className={`text-[15px] font-bold ${theme.text.primary}`}>{label}</h2>
      {badge && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
          {badge}
        </span>
      )}
    </div>
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
    // Force regeneration przez bezpośredni call do RPC (nadpisze payload).
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
          icon={Sparkles}
          title="Tygodniowy briefing"
          subtitle="Zaloguj się, żeby zobaczyć spersonalizowany przegląd tygodnia: plan zajęć, odwołania, najbliższe egzaminy i komunikaty od Twoich wykładowców w jednym miejscu."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
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
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11.5px] font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.09]"
        >
          <RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} />
          Przelicz
        </button>
      </div>

      <BaseCard variant="default" className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/15 dark:bg-brand-gold-bright/15">
            <Sparkles size={22} className="text-brand-gold dark:text-brand-gold-bright" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${theme.text.muted}`}>
              Tygodniowy briefing
            </p>
            <h1 className={`mt-0.5 text-2xl font-bold tracking-tight ${theme.text.primary}`}>
              Twój tydzień
            </h1>
            {headerSubtitle && (
              <p className={`mt-0.5 text-[13px] ${theme.text.muted}`}>{headerSubtitle}</p>
            )}
          </div>
        </div>
      </BaseCard>

      {loading && !briefing && (
        <BaseCard variant="default" className="p-5">
          <div className="space-y-3">
            <div className="h-5 w-48 animate-pulse rounded-md bg-black/[0.06] dark:bg-white/[0.05]" />
            <div className="h-16 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.03]" />
            <div className="h-16 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.03]" />
          </div>
        </BaseCard>
      )}

      {error && (
        <BaseCard variant="default" className="p-4">
          <p className="text-[13px] text-red-600 dark:text-red-400/90">{error}</p>
        </BaseCard>
      )}

      {briefing && (
        <>
          {/* STAT CARDS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                Icon: ClipboardList,
                label: 'Zajęć',
                value: String(briefing.payload.classes.total),
              },
              {
                Icon: Clock,
                label: 'Godzin',
                value: fmtHours(briefing.payload.classes.hours),
              },
              {
                Icon: Calendar,
                label: 'Dni z zajęciami',
                value: String(briefing.payload.classes.days_with_classes),
              },
              {
                Icon: AlertTriangle,
                label: 'Odwołanych',
                value: String(briefing.payload.classes.cancelled),
                tone: briefing.payload.classes.cancelled > 0 ? 'warn' : 'neutral',
              },
            ].map((stat) => (
              <BaseCard
                key={stat.label}
                variant="default"
                className={`p-3 ${
                  stat.tone === 'warn'
                    ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-500/[0.07]'
                    : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <stat.Icon
                    size={16}
                    className="mt-0.5 text-brand-gold dark:text-brand-gold-bright"
                    strokeWidth={2}
                  />
                  <div className="min-w-0">
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${theme.text.muted}`}>
                      {stat.label}
                    </p>
                    <p className={`text-2xl font-bold tabular-nums ${theme.text.primary}`}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </BaseCard>
            ))}
          </div>

          {/* NEXT EXAM HERO */}
          {briefing.payload.next_exam && (
            <BaseCard
              variant="default"
              className="flex items-start gap-3 border-brand-gold/35 bg-brand-gold/[0.07] p-4 dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]"
            >
              <GraduationCap
                size={22}
                className="mt-0.5 shrink-0 text-brand-gold dark:text-brand-gold-bright"
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold dark:text-brand-gold-bright">
                  Najbliższy termin
                </p>
                <p className={`mt-1 text-[16px] font-bold ${theme.text.primary}`}>
                  {briefing.payload.next_exam.title}
                </p>
                <p className={`mt-0.5 text-[13px] ${theme.text.muted}`}>
                  {briefing.payload.next_exam.days_away === 0
                    ? 'Dzisiaj'
                    : briefing.payload.next_exam.days_away === 1
                      ? 'Jutro'
                      : `Za ${briefing.payload.next_exam.days_away} dni`}{' '}
                  · {fmtDayDate(briefing.payload.next_exam.starts_at)}
                  {briefing.payload.next_exam.location
                    ? ` · ${briefing.payload.next_exam.location}`
                    : ''}
                </p>
              </div>
            </BaseCard>
          )}

          {/* ZMIANY W PLANIE */}
          <BaseCard variant="default" className="p-4 sm:p-5">
            <SectionHeader
              icon={AlertTriangle}
              label="Zmiany w planie"
              badge={String(briefing.payload.changes.length)}
            />
            {briefing.payload.changes.length === 0 ? (
              <p className={`text-[13px] ${theme.text.muted}`}>
                Żadnych odwołań, zdalnych ani przesunięć od Twoich wykładowców — całuję twardo plan jak stoi.
              </p>
            ) : (
              <ul className="space-y-2">
                {briefing.payload.changes.map((c) => {
                  const tone = KIND_TONE[c.kind]
                  return (
                    <li
                      key={c.id}
                      className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]"
                    >
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
                        <p className={`mt-1 text-[13px] font-semibold ${theme.text.primary}`}>
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
          </BaseCard>

          {/* KOMUNIKATY OD WYKŁADOWCÓW */}
          <BaseCard variant="default" className="p-4 sm:p-5">
            <SectionHeader
              icon={Megaphone}
              label="Od Twoich wykładowców"
              badge={String(briefing.payload.announcements_from_subscribed.length)}
            />
            {briefing.payload.announcements_from_subscribed.length === 0 ? (
              <p className={`text-[13px] ${theme.text.muted}`}>
                Brak nowych komunikatów. Zasubskrybuj więcej wykładowców w{' '}
                <button
                  type="button"
                  onClick={() => navigate('/moj-plan')}
                  className="underline hover:text-zinc-900 dark:hover:text-white"
                >
                  Moim Planie
                </button>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {briefing.payload.announcements_from_subscribed.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]"
                  >
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
                      <span className={`text-[12px] font-semibold ${theme.text.primary}`}>
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
          </BaseCard>

          {/* EVENTY UJ */}
          {briefing.payload.official_events.length > 0 && (
            <BaseCard variant="default" className="p-4 sm:p-5">
              <SectionHeader
                icon={CalendarClock}
                label="Eventy UJ w tym tygodniu"
                badge={String(briefing.payload.official_events.length)}
              />
              <ul className="space-y-2">
                {briefing.payload.official_events.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]"
                  >
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
            </BaseCard>
          )}

          <p className={`text-center text-[11px] ${theme.text.muted}`}>
            Briefing wygenerowany {new Date(briefing.generated_at).toLocaleString('pl-PL')}.
          </p>
        </>
      )}
    </div>
  )
}
