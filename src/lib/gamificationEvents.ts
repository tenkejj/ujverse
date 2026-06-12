/**
 * UJverse — global event bus dla gamifikacji.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Komponenty UI (XpToastStack, AchievementUnlockedModal) słuchają tutaj
 * zamiast prop-drillingu przez całą aplikację. Używamy CustomEvent na
 * `window`, bez zewnętrznego deps — wystarcza dla 2 event types.
 *
 * Konwencja: emit z `useGamification.awardXp` / Realtime handler dla
 * `user_achievements INSERT`.
 */
import type { UnlockedAchievement, XpEventType } from '../types/gamification'

export type XpToastPayload = {
  amount: number
  eventType: XpEventType
  leveledUp: boolean
  newLevel: number
}

const XP_EVENT = 'ujverse:xp-toast'
const ACH_EVENT = 'ujverse:achievement-unlocked'

export function emitXpToast(payload: XpToastPayload): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<XpToastPayload>(XP_EVENT, { detail: payload }))
}

export function onXpToast(cb: (payload: XpToastPayload) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const ce = e as CustomEvent<XpToastPayload>
    if (ce.detail) cb(ce.detail)
  }
  window.addEventListener(XP_EVENT, handler)
  return () => window.removeEventListener(XP_EVENT, handler)
}

export function emitAchievementUnlocked(payload: UnlockedAchievement): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<UnlockedAchievement>(ACH_EVENT, { detail: payload }),
  )
}

export function onAchievementUnlocked(
  cb: (payload: UnlockedAchievement) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => {
    const ce = e as CustomEvent<UnlockedAchievement>
    if (ce.detail) cb(ce.detail)
  }
  window.addEventListener(ACH_EVENT, handler)
  return () => window.removeEventListener(ACH_EVENT, handler)
}
