import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataService } from '../services/DataService'
import { useEvents as useEventsContext } from './useEvents'
import type {
  AnnouncementMeta,
  ClubMeta,
  EventMeta,
  PostMeta,
  UnifiedContent,
} from '../types/content'
import type { Post } from '../types'

/* ─────────────────────────── Koła naukowe ─────────────────────────── */

export type UseClubsResult = {
  clubs: UnifiedContent<ClubMeta>[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useClubs(): UseClubsResult {
  const [clubs, setClubs] = useState<UnifiedContent<ClubMeta>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await DataService.listClubs()
      if (!aliveRef.current) return
      setClubs(items)
    } catch (err) {
      if (!aliveRef.current) return
      const message = err instanceof Error ? err.message : 'Nie udało się pobrać kół.'
      setError(message)
      setClubs([])
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    aliveRef.current = true
    void reload()
    return () => {
      aliveRef.current = false
    }
  }, [reload])

  return { clubs, loading, error, reload }
}

/* ─────────────────────────── Komunikaty ─────────────────────────── */

export type UseAnnouncementsResult = {
  announcements: UnifiedContent<AnnouncementMeta>[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useAnnouncements(department?: string): UseAnnouncementsResult {
  const [announcements, setAnnouncements] = useState<UnifiedContent<AnnouncementMeta>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const items = await DataService.listAnnouncements({ department })
        if (!aliveRef.current) return
        setError(null)
        setAnnouncements(items)
      } catch (err) {
        if (!aliveRef.current) return
        const message = err instanceof Error ? err.message : 'Błąd pobierania komunikatów.'
        setError(message)
        setAnnouncements([])
      } finally {
        if (aliveRef.current && !silent) setLoading(false)
      }
    },
    [department],
  )

  useEffect(() => {
    aliveRef.current = true
    void load({ silent: false })

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = DataService.subscribeAnnouncements(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void load({ silent: true })
      }, 1500)
    })

    return () => {
      aliveRef.current = false
      if (debounceTimer) clearTimeout(debounceTimer)
      unsubscribe()
    }
  }, [load])

  return {
    announcements,
    loading,
    error,
    reload: useCallback(() => load({ silent: false }), [load]),
  }
}

/* ─────────────────────────── Posty ─────────────────────────── */

export type UsePostsInput = {
  posts: Post[]
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  commentsCountByPost: Record<string, number>
}

/**
 * Pure-mapper hook: przyjmuje stan postów z App.tsx i zwraca UnifiedContent.
 * Nie wykonuje fetchy (posty mają skomplikowany cykl życia z likes/comments).
 */
export function usePosts(input: UsePostsInput): UnifiedContent<PostMeta>[] {
  return useMemo(
    () =>
      DataService.toUnifiedPosts(input.posts, {
        likesCountByPost: input.likesCountByPost,
        likedPostIds: input.likedPostIds,
        commentsCountByPost: input.commentsCountByPost,
      }),
    [input.posts, input.likesCountByPost, input.likedPostIds, input.commentsCountByPost],
  )
}

/* ─────────────────────────── Wydarzenia ─────────────────────────── */

export type UseUnifiedEventsResult = {
  events: UnifiedContent<EventMeta>[]
  allEvents: UnifiedContent<EventMeta>[]
  featured: UnifiedContent<EventMeta> | null
}

/**
 * Wrapper nad kontekstem `useEvents` — mapuje UJEvent na UnifiedContent.
 * Mutacje (toggleRsvp/addEvent) nadal żyją w kontekście `useEvents()`.
 */
export function useUnifiedEvents(): UseUnifiedEventsResult {
  const { events, allEvents, featuredEvent } = useEventsContext()
  return useMemo(
    () => ({
      events: DataService.toUnifiedEvents(events),
      allEvents: DataService.toUnifiedEvents(allEvents),
      featured: featuredEvent ? (DataService.toUnifiedEvents([featuredEvent])[0] ?? null) : null,
    }),
    [events, allEvents, featuredEvent],
  )
}
