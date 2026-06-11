/**
 * UJverse — useCohortReactions: agregat reakcji emoji dla wiadomości Auli.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { CohortMessageReaction } from '../types/database'

/** Zagregowany wpis per (message, emoji). `mine` = czy zalogowany user już reagował. */
export type ReactionAggregate = {
  emoji: string
  count: number
  mine: boolean
  userIds: string[]
}

type Props = {
  cohortId: string | null
  currentUserId: string
}

type ReactionsState = Map<number, ReactionAggregate[]>

function applyInsert(
  state: ReactionsState,
  row: CohortMessageReaction,
  currentUserId: string,
): ReactionsState {
  const next = new Map(state)
  const bucket = [...(next.get(row.message_id) ?? [])]
  const idx = bucket.findIndex((b) => b.emoji === row.emoji)
  if (idx === -1) {
    bucket.push({
      emoji: row.emoji,
      count: 1,
      mine: row.user_id === currentUserId,
      userIds: [row.user_id],
    })
  } else {
    const agg = bucket[idx]!
    if (agg.userIds.includes(row.user_id)) {
      // duplicate event — no-op
      return state
    }
    bucket[idx] = {
      ...agg,
      count: agg.count + 1,
      mine: agg.mine || row.user_id === currentUserId,
      userIds: [...agg.userIds, row.user_id],
    }
  }
  next.set(row.message_id, bucket)
  return next
}

function applyDelete(
  state: ReactionsState,
  row: CohortMessageReaction,
  currentUserId: string,
): ReactionsState {
  const bucket = state.get(row.message_id)
  if (!bucket) return state
  const idx = bucket.findIndex((b) => b.emoji === row.emoji)
  if (idx === -1) return state
  const agg = bucket[idx]!
  if (!agg.userIds.includes(row.user_id)) return state
  const nextUserIds = agg.userIds.filter((u) => u !== row.user_id)
  const nextBucket = [...bucket]
  if (nextUserIds.length === 0) {
    nextBucket.splice(idx, 1)
  } else {
    nextBucket[idx] = {
      ...agg,
      count: nextUserIds.length,
      mine: agg.mine && row.user_id !== currentUserId ? agg.mine : nextUserIds.includes(currentUserId),
      userIds: nextUserIds,
    }
  }
  const next = new Map(state)
  if (nextBucket.length === 0) next.delete(row.message_id)
  else next.set(row.message_id, nextBucket)
  return next
}

/**
 * Subskrybuje reakcje cohortu + initial fetch. Zwraca Map<messageId, aggregates[]>
 * oraz `toggleReaction` z optimistic update + rollback na błędzie.
 */
export function useCohortReactions({ cohortId, currentUserId }: Props) {
  const [reactionsByMessage, setReactionsByMessage] = useState<ReactionsState>(
    () => new Map(),
  )
  const reactionsRef = useRef<ReactionsState>(new Map())

  // Trzymamy ref równolegle do state'a żeby Realtime callback nie capturował
  // przestarzałego state przy szybkich INSERT/DELETE w tym samym rendererze.
  useEffect(() => {
    reactionsRef.current = reactionsByMessage
  }, [reactionsByMessage])

  // Initial fetch + Realtime subscription.
  useEffect(() => {
    if (!cohortId) {
      setReactionsByMessage(new Map())
      reactionsRef.current = new Map()
      return
    }

    let cancelled = false

    void (async () => {
      const { data, error } = await CohortService.getReactionsForCohort(cohortId)
      if (cancelled || error) return
      const fresh: ReactionsState = new Map()
      for (const row of data) {
        const bucket = fresh.get(row.message_id) ?? []
        const idx = bucket.findIndex((b) => b.emoji === row.emoji)
        if (idx === -1) {
          bucket.push({
            emoji: row.emoji,
            count: 1,
            mine: row.user_id === currentUserId,
            userIds: [row.user_id],
          })
        } else {
          const agg = bucket[idx]!
          bucket[idx] = {
            ...agg,
            count: agg.count + 1,
            mine: agg.mine || row.user_id === currentUserId,
            userIds: [...agg.userIds, row.user_id],
          }
        }
        fresh.set(row.message_id, bucket)
      }
      if (!cancelled) {
        reactionsRef.current = fresh
        setReactionsByMessage(fresh)
      }
    })()

    const channel = CohortService.subscribeToReactions(cohortId, {
      onInsert: (row) => {
        const next = applyInsert(reactionsRef.current, row, currentUserId)
        reactionsRef.current = next
        setReactionsByMessage(next)
      },
      onDelete: (row) => {
        const next = applyDelete(reactionsRef.current, row, currentUserId)
        reactionsRef.current = next
        setReactionsByMessage(next)
      },
    })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [cohortId, currentUserId])

  const toggleReaction = useCallback(
    async (messageId: number, emoji: string) => {
      const current = reactionsRef.current.get(messageId) ?? []
      const existing = current.find((a) => a.emoji === emoji)
      const isMine = existing?.mine ?? false

      // Optimistic
      const optimisticRow: CohortMessageReaction = {
        id: -Date.now(),
        message_id: messageId,
        cohort_id: '',
        user_id: currentUserId,
        emoji,
        created_at: new Date().toISOString(),
      }
      const before = reactionsRef.current
      const after = isMine
        ? applyDelete(before, optimisticRow, currentUserId)
        : applyInsert(before, optimisticRow, currentUserId)
      reactionsRef.current = after
      setReactionsByMessage(after)

      const { error } = isMine
        ? await CohortService.removeReaction(messageId, emoji, currentUserId)
        : await CohortService.addReaction(messageId, emoji, currentUserId)

      if (error) {
        // rollback
        reactionsRef.current = before
        setReactionsByMessage(before)
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn('[aula] reaction toggle failed:', error.message)
        }
      }
    },
    [currentUserId],
  )

  return { reactionsByMessage, toggleReaction }
}
