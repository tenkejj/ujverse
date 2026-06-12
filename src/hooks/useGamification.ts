/**
 * UJverse — useGamification: state + actions dla XP / level / streak /
 * achievements.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Hook:
 *   1. Fetchuje pełny progress (XP + level + streak + lista odznak) na mount.
 *   2. Realtime subskrypcja na `user_progress` (UPDATE) + `user_achievements`
 *      (INSERT) dla zalogowanego usera → live update bez refetcha.
 *   3. Exposes `awardXp` / `unlockAchievement` które:
 *      - wywołują RPC (idempotent server-side)
 *      - jeśli awardedXp > 0 → emit `xpToast` event (UI listenuje globalnie)
 *      - jeśli newly unlocked → emit `achievementUnlocked` event
 *   4. `updateStreakOnce()` — wywołane raz przy starcie sesji.
 *
 * Wszystkie metody są no-op gdy `userId` jest null.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { GamificationService } from '../services/GamificationService'
import { supabase } from '../supabaseClient'
import { emitXpToast, emitAchievementUnlocked } from '../lib/gamificationEvents'
import type {
  AchievementKey,
  UnlockedAchievement,
  UserProgress,
  XpEventType,
} from '../types/gamification'

const EMPTY_PROGRESS: UserProgress = {
  user_id: '',
  total_xp: 0,
  level: 1,
  current_streak: 0,
  longest_streak: 0,
  last_login_date: null,
}

export type UseGamificationResult = {
  progress: UserProgress
  achievements: UnlockedAchievement[]
  unlockedKeys: ReadonlySet<string>
  loading: boolean
  /**
   * Idempotent. Wywołaj z `refId` żeby zapobiec double-counts dla zdarzeń
   * per-objekt (np. `messageId` przy `aula_message`). Dla zdarzeń one-shot
   * (np. `ai_used`) pomiń `refId` — unique constraint na (user,type,'')
   * zapewni że tylko pierwszy strzał naliczy XP.
   */
  awardXp: (eventType: XpEventType, xp: number, refId?: string) => Promise<void>
  unlockAchievement: (key: AchievementKey) => Promise<void>
  /**
   * Wywoływane raz per session przy mount (App.tsx). Bezpiecznie wywoływane
   * wielokrotnie — RPC ma własny "already_today" guard.
   */
  updateStreakOnce: () => Promise<void>
  refetch: () => Promise<void>
}

type Params = { userId: string | null }

export function useGamification({ userId }: Params): UseGamificationResult {
  const [progress, setProgress] = useState<UserProgress>(EMPTY_PROGRESS)
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const streakUpdatedRef = useRef(false)

  const refetch = useCallback(async () => {
    if (!userId) {
      setProgress(EMPTY_PROGRESS)
      setAchievements([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await GamificationService.getUserProgress(userId)
    if (data) {
      setProgress(data.progress)
      setAchievements(data.achievements)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // ── Realtime: progress + new achievements ───────────────────────────
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`gamification:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as UserProgress
          setProgress((prev) => ({
            ...prev,
            ...next,
          }))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Re-fetch tylko nowy achievement (mała tabela, OK).
          const key = (payload.new as { achievement_key: string }).achievement_key
          const { data } = await GamificationService.getAchievements(userId)
          setAchievements(data)
          const just = data.find((a) => a.key === key)
          if (just) {
            emitAchievementUnlocked(just)
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const awardXp = useCallback(
    async (eventType: XpEventType, xp: number, refId?: string) => {
      if (!userId || xp <= 0) return
      const { data, error } = await GamificationService.awardXp({
        userId,
        eventType,
        xp,
        refId: refId ?? null,
      })
      if (error || !data) return
      if (data.awarded_xp > 0) {
        emitXpToast({
          amount: data.awarded_xp,
          eventType,
          leveledUp: data.leveled_up,
          newLevel: data.new_level,
        })
        // Optimistic patch — Realtime dogoni, ale UI nie powinien czekać.
        setProgress((prev) => ({
          ...prev,
          total_xp: data.new_total_xp,
          level: data.new_level,
        }))
      }
    },
    [userId],
  )

  const unlockAchievement = useCallback(
    async (key: AchievementKey) => {
      if (!userId) return
      // Server-side idempotent; gdy nowo odblokowane → Realtime INSERT
      // odpali toast + refetch listy w handlerze powyżej.
      await GamificationService.unlockAchievement(userId, key)
    },
    [userId],
  )

  const updateStreakOnce = useCallback(async () => {
    if (!userId || streakUpdatedRef.current) return
    streakUpdatedRef.current = true
    const { data } = await GamificationService.updateStreak(userId)
    if (data && !data.already_today) {
      // Optimistic patch streak — Realtime też dojdzie.
      setProgress((prev) => ({
        ...prev,
        current_streak: data.new_streak,
        longest_streak: data.longest_streak,
        last_login_date: new Date().toISOString().slice(0, 10),
      }))
    }
  }, [userId])

  const unlockedKeys = new Set(achievements.map((a) => a.key))

  return {
    progress,
    achievements,
    unlockedKeys,
    loading,
    awardXp,
    unlockAchievement,
    updateStreakOnce,
    refetch,
  }
}
