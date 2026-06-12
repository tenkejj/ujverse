/**
 * UJverse — useCohortChannelMutes: per-user per-channel notification prefs.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzorzec danych:
 *   - `mutesByChannel: Map<channelId|null, CohortChannelMute>` — `null` key
 *     = Sala główna (#general). Brak wpisu = `mode = 'all'` (default).
 *   - Snooze: `muted_until > now()` = aktywny, ≤ now() = wygasły (UI traktuje
 *     jak `'all'`, gc tick re-snapshotuje co 60s żeby usunąć z mapy).
 *   - Realtime na `cohort_channel_mutes` (RLS filtruje server-side do
 *     `user_id = auth.uid()`).
 *
 * NIE jest source of truth dla notyfikacji — to robi SQL trigger
 * `handle_cohort_message_*_notification` po stronie DB. Hook tylko UI-side
 * read/write.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { ChannelMuteMode, CohortChannelMute } from '../types/database'

type Params = {
  cohortId: string | null
  /**
   * Filter podwójny: RLS już robi `user_id = auth.uid()`, ale hook też
   * zostawia ten guard dla testów / przyszłej multi-user logic.
   */
  userId: string | null
}

/** Map key: `channelId` jako number lub `null` dla Sali głównej. */
type MuteMap = Map<number | null, CohortChannelMute>

function buildMap(rows: CohortChannelMute[]): MuteMap {
  const m: MuteMap = new Map()
  const nowMs = Date.now()
  for (const r of rows) {
    if (r.muted_until != null && new Date(r.muted_until).getTime() <= nowMs) {
      continue
    }
    m.set(r.channel_id, r)
  }
  return m
}

export function useCohortChannelMutes({ cohortId, userId }: Params) {
  const [mutesByChannel, setMutesByChannel] = useState<MuteMap>(new Map())
  const [loading, setLoading] = useState(true)
  const reqIdRef = useRef(0)

  const fetchAll = useCallback(async () => {
    if (!cohortId || !userId) {
      setMutesByChannel(new Map())
      setLoading(false)
      return
    }
    const reqId = ++reqIdRef.current
    setLoading(true)
    const { data, error } = await CohortService.getChannelMutes(cohortId)
    if (reqId !== reqIdRef.current) return
    if (error) {
      console.error('[useCohortChannelMutes] fetch', error.message)
      setMutesByChannel(new Map())
    } else {
      setMutesByChannel(buildMap(data))
    }
    setLoading(false)
  }, [cohortId, userId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Realtime — RLS filtruje do własnych rows.
  useEffect(() => {
    if (!cohortId || !userId) return
    const channel = CohortService.subscribeToChannelMutes(cohortId, {
      onInsert: (row) => {
        if (row.user_id !== userId) return
        setMutesByChannel((prev) => {
          const next = new Map(prev)
          if (row.muted_until != null && new Date(row.muted_until).getTime() <= Date.now()) {
            next.delete(row.channel_id)
          } else {
            next.set(row.channel_id, row)
          }
          return next
        })
      },
      onUpdate: (row) => {
        if (row.user_id !== userId) return
        setMutesByChannel((prev) => {
          const next = new Map(prev)
          if (row.muted_until != null && new Date(row.muted_until).getTime() <= Date.now()) {
            next.delete(row.channel_id)
          } else {
            next.set(row.channel_id, row)
          }
          return next
        })
      },
      onDelete: (row) => {
        if (row.user_id !== userId) return
        setMutesByChannel((prev) => {
          if (!prev.has(row.channel_id)) return prev
          const next = new Map(prev)
          next.delete(row.channel_id)
          return next
        })
      },
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cohortId, userId])

  // Snooze GC: co 60s usuń z mapy wpisy które wygasły (UI od razu odzwierciedla
  // powrót do default state bez czekania na page reload).
  useEffect(() => {
    if (!cohortId) return
    const id = window.setInterval(() => {
      setMutesByChannel((prev) => {
        if (prev.size === 0) return prev
        const nowMs = Date.now()
        let mutated = false
        const next = new Map(prev)
        for (const [k, v] of prev) {
          if (v.muted_until != null && new Date(v.muted_until).getTime() <= nowMs) {
            next.delete(k)
            mutated = true
          }
        }
        return mutated ? next : prev
      })
    }, 60_000)
    return () => window.clearInterval(id)
  }, [cohortId])

  const getMuteMode = useCallback(
    (channelId: number | null): ChannelMuteMode => {
      const row = mutesByChannel.get(channelId)
      if (!row) return 'all'
      return row.mode
    },
    [mutesByChannel],
  )

  const getMutedUntil = useCallback(
    (channelId: number | null): Date | null => {
      const row = mutesByChannel.get(channelId)
      if (!row || row.muted_until == null) return null
      return new Date(row.muted_until)
    },
    [mutesByChannel],
  )

  const isMuted = useCallback(
    (channelId: number | null): boolean => {
      const mode = getMuteMode(channelId)
      return mode !== 'all'
    },
    [getMuteMode],
  )

  const setMute = useCallback(
    async (
      channelId: number | null,
      mode: ChannelMuteMode,
      snoozeHours?: number | null,
    ): Promise<boolean> => {
      if (!cohortId) return false
      // Optymistyczna aktualizacja UI: dla 'all' usuń, dla innych ustaw lokalnie.
      const previous = mutesByChannel.get(channelId) ?? null
      setMutesByChannel((prev) => {
        const next = new Map(prev)
        if (mode === 'all') {
          next.delete(channelId)
        } else {
          const muted_until =
            snoozeHours != null && snoozeHours > 0
              ? new Date(Date.now() + snoozeHours * 3600_000).toISOString()
              : null
          next.set(channelId, {
            id: previous?.id ?? -1,
            user_id: userId ?? '',
            cohort_id: cohortId,
            channel_id: channelId,
            mode,
            muted_until,
            created_at: previous?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
        return next
      })

      const { error } = await CohortService.setChannelMute({
        cohortId,
        channelId,
        mode,
        snoozeHours: snoozeHours ?? null,
      })
      if (error) {
        // Rollback optimistic.
        setMutesByChannel((prev) => {
          const next = new Map(prev)
          if (previous) next.set(channelId, previous)
          else next.delete(channelId)
          return next
        })
        toast.error('Nie udało się zmienić wyciszenia.')
        return false
      }
      // Success toast — krótkie potwierdzenie.
      if (mode === 'all') {
        toast.success('Wznowiono powiadomienia.')
      } else if (mode === 'mentions_only') {
        toast.success('Tylko wzmianki będą Cię powiadamiać.')
      } else {
        toast.success('Wyciszono powiadomienia.')
      }
      return true
    },
    [cohortId, userId, mutesByChannel],
  )

  return useMemo(
    () => ({
      mutesByChannel,
      loading,
      getMuteMode,
      getMutedUntil,
      isMuted,
      setMute,
      refetch: fetchAll,
    }),
    [mutesByChannel, loading, getMuteMode, getMutedUntil, isMuted, setMute, fetchAll],
  )
}
