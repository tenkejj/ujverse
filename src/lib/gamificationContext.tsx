/**
 * UJverse — Context dla systemu gamifikacji.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Pattern jak `LecturerSubscriptionsContext` — provider montuje się raz w
 * `App.tsx` z session.user.id, daje globalny dostęp do progress + akcji
 * `awardXp`/`unlockAchievement` bez prop-drillingu (do AulaView, TaskCreator
 * etc.). Konsumpcja zwraca `null` gdy provider niedostępny — graceful fallback.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useGamification, type UseGamificationResult } from '../hooks/useGamification'

const GamificationContext = createContext<UseGamificationResult | null>(null)

type ProviderProps = {
  userId: string | null
  children: ReactNode
}

export function GamificationProvider({ userId, children }: ProviderProps) {
  const value = useGamification({ userId })
  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  )
}

/** Konsumpcja. Zwraca `null` gdy poza providerem. */
export function useGamificationContext(): UseGamificationResult | null {
  return useContext(GamificationContext)
}
