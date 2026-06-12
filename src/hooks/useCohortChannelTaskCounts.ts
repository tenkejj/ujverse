/**
 * UJverse — useCohortChannelTaskCounts: liczba OTWARTYCH zadań per sala
 * w obrębie jednej kohorty. Używane do badge przy nazwie sali w `ChannelRail`
 * i `ChannelsSheet` (mobile).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzorzec:
 *   - initial fetch (`CohortService.getOpenTaskCountsForCohort`) — jedno
 *     query z agregacją po stronie klienta (mała tabela, akceptowalne).
 *   - Realtime subscribe (jeden channel `aula-task-counts-<cohortId>`)
 *     na INSERT/UPDATE/DELETE w `cohort_channel_tasks` per cohort_id.
 *     Każde zdarzenie wymusza pełny refetch — prosto, bez ryzyka
 *     desynchronizacji, koszt minimalny (rzadkie operacje).
 *   - Klucz `channel_id|null` → number (Sala główna pod kluczem `null`).
 *
 * NIE pobiera ukończonych — w UI badge pokazuje TYLKO otwarte.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'

type Params = {
  cohortId: string | null
}

type Result = {
  /** Mapa channel_id → liczba otwartych zadań. Sala główna pod kluczem `null`. */
  counts: Map<number | null, number>
  refresh: () => Promise<void>
}

export function useCohortChannelTaskCounts({ cohortId }: Params): Result {
  const [counts, setCounts] = useState<Map<number | null, number>>(new Map())
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!cohortId) {
      setCounts(new Map())
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const { data } = await CohortService.getOpenTaskCountsForCohort(cohortId)
      setCounts(data)
    } finally {
      inFlightRef.current = false
    }
  }, [cohortId])

  useEffect(() => {
    if (!cohortId) return
    void refresh()

    const channel = supabase
      .channel(`aula-task-counts-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cohort_channel_tasks',
          filter: `cohort_id=eq.${cohortId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cohortId, refresh])

  return { counts, refresh }
}
