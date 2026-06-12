/**
 * UJverse — compaktowy widget tygodniowego briefingu (sidebar feedu / mobile).
 *
 * Wzorzec wizualny dopasowany do `AcademicAnnouncementsWidget` /
 * `TodayClassesWidget`: header z `sectionTitleCls`, content w `BaseCard`,
 * jednorodne odstępy. Klik → `/briefing` (full view).
 */
import { Sparkles, ChevronRight, AlertTriangle, Calendar, Megaphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BaseCard from '../ui/BaseCard'
import {
  sectionTitleCls,
  sideMutedCls,
  widgetGoldCls,
} from '../../lib/sidePanelStyles'
import { theme } from '../../styles/theme'
import { useWeeklyBriefing } from '../../hooks/useWeeklyBriefing'
import { fmtHours, fmtWeekRange } from './briefingFormat'

type Props = {
  userId: string | null
}

export default function BriefingWidget({ userId }: Props) {
  const navigate = useNavigate()
  const { briefing, loading, error } = useWeeklyBriefing({ userId })

  const renderBody = () => {
    if (!userId) {
      return (
        <p className={`text-xs ${sideMutedCls} leading-relaxed`}>
          Zaloguj się, żeby zobaczyć spersonalizowany przegląd tygodnia.
        </p>
      )
    }
    if (loading && !briefing) {
      return (
        <div className="space-y-2">
          <div className="h-9 animate-pulse rounded-lg bg-black/[0.05] dark:bg-white/[0.04]" />
          <div className="h-9 animate-pulse rounded-lg bg-black/[0.05] dark:bg-white/[0.04]" />
        </div>
      )
    }
    if (error) {
      return <p className="text-xs text-red-600 dark:text-red-400/90 leading-snug">{error}</p>
    }
    if (!briefing) {
      return (
        <p className={`text-xs ${sideMutedCls} leading-relaxed`}>
          Brak danych do briefingu.
        </p>
      )
    }
    const p = briefing.payload
    const stats = [
      {
        icon: Calendar,
        label: `${p.classes.total} zajęć`,
        sub: fmtHours(p.classes.hours),
      },
      {
        icon: AlertTriangle,
        label: `${p.changes.length} zmian`,
        sub: p.classes.cancelled > 0 ? `${p.classes.cancelled} odwołane` : 'w planie',
        tone: p.changes.length > 0 ? 'warn' : 'neutral',
      },
      {
        icon: Megaphone,
        label: `${p.announcements_from_subscribed.length} komunikatów`,
        sub: 'od Twoich wykł.',
      },
    ] as const

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => {
            const tone =
              'tone' in s && s.tone === 'warn'
                ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-500/[0.08] dark:border-amber-500/30'
                : 'bg-zinc-50 border-zinc-200 dark:bg-white/[0.03] dark:border-white/10'
            return (
              <div
                key={s.label}
                className={`flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 ${tone}`}
              >
                <s.icon size={14} className={widgetGoldCls} strokeWidth={2} aria-hidden />
                <span className={`text-[12px] font-bold leading-tight ${theme.text.primary}`}>
                  {s.label}
                </span>
                <span className={`text-[10px] leading-tight ${theme.text.muted}`}>{s.sub}</span>
              </div>
            )
          })}
        </div>

        {p.next_exam && (
          <div className="rounded-xl border border-brand-gold/35 bg-brand-gold/[0.06] px-3 py-2 dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.05]">
            <p className={`text-[10px] font-bold uppercase tracking-wide ${widgetGoldCls}`}>
              Najbliższy termin
            </p>
            <p className={`mt-0.5 truncate text-[13px] font-semibold ${theme.text.primary}`}>
              {p.next_exam.title}
            </p>
            <p className={`text-[11px] ${theme.text.muted}`}>
              {p.next_exam.days_away === 0
                ? 'dzisiaj'
                : p.next_exam.days_away === 1
                  ? 'jutro'
                  : `za ${p.next_exam.days_away} dni`}
              {p.next_exam.location ? ` · ${p.next_exam.location}` : ''}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/briefing')}
          className="flex items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[11.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
        >
          Otwórz pełny przegląd <ChevronRight size={12} />
        </button>
      </div>
    )
  }

  return (
    <BaseCard variant="default" className="p-4 flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={sectionTitleCls}>Twój tydzień</span>
          {briefing && (
            <span className={`text-[10px] ${sideMutedCls}`}>
              {fmtWeekRange(briefing.payload.week_start, briefing.payload.week_end)}
            </span>
          )}
        </div>
      </div>
      {renderBody()}
    </BaseCard>
  )
}
