/**
 * UJverse — LevelBadge: kompaktowy badge "L5" + progress bar do następnego.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Warianty:
 *   - `compact` (default): tylko "L5" w pillu (do Header / mobile dashboard)
 *   - `withProgress`: pełen badge + thin progress bar pod spodem
 *   - `large`: na profile page, level + XP do następnego + total
 *
 * Wartości czerpiemy z `useGamificationContext`. Renderujemy `null` gdy
 * provider nieobecny — graceful fallback.
 */
import { Zap } from 'lucide-react'
import { useGamificationContext } from '../../lib/gamificationContext'
import { nextLevelProgress } from '../../types/gamification'

type Props = {
  variant?: 'compact' | 'withProgress' | 'large'
  className?: string
  onClick?: () => void
}

export default function LevelBadge({
  variant = 'compact',
  className = '',
  onClick,
}: Props) {
  const ctx = useGamificationContext()
  if (!ctx) return null
  const { progress } = ctx
  const { level, xpInLevel, xpToNext, pct } = nextLevelProgress(progress.total_xp)

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Level ${level} • ${progress.total_xp} XP`}
        className={[
          'inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-500/20 dark:text-violet-200',
          onClick ? 'cursor-pointer' : 'cursor-default',
          className,
        ].join(' ')}
      >
        <Zap size={10} strokeWidth={2.5} />
        L{level}
      </button>
    )
  }

  if (variant === 'withProgress') {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Level ${level} — ${xpToNext} XP do następnego`}
        className={[
          'group inline-flex min-w-0 items-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 px-2.5 py-1.5 transition-colors hover:from-violet-500/15 hover:to-fuchsia-500/15',
          onClick ? 'cursor-pointer' : 'cursor-default',
          className,
        ].join(' ')}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-extrabold text-white shadow-sm shadow-violet-500/30">
          {level}
        </span>
        <div className="min-w-0 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700/90 dark:text-violet-200/90">
            Level {level}
          </div>
          <div className="relative mt-0.5 h-1 w-20 overflow-hidden rounded-full bg-violet-500/15">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width]"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
        </div>
      </button>
    )
  }

  // large
  return (
    <div
      className={[
        'rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-4',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-base font-extrabold text-white shadow-md shadow-violet-500/30">
          {level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700/80 dark:text-violet-200/80">
            Twój poziom
          </p>
          <p className="text-lg font-extrabold text-fg-primary">Level {level}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700/80 dark:text-violet-200/80">
            Total XP
          </p>
          <p className="tabular-nums text-base font-bold text-fg-primary">{progress.total_xp}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
          <span>{xpInLevel} XP w tym levelu</span>
          <span className="tabular-nums">{xpToNext} do L{level + 1}</span>
        </div>
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-violet-500/15">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width]"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}
