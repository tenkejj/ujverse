import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type UJEvent } from '../data/mockEvents'
import {
  compareOfficialThenDate,
  eventFromDbRow,
  EVENTS_WITH_AUTHOR_SELECT,
  mergeEventLists,
  normalizeEventAuthor,
  startOfTodayIso,
} from '../lib/eventRow'
import { supabase } from '../supabaseClient'
import {
  hydrateOfficialEventsFromStorage,
  syncExternalEvents as runOfficialIngest,
} from '../services/EventIngestor'

const STORAGE_KEY = 'ujverse_events'

export { compareOfficialThenDate, eventFromDbRow } from '../lib/eventRow'

function reviveEvent(raw: unknown): UJEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.title !== 'string') return null
  const dateVal = o.date
  const date =
    typeof dateVal === 'string'
      ? new Date(dateVal)
      : dateVal instanceof Date
        ? dateVal
        : null
  if (!date || Number.isNaN(date.getTime())) return null

  let attendeeAvatars: string[] | undefined
  if (Array.isArray(o.attendeeAvatars)) {
    const urls = o.attendeeAvatars.filter((u): u is string => typeof u === 'string')
    if (urls.length > 0) attendeeAvatars = urls
  }

  const out: UJEvent = {
    id: o.id,
    title: o.title,
    date,
    category: typeof o.category === 'string' ? o.category : '',
    location: typeof o.location === 'string' ? o.location : '',
    description: typeof o.description === 'string' ? o.description : '',
    attendees: typeof o.attendees === 'number' && Number.isFinite(o.attendees) ? o.attendees : 0,
    isAttending: Boolean(o.isAttending),
  }
  if (typeof o.user_id === 'string' && o.user_id.length > 0) out.user_id = o.user_id
  if (o.author && typeof o.author === 'object') out.author = normalizeEventAuthor(o.author)
  if (typeof o.imageUrl === 'string' && o.imageUrl.length > 0) out.imageUrl = o.imageUrl
  if (typeof o.mapUrl === 'string' && o.mapUrl.length > 0) out.mapUrl = o.mapUrl
  if (attendeeAvatars) out.attendeeAvatars = attendeeAvatars
  if (typeof o.external_id === 'string' && o.external_id.length > 0) out.external_id = o.external_id
  if (typeof o.source_name === 'string' && o.source_name.length > 0) out.source_name = o.source_name
  if (typeof o.is_official === 'boolean') out.is_official = o.is_official
  if (typeof o.event_url === 'string' && o.event_url.length > 0) out.event_url = o.event_url
  const fac = o.faculty
  if (fac === 'WZiKS' || fac === 'Uniwersytet Jagielloński') {
    out.faculty = fac
  }
  if (typeof o.ingest_from_fallback === 'boolean') out.ingest_from_fallback = o.ingest_from_fallback
  return out
}

/** Tylko wydarzenia użytkownika (bez zsynchronizowanych oficjalnych — te są z EventIngestor). */
function loadUserEventsFromStorage(): UJEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const revived = parsed.map(reviveEvent).filter((e): e is UJEvent => e !== null)
    return revived.filter((e) => !e.is_official && e.id.startsWith('local-'))
  } catch {
    return []
  }
}

/** Dane z formularza tworzenia wydarzenia (bez id, attendees, isAttending, attendeeAvatars). */
export type NewEventFormData = Omit<
  UJEvent,
  'id' | 'attendees' | 'isAttending' | 'date' | 'attendeeAvatars'
> & {
  date: string | Date
}

