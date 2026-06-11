/**
 * UJverse — useCohortAttachments: stan załączników wiadomości Auli
 * (initial fetch + Realtime merge) + cache signed URLs z auto-refresh.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { CohortMessageAttachment } from '../types/database'

const URL_TTL_SECONDS = 3600 // 1h
const REFRESH_WHEN_LESS_THAN_MS = 5 * 60 * 1000 // 5 min
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000 // 1 min

type AttachmentsState = Map<number, CohortMessageAttachment[]>
type SignedEntry = { url: string; expiresAt: number }
type SignedCache = Map<string, SignedEntry>

type Params = {
  cohortId: string | null
}

function pushAttachment(
  state: AttachmentsState,
  row: CohortMessageAttachment,
): AttachmentsState {
  const bucket = state.get(row.message_id) ?? []
  if (bucket.some((a) => a.id === row.id)) return state
  const next = new Map(state)
  next.set(
    row.message_id,
    [...bucket, row].sort((a, b) => a.id - b.id),
  )
  return next
}

function removeAttachment(
  state: AttachmentsState,
  row: CohortMessageAttachment,
): AttachmentsState {
  const bucket = state.get(row.message_id)
  if (!bucket) return state
  const filtered = bucket.filter((a) => a.id !== row.id)
  const next = new Map(state)
  if (filtered.length === 0) next.delete(row.message_id)
  else next.set(row.message_id, filtered)
  return next
}

export function useCohortAttachments({ cohortId }: Params) {
  const [attachmentsByMessage, setAttachments] = useState<AttachmentsState>(
    () => new Map(),
  )
  const stateRef = useRef<AttachmentsState>(new Map())
  const signedCacheRef = useRef<SignedCache>(new Map())
  const [, forceRender] = useState(0)
  const bumpRender = useCallback(() => forceRender((n) => n + 1), [])

  useEffect(() => {
    stateRef.current = attachmentsByMessage
  }, [attachmentsByMessage])

  const refreshUrlsFor = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return
      const fresh = await CohortService.signedUrlsForPaths(paths, URL_TTL_SECONDS)
      const now = Date.now()
      const cache = signedCacheRef.current
      let mutated = false
      for (const [path, url] of fresh) {
        cache.set(path, { url, expiresAt: now + URL_TTL_SECONDS * 1000 })
        mutated = true
      }
      if (mutated) bumpRender()
    },
    [bumpRender],
  )

  // Initial fetch + Realtime subscription
  useEffect(() => {
    if (!cohortId) {
      setAttachments(new Map())
      stateRef.current = new Map()
      signedCacheRef.current = new Map()
      return
    }

    let cancelled = false

    void (async () => {
      const { data, error } = await CohortService.getAttachmentsForCohort(cohortId)
      if (cancelled || error) return
      const fresh: AttachmentsState = new Map()
      const paths: string[] = []
      for (const row of data) {
        const bucket = fresh.get(row.message_id) ?? []
        bucket.push(row)
        fresh.set(row.message_id, bucket)
        paths.push(row.storage_path)
      }
      stateRef.current = fresh
      setAttachments(fresh)
      void refreshUrlsFor(paths)
    })()

    const channel = CohortService.subscribeToAttachments(cohortId, {
      onInsert: (row) => {
        const next = pushAttachment(stateRef.current, row)
        if (next !== stateRef.current) {
          stateRef.current = next
          setAttachments(next)
          void refreshUrlsFor([row.storage_path])
        }
      },
      onDelete: (row) => {
        const next = removeAttachment(stateRef.current, row)
        if (next !== stateRef.current) {
          stateRef.current = next
          setAttachments(next)
          signedCacheRef.current.delete(row.storage_path)
        }
      },
    })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [cohortId, refreshUrlsFor])

  // Periodic re-sign sprawdzanie — odświeża path'y bliskie expiry.
  useEffect(() => {
    if (!cohortId) return
    const id = window.setInterval(() => {
      const now = Date.now()
      const toRefresh: string[] = []
      for (const [path, entry] of signedCacheRef.current) {
        if (entry.expiresAt - now < REFRESH_WHEN_LESS_THAN_MS) {
          toRefresh.push(path)
        }
      }
      if (toRefresh.length > 0) void refreshUrlsFor(toRefresh)
    }, REFRESH_CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [cohortId, refreshUrlsFor])

  const getSignedUrl = useCallback((path: string): string | null => {
    const entry = signedCacheRef.current.get(path)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) return null
    return entry.url
  }, [])

  return useMemo(
    () => ({ attachmentsByMessage, getSignedUrl }),
    [attachmentsByMessage, getSignedUrl],
  )
}
