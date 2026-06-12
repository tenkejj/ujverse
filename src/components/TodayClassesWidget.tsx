/**
 * UJverse — widget „Co dziś masz?".
 *
 * Konsumuje hook `useTodayClasses` (cross-ref do anonsów ze statusem
 * `cancelled` w ostatnich 7 dniach). Dwa warianty:
 *   - `compact` — sidebar feedu / dashboard mobilny (mała wysokość)
 *   - `panel`   — wpięty w MojPlanView na pełnej szerokości
 *
 * Klik w odwołane zajęcia → `/moj-plan?announcement=<id>` (deep link do
 * drawera komunikatu, identyczny mechanizm co z notyfikacji).
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ChevronRight, ClipboardList, MapPin, X as XIcon } from 'lucide-react'
import BaseCard from './ui/BaseCard'
import {
  sectionTitleCls,
  sideMutedCls,
  widgetGoldCls,
} from '../lib/sidePanelStyles'
import { theme } from '../styles/theme'
import { useTodayClasses, type TodayClass } from '../hooks/useTodayClasses'

type Variant = 'compact' | 'panel'

type Props = {
  userId: string | null
  variant?: Variant
  /**
   * Wywoływane gdy user kliknie „Importuj plan" (kierujemy go do MojPlanView).
   * Default: `navigate('/moj-plan')`.
   */
  onNavigateToImport?: () => void
}

function fmtHM(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtTodayLabel(now: Date): string {
  const formatted = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function startsInLabel(c: TodayClass): string {
  if (c.startsInMinutes === -1) return 'Skończone'
  if (c.startsInMinutes === 0) return 'Trwa'
  if (c.startsInMinutes < 60) return `Za ${c.startsInMinutes} min`
  const h = Math.floor(c.startsInMinutes / 60)
  const m = c.startsInMinutes % 60
  return m === 0 ? `Za ${h} h` : `Za ${h} h ${m} min`
}

function ClassRow({
  c,
  compact,
  onOpenCancellation,
}: {
  c: TodayClass
  compact: boolean
  onOpenCancellation: (announcementId: string) => void
}) {
  const isCancelled = c.isCancelled
  const past = c.startsInMinutes === -1

  const baseRow =
    'group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors'
  const surface = isCancelled
    ? 'border-red-300 bg-red-50/70 dark:border-red-500/40 dark:bg-red-500/[0.06]'
    : past
      ? 'border-zinc-200 bg-zinc-50/60 opacity-60 dark:border-white/10 dark:bg-white/[0.03]'
      : c.startsInMinutes <= 30
        ? 'border-brand-gold/35 bg-brand-gold/[0.06] dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.06]'
        : 'border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]'

  return (
    <div className={`${baseRow} ${surface}`}>
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
            {c.location ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={10} className="inline-block" /> {c.location}
              </span>
            ) : null}
          </p>
        )}
        {isCancelled && c.cancelled_announcement_body && (
          <button
            type="button"
            onClick={() => c.cancelled_announcement_id && onOpenCancellation(c.cancelled_announcement_id)}
            className="mt-1.5 line-clamp-2 w-full text-left text-[11.5px] leading-relaxed text-red-900/85 underline-offset-2 hover:underline dark:text-red-200/85"
          >
            {c.cancelled_announcement_body.replace(/\s+/g, ' ').trim().slice(0, compact ? 110 : 220)}
          </button>
        )}
      </div>
    </div>
  )
}

export default function TodayClassesWidget({
  userId,
  variant = 'compact',
  onNavigateToImport,
}: Props) {
  const navigate = useNavigate()
  const { classes, loading, nextClass, cancelledTodayCount } = useTodayClasses({ userId })
  const todayLabel = useMemo(() => fmtTodayLabel(new Date()), [])
  const handleImport = onNavigateToImport ?? (() => navigate('/moj-plan'))
  const handleOpenCancellation = (announcementId: string) => {
    navigate(`/moj-plan?announcement=${announcementId}`)
  }

  const isPanel = variant === 'panel'

  const heading = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <ClipboardList size={isPanel ? 16 : 13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={isPanel ? `text-[15px] font-bold ${theme.text.primary}` : sectionTitleCls}>
            {isPanel ? 'Co dziś masz?' : 'Co dziś masz'}
          </span>
          <span className={`text-[10px] ${sideMutedCls}`}>{todayLabel}</span>
        </div>
      </div>
      {cancelledTodayCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
          {cancelledTodayCount} odwołane
        </span>
      )}
    </div>
  )

  const cardCls = isPanel
    ? 'p-4 sm:p-5 flex flex-col gap-4'
    : 'p-4 flex flex-col gap-3 h-[420px] min-h-0 overflow-hidden'

  return (
    <BaseCard variant="default" className={cardCls}>
      {heading}

      {loading && classes.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.04]"
            />
          ))}
        </div>
      ) : !userId ? null : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-white/10">
          <CalendarCheck size={28} className="text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
          <p className={`text-[13px] font-semibold ${theme.text.primary}`}>Brak planu na dziś</p>
          <p className={`max-w-[260px] text-[11.5px] leading-relaxed ${theme.text.muted}`}>
            Zaimportuj plan z USOSweb (eksport .ics), a tu pojawi się dzisiejszy harmonogram + powiadomienia o odwołanych zajęciach.
          </p>
          <button
            type="button"
            onClick={handleImport}
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-brand-gold/40 px-3 py-1 text-[11.5px] font-semibold text-brand-gold transition-colors hover:bg-brand-gold/5 dark:border-brand-gold-bright/40 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/10"
          >
            Importuj plan <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <>
          {nextClass && !isPanel && (
            <div className="rounded-xl border border-brand-gold/35 bg-brand-gold/[0.08] px-3 py-2 dark:border-brand-gold-bright/35 dark:bg-brand-gold-bright/[0.05]">
              <p className={`text-[10px] font-bold uppercase tracking-wide ${widgetGoldCls}`}>Najbliższe</p>
              <p className={`mt-0.5 truncate text-[13px] font-semibold ${theme.text.primary}`}>
                {nextClass.summary}
              </p>
              <p className={`mt-0.5 text-[11px] ${theme.text.muted}`}>
                {startsInLabel(nextClass)} · {fmtHM(nextClass.startDate)}
                {nextClass.location ? ` · ${nextClass.location}` : ''}
              </p>
            </div>
          )}
          <div className={`flex-1 min-h-0 ${isPanel ? '' : 'overflow-y-auto pr-1'} space-y-2`}>
            {classes.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                compact={!isPanel}
                onOpenCancellation={handleOpenCancellation}
              />
            ))}
          </div>
          {!isPanel && (
            <button
              type="button"
              onClick={handleImport}
              className={`flex items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-[11.5px] font-medium ${theme.text.muted} hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04]`}
            >
              Zarządzaj planem <ChevronRight size={12} />
            </button>
          )}
        </>
      )}
    </BaseCard>
  )
}
