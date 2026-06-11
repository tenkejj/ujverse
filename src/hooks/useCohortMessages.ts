import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'
import { CohortService, type CohortMessageWithAuthor } from '../services/CohortService'
import type { Profile } from '../types'

const PAGE_SIZE = 50

export type CohortMessageNode = CohortMessageWithAuthor & {
  children: CohortMessageNode[]
}

/**
 * Buduje drzewo wątków z płaskiej, posortowanej rosnąco listy wiadomości.
 * Wzorzec z `sortCommentsForThread` w App.tsx — sieroty (parent skasowany
 * lokalnie) lądują jako korzenie, żeby nie zniknęły z widoku.
 */
export function buildMessageTree(
  messages: CohortMessageWithAuthor[],
): CohortMessageNode[] {
  const byId = new Map<number, CohortMessageNode>()
  for (const m of messages) byId.set(m.id, { ...m, children: [] })

  const roots: CohortMessageNode[] = []
  for (const m of messages) {
    const node = byId.get(m.id)!
    const parent = m.parent_id != null ? byId.get(m.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

type Params = {
  cohortId: string | null
  currentUserId: string
  myProfile: Profile | null
  /**
   * Konwencja:
   *   - `null` = virtual #general (filter `channel_id IS NULL`)
   *   - `number` = konkretny sub-kanał
   *   - `undefined` = parent jeszcze nie ustalił aktywnego kanału — hook
   *     defensywnie traktuje jak `null` (#general).
   */
  channelId?: number | null
}

/**
 * Stan czatu rocznika: początkowy fetch + paginacja wstecz + Realtime merge.
 *
 * Wysyłka jest optymistyczna (temp negative id → realne id po INSERT) wzorem
 * `submitComment` w App.tsx. Realtime: zdarzenia spoza własnych wstawek
 * wywołują debounced `syncLatest()`, który dociąga najnowsze i merguje po id
 * (update/insert), więc edycje i soft-delete też się propagują.
 *
 * Channel filter: subskrybujemy całego cohortu (`cohort_id=eq.X`) i klient-side
 * odfiltrowujemy eventy z innego `channel_id` w aktywnym widoku. Powód: jeden
 * Realtime channel per cohort jest tańszy niż per-channel × N (większość
 * userów ma <10 sub-kanałów, więc traffic minimalny).
 */
export function useCohortMessages({ cohortId, currentUserId, myProfile, channelId }: Params) {
  const activeChannelId: number | null = channelId === undefined ? null : channelId
  const [messages, setMessages] = useState<CohortMessageWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const syncTimer = useRef<number | null>(null)

  const mergeById = useCallback((incoming: CohortMessageWithAuthor[]) => {
    setMessages((prev) => {
      const map = new Map<number, CohortMessageWithAuthor>()
      for (const m of prev) map.set(m.id, m)
      for (const m of incoming) {
        const existing = map.get(m.id)
        // Zachowaj osadzony profil, jeśli świeży wiersz go nie ma.
        map.set(m.id, { ...existing, ...m, profiles: m.profiles ?? existing?.profiles ?? null })
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    })
  }, [])

  const initialLoad = useCallback(async () => {
    if (!cohortId) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await CohortService.getMessages(cohortId, {
      limit: PAGE_SIZE,
      channelId: activeChannelId,
    })
    if (error) {
      console.error('[useCohortMessages] initial load', error.message)
      setMessages([])
    } else {
      setMessages(data)
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [cohortId, activeChannelId])

  const loadOlder = useCallback(async () => {
    if (!cohortId || loadingOlder || messages.length === 0) return
    const oldest = messages[0]
    if (!oldest) return
    setLoadingOlder(true)
    const { data, error } = await CohortService.getMessages(cohortId, {
      before: oldest.created_at,
      limit: PAGE_SIZE,
      channelId: activeChannelId,
    })
    if (!error) {
      mergeById(data)
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoadingOlder(false)
  }, [cohortId, loadingOlder, messages, mergeById, activeChannelId])

  const syncLatest = useCallback(async () => {
    if (!cohortId) return
    const { data, error } = await CohortService.getMessages(cohortId, {
      limit: PAGE_SIZE,
      channelId: activeChannelId,
    })
    if (!error) mergeById(data)
  }, [cohortId, mergeById, activeChannelId])

  // Initial fetch
  useEffect(() => {
    void initialLoad()
  }, [initialLoad])

  // Realtime
  useEffect(() => {
    if (!cohortId) return
    const scheduleSync = () => {
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => {
        void syncLatest()
        syncTimer.current = null
      }, 400)
    }
    // Client-side filter: ignoruj eventy z innego kanału niż aktywny widok.
    // (Realtime filter w Supabase nie obsługuje OR po cohort+channel, więc
    // łapiemy cały cohort i sprawdzamy `channel_id` po stronie klienta.)
    const isOtherChannel = (
      row: { channel_id?: number | null },
    ): boolean => {
      const incoming = row.channel_id == null ? null : Number(row.channel_id)
      return incoming !== activeChannelId
    }

    const channel = CohortService.subscribeToMessages(
      cohortId,
      {
        onInsert: (row) => {
          if (row.user_id === currentUserId) return
          if (isOtherChannel(row)) return
          scheduleSync()
        },
        onUpdate: (row) => {
          if (isOtherChannel(row)) return
          // Edycje/soft-delete merguj (także własne z innego urządzenia).
          mergeById([{ ...(row as CohortMessageWithAuthor), profiles: null }])
        },
        onDelete: (row) => {
          // DELETE może nieść payload z innego kanału — odfiltruj.
          if (isOtherChannel(row)) return
          setMessages((prev) => prev.filter((m) => m.id !== row.id))
        },
      },
      (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useCohortMessages] realtime status:', status)
        }
      },
    )
    return () => {
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [cohortId, currentUserId, mergeById, syncLatest, activeChannelId])

  const sendMessage = useCallback(
    async (
      content: string,
      parentId?: number | null,
      attachmentInputs?: Array<{
        storagePath: string
        fileName: string
        mimeType: string
        sizeBytes: number
        width: number | null
        height: number | null
      }>,
    ) => {
      const trimmed = content.trim()
      const hasAttachments = (attachmentInputs?.length ?? 0) > 0
      if ((!trimmed && !hasAttachments) || !cohortId) return

      const tempId = -Date.now()
      const optimistic: CohortMessageWithAuthor = {
        id: tempId,
        cohort_id: cohortId,
        user_id: currentUserId,
        content: trimmed,
        parent_id: parentId ?? null,
        channel_id: activeChannelId,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        pinned_at: null,
        pinned_by: null,
        profiles: myProfile,
      }
      setMessages((prev) => [...prev, optimistic])

      const { data, error } = await CohortService.sendMessage({
        cohortId,
        userId: currentUserId,
        // Pusty content gdy są attachments — RLS pozwala (NOT NULL ale '' OK).
        content: trimmed,
        parentId: parentId ?? null,
        channelId: activeChannelId,
      })
      if (error || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        toast.error('Nie udało się wysłać wiadomości.')
        return
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...data, profiles: data.profiles ?? myProfile } : m)),
      )

      // Po sukcesie wiadomości: INSERT wpisów o załącznikach. Wiadomość zostaje,
      // nawet jeśli któryś attachment się sypnie — UX prosty, nie blokujemy.
      if (hasAttachments && attachmentInputs) {
        const results = await Promise.all(
          attachmentInputs.map((att) =>
            CohortService.createAttachmentRecord({
              messageId: data.id,
              userId: currentUserId,
              storagePath: att.storagePath,
              fileName: att.fileName,
              mimeType: att.mimeType,
              sizeBytes: att.sizeBytes,
              width: att.width,
              height: att.height,
            }),
          ),
        )
        const failed = results.filter((r) => r.error).length
        if (failed > 0) {
          toast.error(
            failed === 1
              ? 'Wiadomość wysłana, ale 1 plik nie został dodany.'
              : `Wiadomość wysłana, ale ${failed} pliki nie zostały dodane.`,
          )
        }
      }
    },
    [cohortId, currentUserId, myProfile, activeChannelId],
  )

  const editMessage = useCallback(
    async (id: number, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const previous = messages.find((m) => m.id === id)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m,
        ),
      )
      const { error } = await CohortService.editMessage(id, trimmed)
      if (error) {
        setMessages((prev) => prev.map((m) => (m.id === id && previous ? previous : m)))
        toast.error('Nie udało się zapisać zmiany.')
      }
    },
    [messages],
  )

  const deleteMessage = useCallback(
    async (id: number) => {
      const previous = messages.find((m) => m.id === id)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: '', deleted_at: new Date().toISOString() } : m,
        ),
      )
      const { error } = await CohortService.softDeleteMessage(id)
      if (error) {
        setMessages((prev) => prev.map((m) => (m.id === id && previous ? previous : m)))
        toast.error('Nie udało się usunąć wiadomości.')
      }
    },
    [messages],
  )

  const tree = useMemo(() => buildMessageTree(messages), [messages])

  return useMemo(
    () => ({
      messages,
      tree,
      loading,
      hasMore,
      loadingOlder,
      loadOlder,
      sendMessage,
      editMessage,
      deleteMessage,
    }),
    [messages, tree, loading, hasMore, loadingOlder, loadOlder, sendMessage, editMessage, deleteMessage],
  )
}
