import { useEffect, useMemo, useState } from 'react'
import { Archive, Plus, Radio, Search, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import { DataService } from '../services/DataService'
import { useUnifiedEvents } from '../hooks/useContent'
import { EVENTS_TOOLBAR, FILTER_PILL } from '../styles/mobile-theme'
import type { EventMeta, UnifiedContent } from '../types/content'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import EventCard from './events/EventCard'

type EventFilter = 'all' | 'mine' | 'Wydarzenie' | 'Wydział' | 'Ogłoszenie' | 'Oficjalne'

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'mine', label: 'Moje' },
  { key: 'Oficjalne', label: 'Oficjalne' },
  { key: 'Wydarzenie', label: 'Wydarzenie' },
  { key: 'Wydział', label: 'Wydział' },
  { key: 'Ogłoszenie', label: 'Ogłoszenie' },
]

type Props = {
  currentUserId: string
}

export default function EventsView({ currentUserId }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    events,
    allEvents,
    toggleRsvp,
    addEvent,
    updateEvent,
    ingestFromStaticFallback,
  } = useEvents()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [deepLinkEvent, setDeepLinkEvent] = useState<UJEvent | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UJEvent | null>(null)

  useEffect(() => {
    const state = location.state as { openEventId?: string } | null
    const openEventId = state?.openEventId?.trim()
    if (!openEventId) return

    setSelectedEventId(openEventId)
    const fromContext = allEvents.find((e) => e.id === openEventId)
    if (fromContext) {
      setDeepLinkEvent(fromContext)
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    let cancelled = false
    void DataService.fetchEventById(openEventId).then((row) => {
      if (cancelled) return
      if (row) setDeepLinkEvent(row)
      navigate(location.pathname, { replace: true, state: null })
    })
    return () => {
      cancelled = true
    }
  }, [allEvents, location.pathname, location.state, navigate])

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null
    return (
      events.find((e) => e.id === selectedEventId) ??
      allEvents.find((e) => e.id === selectedEventId) ??
      (deepLinkEvent?.id === selectedEventId ? deepLinkEvent : null)
    )
  }, [events, allEvents, deepLinkEvent, selectedEventId])

  const filtered = useMemo(() => {
    let list =
      filter === 'all'
        ? events
        : filter === 'mine'
          ? events.filter((ev) => ev.user_id === currentUserId)
          : events.filter((ev) => ev.category === filter)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((ev) => ev.title.toLowerCase().includes(q))
    }
    return list
  }, [currentUserId, filter, events, searchQuery])

  // Mapowanie do UnifiedContent wyłącznie na potrzeby wizualnych kart siatki.
  // Mutacje (toggleRsvp, deleteEvent) nadal operują na UJEvent w kontekście.
  const unifiedGrid = useUnifiedEvents()
  const unifiedGridById = useMemo(() => {
    const map = new Map<string, UnifiedContent<EventMeta>>()
    for (const uc of unifiedGrid.events) map.set(uc.id, uc)
    return map
  }, [unifiedGrid.events])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">
      <aside className="hidden lg:block lg:col-span-3" aria-hidden />

      <div className="lg:col-span-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-app pb-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(({ key, label }) => {
              const active = filter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`${FILTER_PILL.base} ${active ? FILTER_PILL.active : FILTER_PILL.inactive}`}
                >
                  {key === 'mine' ? (
                    <User size={14} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                  ) : null}
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <span
              className={EVENTS_TOOLBAR.liveBadge}
              role="status"
              aria-label={ingestFromStaticFallback ? 'Źródło: archiwum i polecane' : 'Źródło: dane na żywo z UJ'}
            >
              {ingestFromStaticFallback ? (
                <>
                  <Archive size={12} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
                  Archiwum
                </>
              ) : (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  <Radio size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                  Live
                </>
              )}
            </span>
            <div className={EVENTS_TOOLBAR.searchWrap}>
              <Search
                strokeWidth={2}
                className={EVENTS_TOOLBAR.searchLeadingIcon}
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj po nazwie…"
                className={EVENTS_TOOLBAR.searchInner}
                aria-label="Szukaj wydarzeń po nazwie"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditTarget(null)
                setIsCreateOpen(true)
              }}
              className={EVENTS_TOOLBAR.createBtn}
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
              Dodaj wydarzenie
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((ev) => {
            const uc = unifiedGridById.get(ev.id)
            if (!uc) return null
            return (
              <EventCard
                key={ev.id}
                content={uc}
                onSelect={(id) => setSelectedEventId(id)}
              />
            )
          })}
        </div>
      </div>

      <aside className="hidden lg:block lg:col-span-3" aria-hidden />

      <EventModal
        event={selectedEvent}
        currentUserId={currentUserId}
        onClose={() => setSelectedEventId(null)}
        onToggleRsvp={toggleRsvp}
        onEditRequest={(e) => {
          setEditTarget(e)
          setSelectedEventId(null)
        }}
      />

      <CreateEventModal
        isOpen={isCreateOpen || editTarget !== null}
        onClose={() => {
          setIsCreateOpen(false)
          setEditTarget(null)
        }}
        onAdd={addEvent}
        editEvent={editTarget}
        onUpdate={updateEvent}
      />
    </div>
  )
}
