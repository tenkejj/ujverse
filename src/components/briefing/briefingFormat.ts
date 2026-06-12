/**
 * UJverse — wspólne formattery dla widoków briefingu (widget + view).
 * Trzymane osobno żeby uniknąć cyklicznych importów i powielonego kodu.
 */
import type { BriefingChange } from '../../types/briefing'

export const KIND_LABELS: Record<BriefingChange['kind'], string> = {
  lecturer_absence: 'Nieobecność',
  class_cancelled: 'Odwołane',
  class_remote: 'Zdalne',
  class_rescheduled: 'Przesunięte',
  duty_change: 'Dyżur',
}

export const KIND_TONE: Record<
  BriefingChange['kind'],
  { dot: string; chip: string; chipText: string }
> = {
  lecturer_absence: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 dark:bg-amber-500/[0.18]',
    chipText: 'text-amber-700 dark:text-amber-200',
  },
  class_cancelled: {
    dot: 'bg-red-500',
    chip: 'bg-red-100 dark:bg-red-500/[0.18]',
    chipText: 'text-red-700 dark:text-red-200',
  },
  class_remote: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 dark:bg-sky-500/[0.18]',
    chipText: 'text-sky-700 dark:text-sky-200',
  },
  class_rescheduled: {
    dot: 'bg-violet-500',
    chip: 'bg-violet-100 dark:bg-violet-500/[0.18]',
    chipText: 'text-violet-700 dark:text-violet-200',
  },
  duty_change: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-100 dark:bg-emerald-500/[0.18]',
    chipText: 'text-emerald-700 dark:text-emerald-200',
  },
}

export function fmtWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(`${weekEnd}T00:00:00`)
  const sameMonth = start.getMonth() === end.getMonth()
  const dayFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric' })
  const monthFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
  if (sameMonth) {
    return `${dayFmt.format(start)} – ${monthFmt.format(end)}`
  }
  return `${monthFmt.format(start)} – ${monthFmt.format(end)}`
}

export function fmtHM(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function fmtDayDate(iso: string): string {
  const d = new Date(iso)
  const formatted = d.toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return formatted.replace('.', '')
}

export function fmtHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0 h'
  const rounded = Math.round(hours * 10) / 10
  return `${rounded.toString().replace('.', ',')} h`
}
