/**
 * UJverse — hook do briefingu tygodniowego.
 *
 * Politika: domyślnie wywołuje `ensure_weekly_briefing` na bieżącym tygodniu
 * przy mount/zmianie usera. To gwarantuje że widget na feedzie pokaże świeży
 * briefing nawet jeśli cron nie wystartował (lub apka jest na środowisku bez
 * Vercel Cron Jobs). RPC jest idempotentne, więc 100 jednoczesnych callów dla
 * jednego usera tworzy 1 wiersz dzięki UNIQUE(user_id, week_start).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { DataService } from '../services/DataService'
import type { WeeklyBriefingRow } from '../types/briefing'

type Params = {
  userId: string | null
  /**
   * Gdy `false`, hook pobiera tylko ostatni istniejący briefing bez triggera
   * generacji. Używaj `false` dla historycznych widoków, `true` (default) dla
   * widgetów na feedzie i dla głównego `/briefing`.
   */
  autoEnsure?: boolean
}

type State = {
  briefing: WeeklyBriefingRow | null
  loading: boolean
  error: string | null
}

export function useWeeklyBriefing({ userId, autoEnsure = true }: Params) {
  const [state, setState] = useState<State>({ briefing: null, loading: false, error: null })
  const userRef = useRef(userId)
  useEffect(() => {
    userRef.current = userId
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ briefing: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    if (autoEnsure) {
      const { row, error } = await DataService.ensureWeeklyBriefing()
      if (userRef.current !== userId) return
      if (error) {
        // Detekcja brakującej migracji — pomocna w dev.
        const lower = (error ?? '').toLowerCase()
        const friendly =
          lower.includes('ensure_weekly_briefing') && lower.includes('does not exist')
            ? 'Brak RPC ensure_weekly_briefing — wklej migrację 20260622100000_weekly_briefings.sql.'
            : error
        setState({ briefing: null, loading: false, error: friendly })
        return
      }
      setState({ briefing: row, loading: false, error: null })
      return
    }
    const row = await DataService.latestWeeklyBriefing()
    if (userRef.current !== userId) return
    setState({ briefing: row, loading: false, error: null })
  }, [autoEnsure, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, refresh }
}
