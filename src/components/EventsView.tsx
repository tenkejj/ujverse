import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, Calendar, CalendarClock, CalendarDays, Plus, Radio, Search, Sparkles, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import { DataService } from '../services/DataService'
import { useUnifiedEvents } from '../hooks/useContent'
import {
  computeEventStats,
  groupEventsByTimeBucket,
  type EventTimeBucket,
} from '../lib/eventGrouping'
import { EVENTS_HUB, EVENTS_TOOLBAR, FILTER_PILL } from '../styles/mobile-theme'
import type { EventMeta, UnifiedContent } from '../types/content'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import EventCard from './events/EventCard'
import EventsEmptyState from './events/EventsEmptyState'
import EventsHero from './events/EventsHero'
import EventsSideRail, { type SideRailFilter } from './events/EventsSideRail'

type EventFilter = 'all' | 'mine' | 'Wydarzenie' | 'Wydział' | 'Ogłoszenie' | 'Oficjalne'

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'mine', label: 'Moje' },
  { key: 'Oficjalne', label: 'Oficjalne' },
  { key: 'Wydarzenie', label: 'Wydarzenie' },
  { key: 'Wydział', label: 'Wydział' },
  { key: 'Ogłoszenie', label: 'Ogłoszenie' },
]

/** Ikonki dla nagłówków sekcji datowych. */
const BUCKET_ICON: Record<EventTimeBucket, typeof Calendar> = {
  today: CalendarClock,
  thisWeek: CalendarDays,
  thisMonth: Calendar,
  later: Sparkles,
}

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

  // Wszystkie wydarzenia po filtrze kategorii + searchu (przed wycięciem hero).
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

  // Pierwsze (najbliższe) wydarzenie idzie do Hero; reszta do sekcji.
  // Hero pokazujemy TYLKO przy filtrze `all` i pustym search — żeby spotlight
  // nie konkurował z wyborem usera (gdy filtruje, oczekuje płaskiej listy).
  const heroEvent: UJEvent | null = useMemo(() => {
    if (filter !== 'all' || searchQuery.trim().length > 0) return null
    return filtered[0] ?? null
  }, [filter, searchQuery, filtered])

  const restAfterHero = useMemo(() => {
    if (!heroEvent) return filtered
    return filtered.filter((ev) => ev.id !== heroEvent.id)
  }, [filtered, heroEvent])

  const groups = useMemo(() => groupEventsByTimeBucket(restAfterHero), [restAfterHero])

  const stats = useMemo(() => computeEventStats(events), [events])

  // Mapowanie do UnifiedContent wyłącznie na potrzeby wizualnych kart siatki.
  // Mutacje (toggleRsvp, deleteEvent) nadal operują na UJEvent w kontekście.
  const unifiedGrid = useUnifiedEvents()
  const unifiedGridById = useMemo(() => {
    const map = new Map<string, UnifiedContent<EventMeta>>()
    for (const uc of unifiedGrid.events) map.set(uc.id, uc)
    return map
  }, [unifiedGrid.events])

  // Liczniki kategorii pod side-rail (zawsze z pełnej listy, nie z `filtered`).
  const sideFilters = useMemo<SideRailFilter[]>(() => {
    const mine = events.filter((ev) => ev.user_id === currentUserId).length
    return FILTERS.map((f) => {
      if (f.key === 'all') return { key: f.key, label: f.label, count: events.length }
      if (f.key === 'mine') return { key: f.key, label: f.label, count: mine }
      return {
        key: f.key,
        label: f.label,
        count: events.filter((ev) => ev.category === f.key).length,
      }
    })
  }, [events, currentUserId])

  const isEmpty = filtered.length === 0
  const isFilteredOrSearching = filter !== 'all' || searchQuery.trim().length > 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <motion.div
        variants={EVENTS_HUB.motion.page}
        initial="hidden"
        animate="show"
        className="min-w-0 space-y-6"
      >
        <div className={EVENTS_HUB.toolbar.stickyWrapClass}>
          <div className={EVENTS_HUB.toolbar.rowClass}>
            <div className={EVENTS_HUB.toolbar.pillsWrapClass}>
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
            <div className={EVENTS_HUB.toolbar.actionsWrapClass}>
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
        </div>

        <AnimatePresence mode="wait">
          {isEmpty ? (
            <EventsEmptyState
              key="empty"
              variant={isFilteredOrSearching ? 'no-match' : 'no-data'}
              context={searchQuery.trim() || undefined}
              suggestions={
                isFilteredOrSearching
                  ? [
                      {
                        id: 'reset',
                        label: 'Pokaż wszystkie',
                        onClick: () => {
                          setFilter('all')
                          setSearchQuery('')
                        },
                      },
                      ...(searchQuery.trim().length > 0
                        ? [
                            {
                              id: 'clear-search',
                              label: 'Wyczyść wyszukiwanie',
                              onClick: () => setSearchQuery(''),
                            },
                          ]
                        : []),
                    ]
                  : []
              }
            />
          ) : (
            <motion.div
              key="content"
              variants={EVENTS_HUB.motion.page}
              initial="hidden"
              animate="show"
              className="space-y-8"
            >
              {heroEvent ? (
                <EventsHero
                  event={heroEvent}
                  onOpen={(id) => setSelectedEventId(id)}
                />
              ) : null}

              {groups.map((group) => {
                const Icon = BUCKET_ICON[group.bucket]
                return (
                  <motion.section
                    key={group.bucket}
                    variants={EVENTS_HUB.motion.fadeUp}
                    className={EVENTS_HUB.section.wrapClass}
                    aria-label={group.label}
                  >
                    <header className={EVENTS_HUB.section.headerClass}>
                      <h2 className={EVENTS_HUB.section.titleClass}>
                        <Icon size={12} strokeWidth={2.25} className={EVENTS_HUB.section.titleIconClass} aria-hidden />
                        {group.label}
                        <span className={EVENTS_HUB.section.countBadgeClass}>
                          {group.events.length}
                        </span>
                      </h2>
                      <span className={EVENTS_HUB.section.subtitleClass}>{group.subtitle}</span>
                    </header>

                    <motion.div
                      variants={EVENTS_HUB.motion.grid}
                      className={EVENTS_HUB.section.gridClass}
                    >
                      {group.events.map((ev) => {
                        const uc = unifiedGridById.get(ev.id)
                        if (!uc) return null
                        return (
                          <motion.div key={ev.id} variants={EVENTS_HUB.motion.item}>
                            <EventCard
                              content={uc}
                              onSelect={(id) => setSelectedEventId(id)}
                            />
                          </motion.div>
                        )
                      })}
                    </motion.div>
                  </motion.section>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="hidden lg:block">
        <EventsSideRail
          isLive={!ingestFromStaticFallback}
          stats={stats}
          filters={sideFilters}
          activeFilterKey={filter}
          onFilterChange={(key) => setFilter(key as EventFilter)}
        />
      </div>

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
