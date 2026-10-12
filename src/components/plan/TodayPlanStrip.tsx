/**
 * Pasek „Mój plan” na górze feedu.
 *
 * Dzień w jednym rzucie: co trwa albo co jest następne, sala, odwołania
 * i reszta godzin. Cała karta otwiera `/moj-plan`.
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, MapPin } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { DataService } from '../../services/DataService'
import { useTodayClasses, type TodayClass } from '../../hooks/useTodayClasses'

type Props = {
  userId: string | null
}

const CARD_BTN =
  'w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold-bright/50'

function fmtHM(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function dayLabel(d: Date): string {
  const s = d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
}

function whenLabel(c: TodayClass): string {
  if (c.isCancelled && c.startsInMinutes >= 0) return 'Odwołane'
  if (c.startsInMinutes === -1) return 'Po zajęciach'
  if (c.startsInMinutes === 0) return 'Trwa teraz'
  if (c.startsInMinutes < 60) return `Za ${c.startsInMinutes} min`
  const h = Math.floor(c.startsInMinutes / 60)
  const m = c.startsInMinutes % 60
  return m === 0 ? `Za ${h} h` : `Za ${h} h ${m} min`
}

function sortClasses(classes: readonly TodayClass[]): TodayClass[] {
  return [...classes].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
}

/** Do czterech zajęć wokół „teraz”, bez duplikatu wyróżnionej pozycji. */
function sideRows(sorted: readonly TodayClass[], hero: TodayClass | null): TodayClass[] {
  const rest = sorted.filter((c) => c.id !== hero?.id)
  if (rest.length <= 4) return rest
  const upcoming = rest.findIndex((c) => c.startsInMinutes >= 0)
  const start = upcoming === -1 ? rest.length - 4 : Math.max(0, upcoming - 1)
  return rest.slice(start, start + 4)
}

function rowTone(c: TodayClass): string {
  if (c.isCancelled) return 'text-red-700 line-through decoration-red-400/70 dark:text-red-300'
  if (c.startsInMinutes === 0) return 'font-semibold text-zinc-900 dark:text-white'
  if (c.startsInMinutes === -1) return 'text-zinc-400 dark:text-zinc-500'
  return 'text-zinc-800 dark:text-zinc-100'
}

