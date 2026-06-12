/**
 * UJverse — useChannelNote: wspólna notatka per sala (Markdown scratchpad).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzorzec:
 *   - initial fetch (`getChannelNote`) → server state {content, version}
 *   - lokalny `draft` jest oddzielny od server state — user edytuje draft,
 *     debounced (1.5s) autosave wywołuje RPC z `expected_version = serverVersion`
 *   - sukces: server state ← {newVersion, content, last_edited_by/at}
 *   - conflict (RPC RAISE 'conflict:N'): fetch fresh + pokaż banner
 *     "X zaktualizował — sprawdź zmiany"; draft NIE jest auto-mergowany
 *     (user musi się rozwiązać sam — świadomy trade-off LWW vs CRDT)
 *   - Realtime UPDATE od innych: jeśli user NIE ma local edits (draft == content),
 *     po prostu merge'ujemy; jeśli ma local edits, pokazujemy banner
 *     "X edytuje równolegle" i pauzujemy autosave do momentu Resolve
 *   - reset na zmianę `(cohortId, channelId)` — flush pending autosave przed
 *
 * Cohort scoped per channel — re-fetch przy zmianie aktywnego channelu.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { CohortChannelNote } from '../types/database'

const AUTOSAVE_DEBOUNCE_MS = 1500

type Params = {
  cohortId: string | null
  channelId: number | null
  currentUserId: string | null
}

type ServerState = {
  /** `0` gdy notatka nie istnieje jeszcze w DB (1. save = INSERT). */
  version: number
  content: string
  lastEditedBy: string | null
  lastEditedAt: string | null
} | null

export type ChannelNoteStatus =
  | 'idle'
  | 'loading'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'conflict'
  | 'remote-update'
  | 'error'

