/**
 * UJverse — kompaktowy widget tygodniowego briefingu (sidebar feedu / mobile).
 *
 * Wzorzec wizualny zgodny z innymi „wyspami" sidebaru (Niezbędnik / Wydarzenia
 * UJ): `BaseCard` (default) + header z `sectionTitleCls` + lista wewnętrznych
 * wierszy (`variant="inner"`). Każdy wiersz: ikona w kwadratowym slocie, bold
 * label + muted sub. Klik → `/briefing` (full view).
 */
import {
  BarChart3,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'
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

type StatTone = 'neutral' | 'warn'

type StatRowData = {
  icon: LucideIcon
  primary: string
  secondary: string | null
  tone: StatTone
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function StatRow({ icon: Icon, primary, secondary, tone }: StatRowData) {
  const iconCls =
    tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : widgetGoldCls
  return (
    <BaseCard
      variant="inner"
      flush
      className="m-0 w-full flex items-start gap-2 p-2.5 shadow-none"
    >
      <div className="shrink-0 flex w-9 items-center justify-center min-h-[32px]">
        <Icon size={16} className={`shrink-0 ${iconCls}`} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] font-semibold leading-snug truncate ${theme.text.primary}`}
        >
          {primary}
        </p>
        {secondary && (
          <p className={`text-[11px] leading-snug ${theme.text.muted} truncate`}>
            {secondary}
          </p>
        )}
      </div>
    </BaseCard>
  )
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
          <div className="h-12 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
          <div className="h-12 animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.04]" />
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
    const classCount = p.classes.total
    const changeCount = p.changes.length
    const annCount = p.announcements_from_subscribed.length

    const stats: StatRowData[] = [
      {
        icon: Calendar,
        primary:
          classCount === 0
            ? 'Brak zajęć w tym tygodniu'
            : `${classCount} ${pluralPl(classCount, 'zajęcie', 'zajęcia', 'zajęć')}`,
        secondary: classCount === 0 ? null : `${fmtHours(p.classes.hours)} tygodniowo`,
        tone: 'neutral',
      },
      {
        icon: AlertTriangle,
        primary:
          changeCount === 0
            ? 'Brak zmian w planie'
            : `${changeCount} ${pluralPl(changeCount, 'zmiana', 'zmiany', 'zmian')}`,
        secondary:
          p.classes.cancelled > 0
            ? `${p.classes.cancelled} ${pluralPl(p.classes.cancelled, 'odwołane', 'odwołane', 'odwołanych')}`
            : null,
        tone: changeCount > 0 ? 'warn' : 'neutral',
      },
      {
        icon: Megaphone,
        primary:
          annCount === 0
            ? 'Brak nowych komunikatów'
            : `${annCount} ${pluralPl(annCount, 'komunikat', 'komunikaty', 'komunikatów')}`,
        secondary: annCount > 0 ? 'od Twoich wykładowców' : null,
        tone: 'neutral',
      },
    ]

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {stats.map((s) => (
            <StatRow key={s.primary} {...s} />
          ))}
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
          className={`flex items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[11.5px] font-medium ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04]`}
        >
          Otwórz pełny przegląd <ChevronRight size={12} />
        </button>
      </div>
    )
  }

  return (
    <BaseCard variant="default" className="p-4 flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <BarChart3 size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className={sectionTitleCls}>Przegląd tygodnia</span>
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