type EventsContextValue = {
  /** Lista wydarzeń do widoku głównego (DB + ingest + lokalne fallbacki). */
  events: UJEvent[]
  /** Najbliższe nadchodzące wydarzenie z plakatem (do sekcji Hero). */
  featuredEvent: UJEvent | null
  /** Pełna lista (także przeszłe) — np. pod przyszły profil / administrację. */
  allEvents: UJEvent[]
  /** True dopóki pierwszy fetch zewnętrznych wydarzeń trwa (opcjonalnie pod UI). */
  externalEventsLoading: boolean
  toggleRsvp: (eventId: string) => void
  addEvent: (data: NewEventFormData) => void
  deleteEvent: (id: string) => void
  /** Klucz z wartością `undefined` usuwa opcjonalne pole (np. imageUrl, mapUrl). */
  updateEvent: (id: string, patch: Partial<UJEvent>) => void
  /** Odświeżenie oficjalnych wydarzeń (ingest + cache 15 min). */
  syncOfficialEvents: (force?: boolean) => Promise<void>
  /** Ostatnia synchronizacja użyła twardo zakodowanych danych (offline / awaria sieci). */
  ingestFromStaticFallback: boolean
  /** Twarde odświeżenie listy wydarzeń z Supabase. */
  refetchDbEvents: () => Promise<void>
}

const EventsContext = createContext<EventsContextValue | null>(null)

