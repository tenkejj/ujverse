/**
 * UJverse — ProfileAchievementsPanel: zakładka "Odznaki" na profilu.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Renderuje:
 *   • LevelBadge `large` (level + XP + progress bar do następnego)
 *   • StreakBadge `large` (current + longest streak)
 *   • AchievementsView (grid wszystkich odznak z lock/unlocked)
 *
 * UWAGA: na cudzym profilu LevelBadge/StreakBadge pochodzą z
 * `useGamificationContext` (= aktualnego usera). Nie pokazujemy cudzego
 * XP/streak — to MVP guard, bo publiczny endpoint `getProgress(userId)`
 * wymaga osobnego hooka. W kolejnej iteracji dodamy `useUserProgress`
 * fetching dla viewedHandle. Na razie pokazujemy info-card "to twoje
 * osiągnięcia" gdy `!isOwn`.
 */
import { Lock } from 'lucide-react'
import LevelBadge from '../../gamification/LevelBadge'
import StreakBadge from '../../gamification/StreakBadge'
import AchievementsView from '../../gamification/AchievementsView'

type Props = {
  targetUserId: string | null
  isOwn: boolean
}

export default function ProfileAchievementsPanel({ isOwn }: Props) {
  if (!isOwn) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white/60 p-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-white/[0.06] dark:text-zinc-500">
          <Lock size={20} />
        </div>
        <h3 className="mt-3 text-base font-bold text-fg-primary">Prywatne odznaki</h3>
        <p className="mt-1 text-sm text-fg-secondary">
          Statystyki postępu (XP, streak, odznaki) widzi tylko właściciel profilu.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LevelBadge variant="large" />
        <StreakBadge variant="large" showZero />
      </div>
      <AchievementsView />
    </div>
  )
}
