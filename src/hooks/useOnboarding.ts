/**
 * UJverse — useOnboarding: czy pokazać tour + actions do mark complete/skip.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Logika:
 *   • `shouldShow` = `true` gdy user zalogowany + onboarding_completed_at
 *     i onboarding_skipped_at są oba `null`.
 *   • `complete()` → ustaw `onboarding_completed_at = now()` w `profiles`,
 *     patchuje lokalny state przez `onProfilePatch`.
 *   • `skip()` → ustaw `onboarding_skipped_at = now()`. User dalej może
 *     wrócić ręcznie do touru (np. z settingsów) — patrz `resetSkip()`.
 *   • Zwracamy też `forceOpen()` żeby user mógł re-otworzyć z menu / settings.
 *
 * Lokalny `manualOpen` flag pozwala otworzyć tour kiedykolwiek niezależnie
 * od `profiles` (np. user klika "zobacz wprowadzenie jeszcze raz").
 */
import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

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

  const completed = !!myProfile?.onboarding_completed_at
  const skipped = !!myProfile?.onboarding_skipped_at

  const autoShouldShow = useMemo(() => {
    if (!userId || !myProfile) return false
    if (completed || skipped) return false
    return true
  }, [userId, myProfile, completed, skipped])

  // Manual close zamyka panel także w trybie auto, do następnego mount.
  const shouldShow = (autoShouldShow && !manualClose) || manualOpen

  const complete = useCallback(async () => {
    if (!userId) return
    const now = new Date().toISOString()
    onProfilePatch({ onboarding_completed_at: now })
    setManualOpen(false)
    await supabase
      .from('profiles')
      .update({ onboarding_completed_at: now })
      .eq('id', userId)
  }, [userId, onProfilePatch])

  const skip = useCallback(async () => {
    if (!userId) return
    const now = new Date().toISOString()
    onProfilePatch({ onboarding_skipped_at: now })
    setManualOpen(false)
    setManualClose(true)
    await supabase
      .from('profiles')
      .update({ onboarding_skipped_at: now })
      .eq('id', userId)
  }, [userId, onProfilePatch])

  const forceOpen = useCallback(() => {
    setManualClose(false)
    setManualOpen(true)
  }, [])

  const close = useCallback(() => {
    setManualOpen(false)
    setManualClose(true)
  }, [])

  return { shouldShow, complete, skip, forceOpen, close }
}
