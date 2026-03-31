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
import { mockEvents, type UJEvent } from '../data/mockEvents'

const STORAGE_KEY = 'ujverse_events'

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
  if (typeof o.imageUrl === 'string' && o.imageUrl.length > 0) out.imageUrl = o.imageUrl
  if (typeof o.mapUrl === 'string' && o.mapUrl.length > 0) out.mapUrl = o.mapUrl
  if (attendeeAvatars) out.attendeeAvatars = attendeeAvatars
  return out
}

function loadFromStorage(): UJEvent[] {
  if (typeof window === 'undefined') return mockEvents
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return mockEvents
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return mockEvents
    const revived = parsed.map(reviveEvent).filter((e): e is UJEvent => e !== null)
    return revived.length > 0 ? revived : mockEvents
  } catch {
    return mockEvents
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
  /** Wydarzenia od dzisiejszego dnia włącznie, posortowane rosnąco po dacie. */
  events: UJEvent[]
  /** Najbliższe nadchodzące wydarzenie z plakatem (do sekcji Hero). */
  featuredEvent: UJEvent | null
  /** Pełna lista (także przeszłe) — np. pod przyszły profil / administrację. */
  allEvents: UJEvent[]
  toggleRsvp: (eventId: string) => void
  addEvent: (data: NewEventFormData) => void
  deleteEvent: (id: string) => void
  /** Klucz z wartością `undefined` usuwa opcjonalne pole (np. imageUrl, mapUrl). */
  updateEvent: (id: string, patch: Partial<UJEvent>) => void
}

const EventsContext = createContext<EventsContextValue | null>(null)

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<UJEvent[]>(loadFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
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
    const date = typeof data.date === 'string' ? new Date(data.date) : data.date
    if (Number.isNaN(date.getTime())) return

    const newEvent: UJEvent = {
      id: Date.now().toString(),
      title: data.title.trim(),
      date,
      category: data.category,
      location: data.location.trim(),
      description: data.description.trim(),
      attendees: 0,
      isAttending: false,
      attendeeAvatars: [],
    }
    const img = data.imageUrl?.trim()
    if (img) newEvent.imageUrl = img
    const map = data.mapUrl?.trim()
    if (map) newEvent.mapUrl = map

    setEvents((prev) =>
      [...prev, newEvent].sort((a, b) => a.date.getTime() - b.date.getTime()),
    )
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<UJEvent>) => {
    setEvents((prev) =>
      prev
        .map((ev) => {
          if (ev.id !== id) return ev
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
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    )
  }, [])

  const activeEvents = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return events
      .filter((ev) => ev.date.getTime() >= now.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [events])

  const featuredEvent = useMemo(() => {
    const withPoster = activeEvents.filter(
      (ev) => typeof ev.imageUrl === 'string' && ev.imageUrl.length > 0,
    )
    return withPoster[0] ?? null
  }, [activeEvents])

  const value: EventsContextValue = {
    events: activeEvents,
    featuredEvent,
    allEvents: events,
    toggleRsvp,
    addEvent,
    deleteEvent,
    updateEvent,
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
