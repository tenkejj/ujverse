/**
 * UJverse — useChannelTyping: per-channel typing indicators dla Auli.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Realtime BROADCAST (NIE database) — ephemeral, zero migracji SQL, zero
 * inwazji w postgres. Każdy kanał (sub-channel lub Sala główna) ma własny
 * broadcast channel `aula-typing-<cohortId>-<channelKey>` żeby cross-channel
 * typing nie generował noise'u.
 *
 * Wzorzec:
 *   - sender: `notifyTyping()` w composerze, throttled 3s — broadcast event
 *     `typing` z `{ userId, name, ts }`
 *   - receiver: subscribuje to samo, dodaje do Map<userId, { name, expiresAt }>,
 *     1s tick czyści wygasłe (TTL 5s od ostatniego eventa)
 *   - Self-filter: ignorujemy własne eventy (sender = currentUserId)
 *   - Mute reset: zmiana kanału / cohortu re-subscribuje, lokalna mapa
 *     reset
 *
 * Convention typing TTL = 5s, throttle 3s — Discord-like (Discord ma TTL ~10s,
 * throttle 5s ale dla małych roczników wolimy responsywniej).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

const TYPING_TTL_MS = 5_000
const NOTIFY_THROTTLE_MS = 3_000
const EXPIRY_TICK_MS = 1_000

type Params = {
  cohortId: string | null
  /** `null` = Sala główna (#general). */
  channelId: number | null
  currentUserId: string | null
  /** Display name (full_name lub username) — broadcastowany jako label. */
  currentUserName: string | null
}

export type TypingUser = {
  userId: string
  name: string
  expiresAt: number
}

type TypingPayload = {
  userId: string
  name: string
  ts: number
}

function channelKey(channelId: number | null): string {
  return channelId == null ? 'general' : String(channelId)
}

export function useChannelTyping({
  cohortId,
  channelId,
  currentUserId,
  currentUserName,
}: Params) {
  const [typingMap, setTypingMap] = useState<Map<string, TypingUser>>(() => new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastNotifyRef = useRef<number>(0)

  // Subscribe per (cohort, channel). Re-subscribe gdy któreś się zmieni.
  useEffect(() => {
    setTypingMap(new Map())

    if (!cohortId || !currentUserId) {
      channelRef.current = null
      return
    }

    const topic = `aula-typing-${cohortId}-${channelKey(channelId)}`
    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const raw = payload as Partial<TypingPayload> | undefined
        if (!raw || typeof raw.userId !== 'string' || typeof raw.name !== 'string') return
        // self-filter defensywnie (broadcast.self=false już to robi, ale
        // dodatkowo chronimy przed echem multi-tab tego samego usera).
        if (raw.userId === currentUserId) return
        const now = Date.now()
        setTypingMap((prev) => {
          const next = new Map(prev)
          next.set(raw.userId!, {
            userId: raw.userId!,
            name: raw.name!,
            expiresAt: now + TYPING_TTL_MS,
          })
          return next
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [cohortId, channelId, currentUserId])

  // Expiry tick — czyści wpisy gdzie `expiresAt <= now`.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTypingMap((prev) => {
        if (prev.size === 0) return prev
        const now = Date.now()
        let mutated = false
        const next = new Map(prev)
        for (const [k, v] of prev) {
          if (v.expiresAt <= now) {
            next.delete(k)
            mutated = true
          }
        }
        return mutated ? next : prev
      })
    }, EXPIRY_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  /**
   * Broadcastuje że aktualny user pisze. Throttle 3s — można wołać per
   * keystroke, hook samodzielnie wysyła max raz na 3s.
   */
  const notifyTyping = useCallback(() => {
    const channel = channelRef.current
    if (!channel || !currentUserId) return
    const name = (currentUserName ?? '').trim() || 'Ktoś'
    const now = Date.now()
    if (now - lastNotifyRef.current < NOTIFY_THROTTLE_MS) return
    lastNotifyRef.current = now
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, name, ts: now } satisfies TypingPayload,
    })
  }, [currentUserId, currentUserName])

  const typingUsers = useMemo<TypingUser[]>(() => {
    const now = Date.now()
    return Array.from(typingMap.values())
      .filter((u) => u.expiresAt > now)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [typingMap])

  return useMemo(
    () => ({ typingUsers, notifyTyping }),
    [typingUsers, notifyTyping],
  )
}
