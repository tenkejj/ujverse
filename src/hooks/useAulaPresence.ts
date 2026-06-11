/**
 * UJverse — useAulaPresence: lekka subskrypcja Supabase Realtime Presence,
 * pokazuje "kto jest teraz w Auli" (ephemeral, brak DB).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type Params = {
  cohortId: string | null
  currentUserId: string | null
  /** Jeśli false (np. user wyszedł z widoku Auli) — nie trackujemy. */
  enabled?: boolean
}

type PresenceMeta = { user_id: string; joined_at: number }

/**
 * Wchodzi w channel `aula-online-<cohortId>`, trackuje obecność aktualnego
 * usera, zwraca Set ID-ków online. Cleanup robi `untrack()` + `removeChannel()`.
 */
export function useAulaPresence({ cohortId, currentUserId, enabled = true }: Params) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!enabled || !cohortId || !currentUserId) {
      setOnlineIds(new Set())
      return
    }

    const channel = supabase.channel(`aula-online-${cohortId}`, {
      config: {
        // `presence.key` musi być stabilne per user — pozwala wykrywać duplikaty zakładek.
        presence: { key: currentUserId },
      },
    })

    const syncState = () => {
      const state = channel.presenceState<PresenceMeta>()
      const ids = new Set<string>()
      for (const key of Object.keys(state)) {
        // klucz to user_id (z config.presence.key); meta wpisy potwierdzają.
        const metas = state[key]
        if (metas && metas.length > 0) ids.add(key)
      }
      setOnlineIds(ids)
    }

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUserId,
            joined_at: Date.now(),
          } satisfies PresenceMeta)
        }
      })

    return () => {
      void (async () => {
        try {
          await channel.untrack()
        } catch {
          /* noop */
        }
        await supabase.removeChannel(channel)
      })()
    }
  }, [cohortId, currentUserId, enabled])

  return useMemo(
    () => ({ onlineIds, onlineCount: onlineIds.size }),
    [onlineIds],
  )
}
