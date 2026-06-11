/**
 * UJverse — useChannelUnread: per-channel unread tracker dla ChannelRail.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Lekki, session-scoped tracker — bez initial fetcha. Realtime na
 * `cohort_messages` INSERT (filter `cohort_id=eq.<id>`) zapełnia `Set` z
 * channel id (lub `null` dla #general) gdy `created_at > lastSeen[key]`.
 *
 * Auto-marks aktywny kanał jako seen przy `activeChannelId` change (user
 * przegląda dany kanał → znika kropka). Storage key per cohort:
 *   `ujverse.aula.channelLastSeen.<cohortId>` → JSON `{ "general": iso,
 *   "<channelId>": iso }`.
 *
 * Świadomy trade-off: bez initial fetcha nie widzimy "dawnych" unread (sprzed
 * sesji). To wymagałoby query per cohort startowo — nieproporcjonalny koszt
 * dla MVP. `useAulaUnread` (cohort-wide, dla nav badge) zostaje niezmieniony.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { CohortMessage } from '../types/database'

const STORAGE_PREFIX = 'ujverse.aula.channelLastSeen.'
const GENERAL_KEY = 'general'

type Params = {
  cohortId: string | null
  currentUserId: string
  /** Aktualnie otwarty kanał — auto-mark seen przy zmianie. */
  activeChannelId: number | null
}

type LastSeenMap = Record<string, string>

function storageKey(cohortId: string): string {
  return `${STORAGE_PREFIX}${cohortId}`
}

function readLastSeen(cohortId: string): LastSeenMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(cohortId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LastSeenMap
    }
    return {}
  } catch {
    return {}
  }
}

function writeLastSeen(cohortId: string, map: LastSeenMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(cohortId), JSON.stringify(map))
  } catch {
    /* noop — localStorage może być zablokowane */
  }
}

function channelKey(channelId: number | null): string {
  return channelId == null ? GENERAL_KEY : String(channelId)
}

export function useChannelUnread({ cohortId, currentUserId, activeChannelId }: Params) {
  const [unreadChannels, setUnreadChannels] = useState<Set<number | null>>(
    () => new Set(),
  )
  const lastSeenRef = useRef<LastSeenMap>({})

  // Reset state przy zmianie cohortu + załaduj lastSeen z localStorage.
  useEffect(() => {
    if (!cohortId) {
      lastSeenRef.current = {}
      setUnreadChannels(new Set())
      return
    }
    lastSeenRef.current = readLastSeen(cohortId)
    setUnreadChannels(new Set())
  }, [cohortId])

  const markChannelSeen = useCallback(
    (channelId: number | null) => {
      if (!cohortId) return
      const key = channelKey(channelId)
      const next: LastSeenMap = {
        ...lastSeenRef.current,
        [key]: new Date().toISOString(),
      }
      lastSeenRef.current = next
      writeLastSeen(cohortId, next)
      setUnreadChannels((prev) => {
        if (!prev.has(channelId)) return prev
        const updated = new Set(prev)
        updated.delete(channelId)
        return updated
      })
    },
    [cohortId],
  )

  // Auto-mark aktywnego kanału jako seen przy każdej zmianie + przy każdej
  // wstawce do unreadChannels (gdy user JEST na tym kanale, kropka nigdy
  // nie powinna się pojawić).
  useEffect(() => {
    if (!cohortId) return
    markChannelSeen(activeChannelId)
  }, [cohortId, activeChannelId, markChannelSeen])

  // Realtime na cohort_messages INSERT.
  useEffect(() => {
    if (!cohortId) return
    const channel = supabase
      .channel(`aula-channel-unread-${cohortId}`)
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
          if (row.user_id === currentUserId) return
          const incomingChannel = row.channel_id == null ? null : Number(row.channel_id)
          // Jeśli user właśnie patrzy na ten kanał — zignoruj (auto-mark
          // effect i tak by go zaraz wyczyścił, ale szybciej nie wstawiać).
          if (incomingChannel === activeChannelId) return

          const key = channelKey(incomingChannel)
          const lastSeen = lastSeenRef.current[key]
          if (lastSeen && new Date(row.created_at).getTime() <= new Date(lastSeen).getTime()) {
            return
          }
          setUnreadChannels((prev) => {
            if (prev.has(incomingChannel)) return prev
            const updated = new Set(prev)
            updated.add(incomingChannel)
            return updated
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cohortId, currentUserId, activeChannelId])

  return useMemo(
    () => ({ unreadChannels, markChannelSeen }),
    [unreadChannels, markChannelSeen],
  )
}