function mergeInitialEvents(): UJEvent[] {
  const users = loadUserEventsFromStorage()
  const official = hydrateOfficialEventsFromStorage()
  return mergeEventLists([users, official])
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<UJEvent[]>(mergeInitialEvents)
  const [dbEvents, setDbEvents] = useState<UJEvent[]>([])
  const [externalEventsLoading, setExternalEventsLoading] = useState(false)
  const [ingestFromStaticFallback, setIngestFromStaticFallback] = useState(() =>
    mergeInitialEvents().some((e) => e.ingest_from_fallback),
  )

  const syncOfficialEvents = useCallback(async (force?: boolean) => {
    setExternalEventsLoading(true)
    try {
      const { events: official, fromStaticFallback } = await runOfficialIngest(Boolean(force))
      setIngestFromStaticFallback(fromStaticFallback)
      setEvents((prev) => {
        return mergeEventLists([prev, official])
      })
    } catch {
      /* ingest już zdegradował po cichu; stan bez zmian */
    } finally {
      setExternalEventsLoading(false)
    }
  }, [])

  const refetchDbEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select(EVENTS_WITH_AUTHOR_SELECT)
      .gte('date', startOfTodayIso())
      .order('date', { ascending: true })
    if (error) {
      console.error('[useEvents] events select error', error)
      return
    }
    const nextDbEvents = (data ?? []).map(eventFromDbRow).filter((e): e is UJEvent => e !== null)
    setDbEvents(nextDbEvents)
  }, [])

  useEffect(() => {
    void syncOfficialEvents()
  }, [syncOfficialEvents])

  useEffect(() => {
    void refetchDbEvents()
  }, [refetchDbEvents])

  useEffect(() => {
    const official = hydrateOfficialEventsFromStorage()
    const localDrafts = loadUserEventsFromStorage()
    setEvents(mergeEventLists([localDrafts, official, dbEvents]))
  }, [dbEvents])

  useEffect(() => {
    try {
      const userOnly = events.filter((e) => !e.is_official && e.id.startsWith('local-'))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly))
    } catch {
      // quota / private mode — ignore
    }
  }, [events])

  const toggleRsvp = useCallback((eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev
        const nextAttending = !ev.isAttending
        return {
          ...ev,
          isAttending: nextAttending,
          attendees: Math.max(0, ev.attendees + (nextAttending ? 1 : -1)),
        }
      }),
    )
  }, [])

  const addEvent = useCallback((data: NewEventFormData) => {
    const run = async () => {
      const date = typeof data.date === 'string' ? new Date(data.date) : data.date
      if (Number.isNaN(date.getTime())) return
      const { data: sessionData } = await supabase.auth.getSession()
      const { data: authData } = await supabase.auth.getUser()
      const authUser = authData.user ?? sessionData.session?.user ?? null
      const currentUserId = authUser?.id ?? null
      const optimisticAuthor =
        currentUserId && authUser
          ? normalizeEventAuthor({
              id: currentUserId,
              full_name:
                typeof authUser.user_metadata?.full_name === 'string'
                  ? authUser.user_metadata.full_name
                  : null,
              username:
                typeof authUser.user_metadata?.username === 'string'
                  ? authUser.user_metadata.username
                  : null,
              avatar_url:
                typeof authUser.user_metadata?.avatar_url === 'string'
                  ? authUser.user_metadata.avatar_url
                  : null,
            })
          : undefined

      const payload = {
        user_id: currentUserId,
        title: data.title.trim(),
        date: date.toISOString(),
        category: data.category,
        location: data.location.trim(),
        description: data.description.trim(),
        image_url: data.imageUrl?.trim() || null,
      }

      const { data: inserted, error } = await supabase
        .from('events')
        .insert(payload)
        .select(EVENTS_WITH_AUTHOR_SELECT)
        .single()
      if (error || !inserted) {
        if (error) console.error('[useEvents] events insert error', error)
        const fallbackEvent: UJEvent = {
          id: `local-${Date.now().toString()}`,
          user_id: currentUserId ?? undefined,
          title: data.title.trim(),
          date,
          category: data.category,
          location: data.location.trim(),
          description: data.description.trim(),
          attendees: 0,
          isAttending: false,
          is_official: false,
          attendeeAvatars: [],
          imageUrl: data.imageUrl?.trim() || undefined,
          mapUrl: data.mapUrl?.trim() || undefined,
        }
        setEvents((prev) => mergeEventLists([prev, [fallbackEvent]]))
        return
      }

      const insertedEvent = eventFromDbRow(inserted)
      const insertedWithOptimisticAuthor =
        insertedEvent && !insertedEvent.author && optimisticAuthor
          ? { ...insertedEvent, author: optimisticAuthor }
          : insertedEvent
      if (insertedWithOptimisticAuthor) {
        setDbEvents((prev) => mergeEventLists([prev, [insertedWithOptimisticAuthor]]))
        setEvents((prev) => mergeEventLists([prev, [insertedWithOptimisticAuthor]]))
      }
      void refetchDbEvents()
    }
    void run()
  }, [refetchDbEvents])

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      if (prev.some((ev) => ev.id === id && ev.is_official)) return prev
      return prev.filter((ev) => ev.id !== id)
    })
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<UJEvent>) => {
    setEvents((prev) =>
      prev
        .map((ev) => {
          if (ev.id !== id) return ev
          if (ev.is_official) return ev
          const next: Record<string, unknown> = { ...ev }
          for (const key of Object.keys(patch) as (keyof UJEvent)[]) {
            if (key === 'id') continue
            const v = patch[key]
            if (v === undefined) {
              delete next[key as string]
            } else {
              next[key as string] = v as unknown
            }
          }
          return next as unknown as UJEvent
        })
        .sort(compareOfficialThenDate),
    )
    void refetchDbEvents()
  }, [refetchDbEvents])

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return events.filter((ev) => ev.date.getTime() >= now.getTime()).sort(compareOfficialThenDate)
  }, [events])

  const featuredEvent = useMemo(() => {
    const withPoster = upcomingEvents.filter(
      (ev) => typeof ev.imageUrl === 'string' && ev.imageUrl.length > 0,
    )
    return withPoster[0] ?? null
  }, [upcomingEvents])

  const value: EventsContextValue = {
    events,
    featuredEvent,
    allEvents: events,
    externalEventsLoading,
    toggleRsvp,
    addEvent,
    deleteEvent,
    updateEvent,
    syncOfficialEvents,
    ingestFromStaticFallback,
    refetchDbEvents,
  }

  return createElement(EventsContext.Provider, { value }, children)
}

export function useEvents(): EventsContextValue {
  const ctx = useContext(EventsContext)
  if (!ctx) {
    throw new Error('useEvents must be used within EventsProvider')
  }
  return ctx
}
