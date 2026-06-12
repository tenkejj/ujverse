/**
 * UJverse — typy dla systemu gamifikacji (XP / level / streak / achievements).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Lista kluczy achievementów jest sztywno typowana po SQL seedzie w migracji
 * 20260626100000_onboarding_gamification.sql. Dodawanie nowych ⇒ dopisz tu
 * + w SQL + w awardingu wywołującym.
 */

export type AchievementKey =
  // onboarding
  | 'welcome_aboard'
  | 'profile_complete'
  | 'onboarding_done'
  // streak
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  // aula
  | 'first_message'
  | 'aula_starter'
  | 'aula_legend'
  | 'voice_speaker'
  | 'poll_creator'
  | 'note_taker'
  // tasks
  | 'task_first'
  | 'task_done_first'
  | 'task_master'
  // community
  | 'discount_finder'
  | 'discount_hero'
  // social
  | 'social_butterfly'
  | 'lecturer_subscriber'
  | 'helpful'
  // exploration
  | 'ai_curious'
  | 'early_adopter'

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type AchievementCategory =
  | 'onboarding'
  | 'streak'
  | 'aula'
  | 'tasks'
  | 'community'
  | 'social'
  | 'exploration'
  | 'general'

export type UserProgress = {
  user_id: string
  total_xp: number
  level: number
  current_streak: number
  longest_streak: number
  last_login_date: string | null
  updated_at?: string
}

export type UnlockedAchievement = {
  key: AchievementKey | string
  unlocked_at: string
  name: string
  description: string
  icon_name: string
  rarity: AchievementRarity
  category: AchievementCategory | string
  xp_reward: number
}

export type GetUserProgressResult = {
  progress: UserProgress
  achievements: UnlockedAchievement[]
}

/** Wynik RPC `award_xp`. */
export type AwardXpResult = {
  awarded_xp: number
  new_total_xp: number
  new_level: number
  leveled_up: boolean
}

/** Wynik RPC `update_streak`. */
export type UpdateStreakResult = {
  new_streak: number
  longest_streak: number
  was_extended: boolean
  already_today: boolean
}

/**
 * Typy zdarzeń XP — odzwierciedlają `xp_events.event_type`. Trzymamy
 * sztywno żeby uniknąć typo. `daily_login` ma ref_id = data ISO,
 * `aula_message` ma ref_id = messageId etc.
 */
export type XpEventType =
  | 'daily_login'
  | 'aula_message'
  | 'aula_reaction_received'
  | 'aula_voice_sent'
  | 'aula_poll_created'
  | 'aula_note_edited'
  | 'task_created'
  | 'task_completed'
  | 'discount_added'
  | 'profile_completed'
  | 'ai_used'
  | 'onboarding_step'
  | `achievement_${string}`

/**
 * Progi XP per level (level = floor(sqrt(total_xp/100)) + 1).
 * Generujemy lookup do progress bara.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.pow(level - 1, 2) * 100
}

export function levelFromXp(totalXp: number): number {
  if (totalXp < 0) return 1
  return Math.floor(Math.sqrt(totalXp / 100)) + 1
}

export function nextLevelProgress(totalXp: number): {
  level: number
  xpInLevel: number
  xpToNext: number
  pct: number
} {
  const level = levelFromXp(totalXp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const xpInLevel = totalXp - base
  const span = next - base
  const xpToNext = next - totalXp
  const pct = span === 0 ? 0 : Math.min(100, Math.max(0, (xpInLevel / span) * 100))
  return { level, xpInLevel, xpToNext, pct }
}
