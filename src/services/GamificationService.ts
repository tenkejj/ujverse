/**
 * UJverse — GamificationService: XP / level / streak / achievements.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wszystko idzie przez SECURITY DEFINER RPC w SQL (front nigdy nie pisze
 * bezpośrednio do `user_progress` / `xp_events`). Wszystkie metody są
 * IDEMPOTENT — bezpiecznie spamowane (drugi raz dla tego samego
 * `event_type` + `ref_id` = no-op, RPC `award_xp` zwraca 0 awardedXp).
 *
 * Konwencja zwracana `{ data, error }` jak `CohortService` / `DiscountsService`.
 */
import { supabase } from '../supabaseClient'
import type { PostgrestError } from '@supabase/supabase-js'
import type {
  AchievementKey,
  AwardXpResult,
  GetUserProgressResult,
  UpdateStreakResult,
  UnlockedAchievement,
  UserProgress,
  XpEventType,
} from '../types/gamification'

type AwardXpInput = {
  userId: string
  eventType: XpEventType
  xp: number
  /**
   * Idempotency key. Dla zdarzeń per-objekt = jego id (np. messageId,
   * taskId). Dla zdarzeń per-day = data ISO (`YYYY-MM-DD`). Dla zdarzeń
   * one-shot = brak — wtedy unique constraint na (user, type, '') blokuje
   * drugi insert.
   */
  refId?: string | null
}

class GamificationServiceImpl {
  // -------------------------------------------------------------------
  // XP
  // -------------------------------------------------------------------

  /**
   * Idempotent naliczenie XP. Drugie wywołanie z tym samym (user,type,ref)
   * zwraca `{awarded_xp: 0}` bez błędu.
   */
  async awardXp(
    input: AwardXpInput,
  ): Promise<{ data: AwardXpResult | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .rpc('award_xp', {
        p_user_id: input.userId,
        p_event_type: input.eventType,
        p_xp: input.xp,
        p_ref_id: input.refId ?? null,
      })
      .select('*')
      .maybeSingle<AwardXpResult>()
    return { data: data ?? null, error }
  }

  // -------------------------------------------------------------------
  // Streak (daily login)
  // -------------------------------------------------------------------

  /**
   * Wywoływane raz przy wejściu w app (per session). RPC ma swój własny
   * guard "already_today", więc nawet podwójne wywołanie nie szkodzi.
   * Auto nalicza daily_login XP + odblokowuje streak_3/7/30.
   */
  async updateStreak(
    userId: string,
  ): Promise<{ data: UpdateStreakResult | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .rpc('update_streak', { p_user_id: userId })
      .select('*')
      .maybeSingle<UpdateStreakResult>()
    return { data: data ?? null, error }
  }

  // -------------------------------------------------------------------
  // Achievements
  // -------------------------------------------------------------------

  /**
   * Idempotent unlock. Auto-award XP z `achievements_catalog.xp_reward`.
   * Zwraca `data: true` gdy nowo odblokowane (do toast / fanfare), `false`
   * gdy już było (no-op, no toast).
   */
  async unlockAchievement(
    userId: string,
    key: AchievementKey,
  ): Promise<{ data: boolean; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .rpc('unlock_achievement', {
        p_user_id: userId,
        p_key: key,
      })
    return { data: data === true, error }
  }

  // -------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------

  /** Pełen progress + odblokowane achievementy (jednym round-tripem). */
  async getUserProgress(
    userId: string,
  ): Promise<{ data: GetUserProgressResult | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .rpc('get_user_progress', { p_user_id: userId })
      .maybeSingle<GetUserProgressResult>()
    return { data: data ?? null, error }
  }

  /** Sam progress (bez achievementów) — szybciej dla headera/badge. */
  async getProgress(
    userId: string,
  ): Promise<{ data: UserProgress | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('user_progress')
      .select('user_id, total_xp, level, current_streak, longest_streak, last_login_date')
      .eq('user_id', userId)
      .maybeSingle<UserProgress>()
    return { data: data ?? null, error }
  }

  /** Lista achievementów cudzego usera (do profile page). */
  async getAchievements(
    userId: string,
  ): Promise<{ data: UnlockedAchievement[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(`
        achievement_key,
        unlocked_at,
        achievements_catalog!inner ( name, description, icon_name, rarity, category, xp_reward )
      `)
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false })
    if (error || !data) return { data: [], error: error ?? null }
    type Row = {
      achievement_key: string
      unlocked_at: string
      achievements_catalog:
        | {
            name: string
            description: string
            icon_name: string
            rarity: 'common' | 'rare' | 'epic' | 'legendary'
            category: string
            xp_reward: number
          }
        | Array<{
            name: string
            description: string
            icon_name: string
            rarity: 'common' | 'rare' | 'epic' | 'legendary'
            category: string
            xp_reward: number
          }>
    }
    const normalized: UnlockedAchievement[] = (data as Row[]).map((r) => {
      const cat = Array.isArray(r.achievements_catalog)
        ? r.achievements_catalog[0]
        : r.achievements_catalog
      return {
        key: r.achievement_key,
        unlocked_at: r.unlocked_at,
        name: cat?.name ?? r.achievement_key,
        description: cat?.description ?? '',
        icon_name: cat?.icon_name ?? 'sparkles',
        rarity: cat?.rarity ?? 'common',
        category: cat?.category ?? 'general',
        xp_reward: cat?.xp_reward ?? 0,
      }
    })
    return { data: normalized, error: null }
  }
}

export const GamificationService = new GamificationServiceImpl()
