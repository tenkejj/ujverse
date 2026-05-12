import { useMemo, useState } from 'react'
import { Archive, Plus, Radio, Search, User } from 'lucide-react'
import { type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import { useUnifiedEvents } from '../hooks/useContent'
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
  const {
    events,
    toggleRsvp,
    addEvent,
    updateEvent,
    ingestFromStaticFallback,
  } = useEvents()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UJEvent | null>(null)

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [events, selectedEventId],
  )

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
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                  filter === key
                    ? 'text-accent-interactive font-bold'
                    : 'text-slate-600 hover:text-fg-primary font-medium dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {key === 'mine' ? (
                  <User size={16} strokeWidth={2} className="shrink-0 opacity-90" aria-hidden />
                ) : null}
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 dark:border-border-app dark:bg-black/25 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400"
              role="status"
              aria-label={ingestFromStaticFallback ? 'Źródło: archiwum i polecane' : 'Źródło: dane na żywo z UJ'}
            >
              {ingestFromStaticFallback ? (
                <>
                  <Archive size={12} className="text-brand-gold dark:text-brand-gold-bright shrink-0" aria-hidden />
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
            <div className="relative flex-1 min-w-[160px] max-w-xs sm:max-w-[220px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                strokeWidth={2}
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj po nazwie…"
                className="w-full rounded-xl border border-gray-200 bg-gray-100 py-2 pl-9 pr-3 text-sm text-fg-primary placeholder:text-slate-500 focus:border-accent-interactive focus:outline-none dark:border-border-app dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
                aria-label="Szukaj wydarzeń po nazwie"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEditTarget(null)
                setIsCreateOpen(true)
              }}
              className="shrink-0 flex items-center gap-2 border border-brand-gold text-accent-interactive hover:bg-brand-gold/10 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
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
