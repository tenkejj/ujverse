/**
 * UJverse — useCohortPolls: stan ankiet (polls + votes) dla cohortu.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzorzec analogiczny do `useCohortAttachments`:
 *   - initial fetch (polls + votes razem dla cohortu)
 *   - Realtime subscribe (jeden channel `aula-polls-<cohortId>`, dwóch listenerów)
 *   - Map<messageId, CohortPollAggregate> z votes pre-aggregated per opcja
 *   - optimistic `vote()`: lokalna mutacja Map → RPC → na error rollback
 *
 * Cohort-scoped (nie per-channel) bo polls jest 1:1 z cohort_message, a
 * cohort_message niezawsze ma `channel_id` (Sala główna = NULL). Filtrowanie
 * po channel robi UI tylko gdy konsument pyta przez `aggregateForMessage(id)`
 * — hook NIE filtruje proaktywnie.
 *
 * Optimistic vote — przy zmianie głosu (myVoteIndex z A na B) lokalnie
 * dekrementujemy counts[A] + usuwamy z votersPerOption[A] i symetrycznie
 * dodajemy do B. RPC `vote_on_poll` jest atomowe, więc Realtime wkrótce
 * potwierdzi (idempotentne ze względu na pushVote/removeVote które są
 * uniqueness-safe).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type {
  CohortMessagePoll,
  CohortPollAggregate,
  CohortPollVote,
} from '../types/database'

type PollsState = Map<number, CohortPollAggregate> // messageId → aggregate

type Params = {
  cohortId: string | null
  currentUserId: string | null
}

function buildAggregate(
  poll: CohortMessagePoll,
  votes: CohortPollVote[],
  currentUserId: string | null,
): CohortPollAggregate {
  const n = poll.options.length
  const countsPerOption = new Array<number>(n).fill(0)
  const votersPerOption: string[][] = Array.from({ length: n }, () => [])
  let myVoteIndex: number | null = null

  for (const v of votes) {
    if (v.option_index < 0 || v.option_index >= n) continue
    countsPerOption[v.option_index] += 1
    votersPerOption[v.option_index].push(v.user_id)
    if (currentUserId && v.user_id === currentUserId) myVoteIndex = v.option_index
  }

  return {
    poll,
    countsPerOption,
    votersPerOption,
    totalVotes: votes.length,
    myVoteIndex,
  }
}

function applyVoteToAggregate(
  agg: CohortPollAggregate,
  userId: string,
  optionIndex: number,
  isCurrentUser: boolean,
): CohortPollAggregate {
  const n = agg.poll.options.length
  if (optionIndex < 0 || optionIndex >= n) return agg

  const countsPerOption = agg.countsPerOption.slice()
  const votersPerOption = agg.votersPerOption.map((arr) => arr.slice())

  // Najpierw usuń ewentualny istniejący głos tego usera (single-select invariant).
  for (let i = 0; i < n; i += 1) {
    const idx = votersPerOption[i].indexOf(userId)
    if (idx >= 0) {
      votersPerOption[i].splice(idx, 1)
      countsPerOption[i] = Math.max(0, countsPerOption[i] - 1)
    }
  }

  // Dodaj nowy głos.
  if (!votersPerOption[optionIndex].includes(userId)) {
    votersPerOption[optionIndex].push(userId)
    countsPerOption[optionIndex] += 1
  }

  const totalVotes = countsPerOption.reduce((s, c) => s + c, 0)
  const myVoteIndex = isCurrentUser ? optionIndex : agg.myVoteIndex

  return { poll: agg.poll, countsPerOption, votersPerOption, totalVotes, myVoteIndex }
}

function removeVoteFromAggregate(
  agg: CohortPollAggregate,
  userId: string,
  isCurrentUser: boolean,
): CohortPollAggregate {
  const n = agg.poll.options.length
  const countsPerOption = agg.countsPerOption.slice()
  const votersPerOption = agg.votersPerOption.map((arr) => arr.slice())
  let removed = false

  for (let i = 0; i < n; i += 1) {
    const idx = votersPerOption[i].indexOf(userId)
    if (idx >= 0) {
      votersPerOption[i].splice(idx, 1)
      countsPerOption[i] = Math.max(0, countsPerOption[i] - 1)
      removed = true
    }
  }

  if (!removed) return agg

  const totalVotes = countsPerOption.reduce((s, c) => s + c, 0)
  const myVoteIndex = isCurrentUser ? null : agg.myVoteIndex

  return { poll: agg.poll, countsPerOption, votersPerOption, totalVotes, myVoteIndex }
}

export function useCohortPolls({ cohortId, currentUserId }: Params) {
  const [pollsByMessage, setPollsByMessage] = useState<PollsState>(() => new Map())
  const stateRef = useRef<PollsState>(new Map())
  // Pomocniczy index: pollId → messageId żeby Realtime na votes mogło szybko
  // znaleźć aggregate (votes nie znają messageId).
  const pollIdToMessageIdRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    stateRef.current = pollsByMessage
  }, [pollsByMessage])

  // Initial fetch + Realtime
  useEffect(() => {
    if (!cohortId) {
      setPollsByMessage(new Map())
      stateRef.current = new Map()
      pollIdToMessageIdRef.current = new Map()
      return
    }

    let cancelled = false

    void (async () => {
      const [{ data: polls, error: pollsErr }] = await Promise.all([
        CohortService.getPollsForCohort(cohortId),
      ])
      if (cancelled || pollsErr || polls.length === 0) {
        if (!cancelled && !pollsErr) {
          stateRef.current = new Map()
          setPollsByMessage(new Map())
        }
        return
      }

      const pollIds = polls.map((p) => p.id)
      const { data: votes, error: votesErr } = await CohortService.getVotesForPolls(pollIds)
      if (cancelled || votesErr) return

      const votesByPoll = new Map<number, CohortPollVote[]>()
      for (const v of votes) {
        const bucket = votesByPoll.get(v.poll_id) ?? []
        bucket.push(v)
        votesByPoll.set(v.poll_id, bucket)
      }

      const fresh: PollsState = new Map()
      const idx = new Map<number, number>()
      for (const poll of polls) {
        const agg = buildAggregate(poll, votesByPoll.get(poll.id) ?? [], currentUserId)
        fresh.set(poll.message_id, agg)
        idx.set(poll.id, poll.message_id)
      }
      stateRef.current = fresh
      pollIdToMessageIdRef.current = idx
      setPollsByMessage(fresh)
    })()

    const channel = CohortService.subscribeToPolls(cohortId, {
      onPollInsert: (row) => {
        // Świeży poll — initial state z pustymi votes (Realtime na votes
        // dosypie kolejne wpisy w miarę głosowań).
        const agg = buildAggregate(row, [], currentUserId)
        const next = new Map(stateRef.current)
        next.set(row.message_id, agg)
        stateRef.current = next
        pollIdToMessageIdRef.current.set(row.id, row.message_id)
        setPollsByMessage(next)
      },
      onPollUpdate: (row) => {
        // Update = zmiana closed_at (jedyna mutacja przez RLS).
        const existing = stateRef.current.get(row.message_id)
        if (!existing) return
        const next = new Map(stateRef.current)
        next.set(row.message_id, { ...existing, poll: row })
        stateRef.current = next
        setPollsByMessage(next)
      },
      onVoteInsert: (row) => {
        const messageId = pollIdToMessageIdRef.current.get(row.poll_id)
        if (messageId == null) return
        const existing = stateRef.current.get(messageId)
        if (!existing) return
        const isMe = currentUserId != null && row.user_id === currentUserId
        const updated = applyVoteToAggregate(existing, row.user_id, row.option_index, isMe)
        if (updated === existing) return
        const next = new Map(stateRef.current)
        next.set(messageId, updated)
        stateRef.current = next
        setPollsByMessage(next)
      },
      onVoteDelete: (row) => {
        const messageId = pollIdToMessageIdRef.current.get(row.poll_id)
        if (messageId == null) return
        const existing = stateRef.current.get(messageId)
        if (!existing) return
        const isMe = currentUserId != null && row.user_id === currentUserId
        const updated = removeVoteFromAggregate(existing, row.user_id, isMe)
        if (updated === existing) return
        const next = new Map(stateRef.current)
        next.set(messageId, updated)
        stateRef.current = next
        setPollsByMessage(next)
      },
    })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [cohortId, currentUserId])

  /**
   * Optimistic vote (single-select). `optionIndex === null` = cofnięcie
   * głosu. Lokalna mutacja → RPC → rollback (snapshot) gdy error.
   */
  const vote = useCallback(
    async (messageId: number, optionIndex: number | null) => {
      if (!currentUserId) {
        toast.error('Musisz być zalogowany żeby głosować.')
        return
      }
      const existing = stateRef.current.get(messageId)
      if (!existing) return
      if (existing.poll.closed_at != null) {
        toast.error('Ta ankieta jest już zamknięta.')
        return
      }

      const snapshot = existing
      const optimistic =
        optionIndex == null
          ? removeVoteFromAggregate(existing, currentUserId, true)
          : applyVoteToAggregate(existing, currentUserId, optionIndex, true)

      if (optimistic !== existing) {
        const next = new Map(stateRef.current)
        next.set(messageId, optimistic)
        stateRef.current = next
        setPollsByMessage(next)
      }

      const { error } = await CohortService.voteOnPoll(
        existing.poll.id,
        optionIndex ?? -1,
      )
      if (error) {
        const rollback = new Map(stateRef.current)
        rollback.set(messageId, snapshot)
        stateRef.current = rollback
        setPollsByMessage(rollback)
        toast.error('Nie udało się zapisać głosu.')
      }
    },
    [currentUserId],
  )

  /**
   * Zamknij ankietę (tylko twórca — RLS / RPC blokuje innych). Optimistic
   * update closed_at; rollback nie jest tu krytyczny bo RPC FAIL pokaże toast.
   */
  const closePoll = useCallback(async (messageId: number) => {
    const existing = stateRef.current.get(messageId)
    if (!existing) return
    if (existing.poll.closed_at != null) return

    const { error } = await CohortService.closePoll(existing.poll.id)
    if (error) {
      toast.error('Nie udało się zamknąć ankiety.')
      return
    }
    // Realtime UPDATE potwierdzi closed_at, ale natychmiast pokażmy
    // optimistically żeby UI nie czekał na round-trip.
    const updated = {
      ...existing,
      poll: { ...existing.poll, closed_at: new Date().toISOString() },
    }
    const next = new Map(stateRef.current)
    next.set(messageId, updated)
    stateRef.current = next
    setPollsByMessage(next)
  }, [])

  return useMemo(
    () => ({ pollsByMessage, vote, closePoll }),
    [pollsByMessage, vote, closePoll],
  )
}
