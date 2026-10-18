/**
 * Krótki skrót planu w prawej kolumnie feedu (desktop).
 * Jedno najbliższe zajęcie i przejście do `/moj-plan`.
 * Na telefonie planu tu nie ma — jego miejsce to zakładka Plan.
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
import { DataService } from '../../services/DataService'
import { useTodayClasses, type TodayClass } from '../../hooks/useTodayClasses'

type Props = {
  userId: string | null
  className?: string
}

const CARD_BTN =
  'w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/40 dark:focus-visible:ring-brand-gold-bright/50'

function fmtHM(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function whenLabel(c: TodayClass): string {
  if (c.isCancelled && c.startsInMinutes >= 0) return 'Odwołane'
  if (c.startsInMinutes === 0) return 'Teraz'
  if (c.startsInMinutes < 60) return `Za ${c.startsInMinutes} min`
  const h = Math.floor(c.startsInMinutes / 60)
  const m = c.startsInMinutes % 60
  return m === 0 ? `Za ${h} h` : `Za ${h} h ${m} min`
}

export default function TodayPlanStrip({ userId, className = '' }: Props) {
  const navigate = useNavigate()
  const { classes, loading, nextClass } = useTodayClasses({ userId })
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

  const hero = useMemo(() => {
    if (nextClass) return nextClass
    return [...classes]
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .find((c) => c.startsInMinutes >= 0) ?? null
  }, [classes, nextClass])

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
        className={`h-16 animate-pulse rounded-2xl border border-zinc-200 bg-white/80 dark:border-white/10 dark:bg-zinc-950/50 ${className}`}
      />
    )
  }

  const title = !hasPlan
    ? 'Wgraj plan z USOS'
    : !hero
      ? classes.length === 0
        ? 'Dziś bez zajęć'
        : 'Na dziś koniec'
      : hero.summary

  const detail = !hasPlan
    ? 'Sala i odwołania w Moim planie'
    : !hero
      ? 'Otwórz tydzień'
      : [
          whenLabel(hero),
          `${fmtHM(hero.startDate)}–${fmtHM(hero.endDate)}`,
          hero.location,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <BaseCard
      as="div"
      role="button"
      tabIndex={0}
      interactive
      onClick={openPlan}
      onKeyDown={openOnKey}
      aria-label={`${title}. ${detail}. Otwórz mój plan.`}
      className={`${CARD_BTN} ${className}`}
    >
      <span className="flex items-center gap-3 p-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink dark:text-brand-gold-bright">
            Mój plan
          </span>
          <span
            className={`mt-1 block truncate text-[15px] font-semibold leading-snug ${
              hero?.isCancelled
                ? 'text-red-700 line-through dark:text-red-300'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-zinc-500 dark:text-zinc-400">
            {detail}
          </span>
        </span>
        <ArrowRight size={16} strokeWidth={2.2} className="shrink-0 text-brand-ink dark:text-brand-gold-bright" />
      </span>
    </BaseCard>
  )
}