export function useChannelNote({ cohortId, channelId, currentUserId }: Params) {
  const [server, setServer] = useState<ServerState>(null)
  const [draft, setDraft] = useState<string>('')
  const [status, setStatus] = useState<ChannelNoteStatus>('idle')
  // Snapshot servera na moment ostatniego saveAttempt — używany do detekcji
  // "remote-update" gdy Realtime dostarcza nowy content podczas naszej edycji.
  const serverRef = useRef<ServerState>(null)
  const draftRef = useRef<string>('')
  const saveTimerRef = useRef<number | null>(null)
  // Block autosave gdy 'conflict' lub 'remote-update' — user musi acceptować
  // żeby kontynuować (nie chcemy nadpisywać świeżych cudzych zmian).
  const blockedRef = useRef(false)

  useEffect(() => {
    serverRef.current = server
  }, [server])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  // Initial fetch + Realtime
  useEffect(() => {
    cancelPendingSave()
    blockedRef.current = false

    if (!cohortId) {
      setServer(null)
      setDraft('')
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    void (async () => {
      const { data, error } = await CohortService.getChannelNote(cohortId, channelId)
      if (cancelled) return
      if (error) {
        setStatus('error')
        return
      }
      if (data) {
        const s: ServerState = {
          version: data.version,
          content: data.content,
          lastEditedBy: data.last_edited_by,
          lastEditedAt: data.last_edited_at,
        }
        setServer(s)
        setDraft(data.content)
      } else {
        setServer({ version: 0, content: '', lastEditedBy: null, lastEditedAt: null })
        setDraft('')
      }
      setStatus('idle')
    })()

    const channel = CohortService.subscribeToChannelNotes(cohortId, {
      onInsert: (row) => handleRemoteRow(row),
      onUpdate: (row) => handleRemoteRow(row),
    })

    function handleRemoteRow(row: CohortChannelNote) {
      // Filter na aktualny channel (subscribe jest cohort-scoped).
      const sameChannel =
        (row.channel_id == null && channelId == null) ||
        (row.channel_id != null && channelId != null && row.channel_id === channelId)
      if (!sameChannel) return

      // Ignoruj echo własnego save'a — porównanie po (version, last_edited_by).
      // Po naszym RPC sami już ustawiliśmy ten sam stan; ignorowanie unika
      // niepotrzebnego "remote-update" banneru na własnych edits.
      const cur = serverRef.current
      if (cur && row.version <= cur.version && row.last_edited_by === currentUserId) {
        return
      }

      const newServer: ServerState = {
        version: row.version,
        content: row.content,
        lastEditedBy: row.last_edited_by,
        lastEditedAt: row.last_edited_at,
      }

      // Jeśli user NIE ma local edits (draft == previous server content),
      // bezboleśnie podstawiamy nowy content.
      if (cur && draftRef.current === cur.content) {
        setServer(newServer)
        setDraft(row.content)
        return
      }

      // User ma local edits → pokażmy banner i zablokujmy autosave do
      // momentu jak user "zaakceptuje cudze zmiany" przez `acceptRemote()`.
      setServer(newServer)
      blockedRef.current = true
      setStatus('remote-update')
    }

    return () => {
      cancelled = true
      cancelPendingSave()
      void supabase.removeChannel(channel)
    }
  }, [cohortId, channelId, currentUserId, cancelPendingSave])

  const performSave = useCallback(async () => {
    if (!cohortId) return
    if (blockedRef.current) return
    const cur = serverRef.current
    if (!cur) return

    const localDraft = draftRef.current
    if (localDraft === cur.content) {
      setStatus('saved')
      return
    }

    setStatus('saving')
    const { data, error, conflictVersion } = await CohortService.updateChannelNote({
      cohortId,
      channelId,
      expectedVersion: cur.version,
      content: localDraft,
    })

    if (data) {
      setServer({
        version: data.version,
        content: data.content,
        lastEditedBy: data.last_edited_by,
        lastEditedAt: data.last_edited_at,
      })
      setStatus('saved')
      return
    }

    if (conflictVersion != null) {
      // Konflikt — fetch fresh i zablokuj autosave.
      const { data: fresh } = await CohortService.getChannelNote(cohortId, channelId)
      if (fresh) {
        setServer({
          version: fresh.version,
          content: fresh.content,
          lastEditedBy: fresh.last_edited_by,
          lastEditedAt: fresh.last_edited_at,
        })
      }
      blockedRef.current = true
      setStatus('conflict')
      return
    }

    if (error) {
      setStatus('error')
      toast.error('Nie udało się zapisać notatki.')
    }
  }, [cohortId, channelId])

  /**
   * Zmiana draft'u — schedule autosave 1.5s po stop typing.
   */
  const onChangeDraft = useCallback(
    (next: string) => {
      setDraft(next)
      if (blockedRef.current) {
        // Zostawiamy draft jako-jest (user widzi swoje zmiany), nie schedule'ujemy
        // — banner UI mówi mu że trzeba zaakceptować/rozwiązać konflikt.
        return
      }
      cancelPendingSave()
      setStatus('dirty')
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        void performSave()
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [cancelPendingSave, performSave],
  )

  /**
   * Manual force-save (button "Zapisz teraz"). Pomija debounce; ignoruje
   * blocked (gdy user świadomie chce nadpisać, wciska 2x).
   */
  const saveNow = useCallback(async () => {
    cancelPendingSave()
    await performSave()
  }, [cancelPendingSave, performSave])

  /**
   * "Akceptuję cudze zmiany" (banner remote-update / conflict). Resetuje
   * draft do bieżącego server.content i odblokowuje autosave.
   */
  const acceptRemote = useCallback(() => {
    const cur = serverRef.current
    if (!cur) return
    blockedRef.current = false
    setDraft(cur.content)
    setStatus('saved')
  }, [])

  /**
   * "Zachowaj moje zmiany" — wymusza override server'em mojego drafta.
   * Używamy fresh version (server already up-to-date po fetchu), tak więc
   * następny save będzie INSERT/UPDATE z najnowszym expected_version.
   */
  const overrideWithMine = useCallback(async () => {
    blockedRef.current = false
    await performSave()
  }, [performSave])

  const isDirty = useMemo(
    () => server != null && draft !== server.content,
    [draft, server],
  )

  return useMemo(
    () => ({
      content: draft,
      server,
      status,
      isDirty,
      onChangeDraft,
      saveNow,
      acceptRemote,
      overrideWithMine,
    }),
    [draft, server, status, isDirty, onChangeDraft, saveNow, acceptRemote, overrideWithMine],
  )
}
