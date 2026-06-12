/**
 * UJverse — StreakBadge: 🔥 X dni z rzędu.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pokazuje aktualny streak w kompaktowym pillu. Gradient płomienia
 * intensyfikuje się przy dłuższych streakach (3+, 7+, 30+). Renderuje
 * `null` gdy streak = 0 (no-op dla nowych userów).
 */
import { Flame } from 'lucide-react'
import { useGamificationContext } from '../../lib/gamificationContext'

type Props = {
  /** `small` (default) — header/dashboard; `large` — profile page hero. */
  variant?: 'small' | 'large'
  className?: string
  onClick?: () => void
  /** Nawet gdy streak=0, pokaż "🔥 0" — np. na profilu jako edukacja. */
  showZero?: boolean
}

function flameColor(days: number): { bg: string; text: string; ring: string } {
  if (days >= 30) {
    return {
      bg: 'bg-gradient-to-br from-rose-500 to-orange-500',
      text: 'text-white',
      ring: 'ring-orange-300/40',
    }
  }
  if (days >= 7) {
    return {
      bg: 'bg-gradient-to-br from-orange-500 to-amber-500',
      text: 'text-white',
      ring: 'ring-orange-300/30',
    }
  }
  if (days >= 3) {
    return {
      bg: 'bg-gradient-to-br from-amber-500 to-yellow-500',
      text: 'text-white',
      ring: 'ring-amber-300/30',
    }
  }
  return {
    bg: 'bg-gradient-to-br from-amber-400/80 to-orange-400/80',
    text: 'text-white',
    ring: 'ring-amber-200/30',
  }
}

export default function StreakBadge({
  variant = 'small',
  className = '',
  onClick,
  showZero = false,
}: Props) {
  const ctx = useGamificationContext()
  if (!ctx) return null
  const { progress } = ctx
  const days = progress.current_streak

  if (days <= 0 && !showZero) return null

  const c = flameColor(days)

  if (variant === 'small') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Streak: ${days} ${days === 1 ? 'dzień' : 'dni'} z rzędu`}
        className={[
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1',
          c.bg,
          c.text,
          c.ring,
          onClick ? 'cursor-pointer transition-transform hover:scale-105' : 'cursor-default',
          className,
        ].join(' ')}
      >
        <Flame size={11} strokeWidth={2.5} className="-mx-0.5" />
        <span className="tabular-nums">{days}</span>
      </button>
    )
  }

  return (
    <div
      className={[
        'inline-flex items-center gap-3 rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/10 to-rose-500/10 px-4 py-3',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          c.bg,
          c.text,
          'shadow-md shadow-orange-500/30 ring-2 ring-white/40 dark:ring-white/10',
        ].join(' ')}
      >
        <Flame size={22} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700/80 dark:text-orange-300/80">
          Streak
        </p>
        <p className="tabular-nums text-lg font-extrabold text-fg-primary">
          {days} {days === 1 ? 'dzień' : 'dni'}
        </p>
        {progress.longest_streak > days && (
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Najdłuższy: {progress.longest_streak}
          </p>
        )}
      </div>
    </div>
  )
}