export default function TodayPlanStrip({ userId }: Props) {
  const navigate = useNavigate()
  const { classes, loading, nextClass, cancelledTodayCount } = useTodayClasses({ userId })
  const [hasPlan, setHasPlan] = useState<boolean | null>(null)

  useEffect(() => {
    if (!userId) {
      setHasPlan(false)
      return
    }
    if (classes.length > 0) {
      setHasPlan(true)
      return
    }
    let cancelled = false
    void DataService.timetableEntryCount(userId).then((n) => {
      if (!cancelled) setHasPlan(n > 0)
    })
    return () => {
      cancelled = true
    }
  }, [classes.length, userId])

  const sorted = useMemo(() => sortClasses(classes), [classes])
  const hero = nextClass ?? sorted.find((c) => c.startsInMinutes >= 0) ?? null
  const rows = sideRows(sorted, hero)
  const active = sorted.filter((c) => !c.isCancelled)
  const done = active.filter((c) => c.startsInMinutes === -1).length
  const progress = active.length > 0 ? Math.round((done / active.length) * 100) : 0
  const today = dayLabel(new Date())

  const openPlan = () => navigate('/moj-plan')
  const openOnKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPlan()
    }
  }

  if (!userId) return null

  if ((loading || hasPlan === null) && classes.length === 0) {
    return (
      <div
        aria-hidden
        className="h-[7.25rem] animate-pulse rounded-2xl border border-zinc-200 bg-white/80 dark:border-white/10 dark:bg-zinc-950/50"
      />
    )
  }

  if (!hasPlan) {
    return (
      <BaseCard
        as="div"
        role="button"
        tabIndex={0}
        interactive
        onClick={openPlan}
        onKeyDown={openOnKey}
        aria-label="Wgraj plan zajęć z USOS"
        className={CARD_BTN}
      >
        <span className="flex w-full items-center gap-3 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1e293b]/[0.07] text-[#1e293b] dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright">
            <ClipboardList size={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
              Wgraj swój plan
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">
              Sala, godzina i odwołania będą tu, na stronie głównej.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1e293b] dark:text-brand-gold-bright">
            USOS
            <ArrowRight size={14} strokeWidth={2.2} />
          </span>
        </span>
      </BaseCard>
    )
  }

  if (!hero) {
    const free = sorted.length === 0
    return (
      <BaseCard
        as="div"
        role="button"
        tabIndex={0}
        interactive
        onClick={openPlan}
        onKeyDown={openOnKey}
        aria-label={free ? 'Dziś bez zajęć. Otwórz mój plan.' : 'Dzień zajęć skończony. Otwórz mój plan.'}
        className={CARD_BTN}
      >
        <span className="flex w-full items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1e293b] dark:text-brand-gold-bright">
            <ClipboardList size={13} strokeWidth={2.4} />
            Mój plan
            <span className="font-medium normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
              {today}
            </span>
          </span>
          <span className="mt-1 block text-sm font-semibold text-zinc-900 dark:text-white">
            {free ? 'Dziś bez zajęć' : 'Na dziś koniec'}
          </span>
          <span className="mt-0.5 block text-[13px] text-zinc-500 dark:text-zinc-400">
            {free
              ? 'Reszta tygodnia jest w pełnym planie.'
              : `${done} z ${active.length} za tobą. Pełny tydzień otworzysz stąd.`}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1e293b] dark:text-brand-gold-bright">
          Tydzień
          <ArrowRight size={14} strokeWidth={2.2} />
        </span>
        </span>
      </BaseCard>
    )
  }

  const live = hero.startsInMinutes === 0 && !hero.isCancelled
  const aria = `Mój plan. ${whenLabel(hero)}: ${hero.summary}. Otwórz pełny plan.`

  return (
    <BaseCard
      as="div"
      role="button"
      tabIndex={0}
      interactive
      onClick={openPlan}
      onKeyDown={openOnKey}
      aria-label={aria}
      className={`${CARD_BTN} overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 px-4 py-2.5 dark:border-white/10">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1e293b] dark:text-brand-gold-bright">
          <ClipboardList size={13} strokeWidth={2.4} className="shrink-0" />
          <span className="shrink-0">Mój plan</span>
          <span className="truncate font-medium normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
            {today}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#1e293b] dark:text-brand-gold-bright">
          Pełny plan
          <ArrowRight size={14} strokeWidth={2.2} />
        </span>
      </div>

      <div className={rows.length > 0 ? 'grid md:grid-cols-2' : ''}>
        <div
          className={`px-4 py-3 ${
            rows.length > 0
              ? 'md:border-r md:border-zinc-200/80 dark:md:border-white/10'
              : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                hero.isCancelled
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-[#1e293b] dark:text-brand-gold-bright'
              }`}
            >
              {whenLabel(hero)}
            </span>
            {live && (
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
            )}
            {cancelledTodayCount > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-red-500">
                {cancelledTodayCount} odwołane
              </span>
            )}
          </div>
          <p
            className={`mt-1 truncate text-[17px] font-semibold leading-tight ${
              hero.isCancelled
                ? 'text-red-800 line-through decoration-red-400/70 dark:text-red-200'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {hero.summary}
          </p>
          <p className="mt-1 text-[13px] font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
            {fmtHM(hero.startDate)}–{fmtHM(hero.endDate)}
          </p>
          {(hero.location || hero.lecturer_name) && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
              {hero.location && (
                <>
                  <MapPin size={12} strokeWidth={2.2} className="shrink-0" />
                  <span className="truncate">{hero.location}</span>
                </>
              )}
              {hero.location && hero.lecturer_name && <span aria-hidden>·</span>}
              {hero.lecturer_name && <span className="truncate">{hero.lecturer_name}</span>}
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <ul className="flex flex-col justify-center gap-1 px-4 py-3">
            {rows.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-2">
                <span
                  className={`w-11 shrink-0 font-mono text-[12px] tabular-nums ${
                    c.startsInMinutes === -1 && !c.isCancelled
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : 'text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {fmtHM(c.startDate)}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${rowTone(c)}`}>
                  {c.summary}
                </span>
                <span className="max-w-[7.5rem] shrink-0 truncate text-right text-[11px] text-zinc-400 dark:text-zinc-500">
                  {c.isCancelled ? 'odwołane' : c.startsInMinutes === -1 ? 'po' : c.location ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active.length > 0 && (
        <div className="px-4 pb-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            <span>
              {done} z {active.length} za tobą
            </span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#1e293b] dark:bg-brand-gold-bright"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </BaseCard>
  )
}
