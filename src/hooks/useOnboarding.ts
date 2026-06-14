/**
 * UJverse — useOnboarding: czy pokazać tour + actions do mark complete/skip.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Logika:
 *   • `shouldShow` = `true` gdy user zalogowany + onboarding_completed_at
 *     i onboarding_skipped_at są oba `null`, ORAZ brak lokalnej flagi
 *     dismissed w `localStorage` (per userId).
 *   • `complete()` → ustaw `onboarding_completed_at = now()` w `profiles`,
 *     patchuje lokalny state przez `onProfilePatch` i zapisuje
 *     `localStorage` flagę dismissed (defensywa przeciw stale fetchom
 *     profilu bez kolumn onboarding_*).
 *   • `skip()` → analogicznie, ustawia `onboarding_skipped_at`.
 *   • `forceOpen()` czyści lokalną flagę i otwiera tour ręcznie (np.
 *     z menu "zobacz wprowadzenie jeszcze raz").
 *
 * Defensywa per-user `localStorage`:
 *   Profil w App.tsx jest re-fetchowany przy każdej zmianie session
 *   (Supabase Auth refreshuje token przy `visibilitychange`). Gdyby
 *   SELECT zapomniał o kolumnach onboarding_*, hook bez tej flagi
 *   re-otworzyłby tour po każdej zmianie okna. Flaga + DB to belt
 *   and suspenders — DB jest źródłem prawdy między urządzeniami,
 *   localStorage gwarantuje stabilność w obrębie sesji przeglądarki.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

const LOCAL_STORAGE_KEY = 'ujverse:onboarding-dismissed'

/**
 * Per-browser cache "user XYZ przeszedł / pominął tour".
 * Chroni przed re-otwarciem touru gdy stale fetch profilu (np. po
 * window switch / supabase auth refresh) zwróci dane bez kolumn
 * `onboarding_completed_at` / `onboarding_skipped_at`.
 */
function readDismissed(userId: string | null): boolean {
  if (!userId || typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, true>
    return parsed[userId] === true
  } catch {
    return false
  }
}

function writeDismissed(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, true>
    parsed[userId] = true
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* localStorage może być wyłączony — graceful skip */
  }
}

function clearDismissed(userId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, true>
    delete parsed[userId]
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* noop */
  }
}

type ProfilePatch = Partial<Pick<Profile, 'onboarding_completed_at' | 'onboarding_skipped_at'>>

type Params = {
  userId: string | null
  myProfile: Profile | null
  onProfilePatch: (patch: ProfilePatch) => void
}

export type UseOnboardingResult = {
  shouldShow: boolean
  complete: () => Promise<void>
  skip: () => Promise<void>
  forceOpen: () => void
  close: () => void
}

export function useOnboarding({ userId, myProfile, onProfilePatch }: Params): UseOnboardingResult {
  const [manualOpen, setManualOpen] = useState(false)
  const [manualClose, setManualClose] = useState(false)

  // Per-user localStorage flag (defensywne kicker przeciw stale fetchom
  // profilu bez kolumn onboarding_*). Re-czytamy gdy zmienia się userId.
  const [dismissedLocally, setDismissedLocally] = useState(() => readDismissed(userId))
  useEffect(() => {
    setDismissedLocally(readDismissed(userId))
  }, [userId])

  const completed = !!myProfile?.onboarding_completed_at
  const skipped = !!myProfile?.onboarding_skipped_at

  // Gdy DB potwierdzi że user faktycznie przeszedł tour — synchronizuj
  // localStorage flagę (np. user przeszedł na innym urządzeniu).
  useEffect(() => {
    if (!userId) return
    if (completed || skipped) {
      if (!dismissedLocally) {
        writeDismissed(userId)
        setDismissedLocally(true)
      }
    }
  }, [userId, completed, skipped, dismissedLocally])

  const autoShouldShow = useMemo(() => {
    if (!userId || !myProfile) return false
    if (completed || skipped) return false
    if (dismissedLocally) return false
    return true
  }, [userId, myProfile, completed, skipped, dismissedLocally])

  const shouldShow = (autoShouldShow && !manualClose) || manualOpen

  // Trzymamy ref żeby uniknąć wyścigu między optymistycznym patchem
  // a kolejnym fetchem profilu (który może wrócić bez onboarding_*).
  const completingRef = useRef(false)

  const complete = useCallback(async () => {
    if (!userId || completingRef.current) return
    completingRef.current = true
    const now = new Date().toISOString()
    writeDismissed(userId)
    setDismissedLocally(true)
    onProfilePatch({ onboarding_completed_at: now })
    setManualOpen(false)
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed_at: now })
        .eq('id', userId)
    } finally {
      completingRef.current = false
    }
  }, [userId, onProfilePatch])

  const skip = useCallback(async () => {
    if (!userId || completingRef.current) return
    completingRef.current = true
    const now = new Date().toISOString()
    writeDismissed(userId)
    setDismissedLocally(true)
    onProfilePatch({ onboarding_skipped_at: now })
    setManualOpen(false)
    setManualClose(true)
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_skipped_at: now })
        .eq('id', userId)
    } finally {
      completingRef.current = false
    }
  }, [userId, onProfilePatch])

  const forceOpen = useCallback(() => {
    if (userId) {
      clearDismissed(userId)
      setDismissedLocally(false)
    }
    setManualClose(false)
    setManualOpen(true)
  }, [userId])

  const close = useCallback(() => {
    setManualOpen(false)
    setManualClose(true)
  }, [])

  return { shouldShow, complete, skip, forceOpen, close }
}
