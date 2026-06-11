import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { CohortMessage } from '../types/database'
import type { Profile } from '../types'

const STORAGE_KEY = 'ujverse.aula.lastSeenAt'

type Params = {
  userId: string | null
  myProfile: Profile | null
  /** True gdy user aktualnie jest na widoku Auli — wtedy nie pokazujemy badge i nie subskrybujemy. */
  isOnAula: boolean
}

function readLastSeen(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeLastSeen(iso: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, iso)
  } catch {
    /* noop — localStorage może być zablokowane */
  }
}

/**
 * Lekka subskrypcja "czy w moim roczniku jest coś nowego" dla badge'a w nawigacji.
 *
 * Nie ładujemy wiadomości — tylko nasłuchujemy `cohort_messages` INSERT z filtrem
 * `cohort_id=eq.<id>` i porównujemy `created_at` z `lastSeenAt` w localStorage.
 * Subskrypcja jest skipowana gdy user już patrzy na Aulę (`isOnAula`), więc
 * nie dublujemy strumienia z `useCohortMessages`.
 */
export function useAulaUnread({ userId, myProfile, isOnAula }: Params) {
  const [hasUnread, setHasUnread] = useState(false)
  const [cohortId, setCohortId] = useState<string | null>(null)

  const hasStudyFields =
    !!myProfile?.study_program && myProfile?.year_started != null && !!myProfile?.study_mode

  // Fetch cohortId jednorazowo gdy profil ma komplet pól.
  useEffect(() => {
    if (!userId || !hasStudyFields) {
      setCohortId(null)
      return
    }
    let cancelled = false
    void CohortService.getMyCohorts(userId).then(({ data }) => {
      if (!cancelled) setCohortId(data[0]?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [userId, hasStudyFields])

  // Reset markera gdy user wchodzi w Aulę.
  const markSeen = useCallback(() => {
    writeLastSeen(new Date().toISOString())
    setHasUnread(false)
  }, [])

  useEffect(() => {
    if (isOnAula) markSeen()
  }, [isOnAula, markSeen])

  // Realtime na cohort_messages.
  useEffect(() => {
    if (!cohortId || !userId || isOnAula) return

    const channel = supabase
      .channel(`aula-presence-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cohort_messages',
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          const row = payload.new as CohortMessage
          if (row.user_id === userId) return
          const lastSeen = readLastSeen()
          if (!lastSeen || new Date(row.created_at).getTime() > new Date(lastSeen).getTime()) {
            setHasUnread(true)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cohortId, userId, isOnAula])

  return useMemo(() => ({ hasUnread, markSeen }), [hasUnread, markSeen])
}
