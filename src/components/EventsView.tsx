import { useEffect, useMemo, useState } from 'react'
import { Archive, Plus, Radio, Search, Shield, User } from 'lucide-react'
import { formatEventDateLong, type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import { useUnifiedEvents } from '../hooks/useContent'
import type { EventMeta, UnifiedContent } from '../types/content'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import WziksOfficialHub from './WziksOfficialHub'
import EventCard from './events/EventCard'

type EventFilter = 'all' | 'mine' | 'Wydarzenie' | 'Wydział' | 'Ogłoszenie' | 'Oficjalne'

/** Etykiety na banerze wyróżnionym — w light theme łagodniejszy kontrast niż czarny „alert”. */
const featuredHeroPillCls =
  'inline-flex items-center gap-0.5 rounded-full border border-white/30 bg-zinc-950/45 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-white/90 backdrop-blur-md dark:border-[#c9a227]/45 dark:bg-black/50 dark:text-brand-gold-bright'

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'mine', label: 'Moje' },
  { key: 'Oficjalne', label: 'Oficjalne' },
  { key: 'Wydarzenie', label: 'Wydarzenie' },
  { key: 'Wydział', label: 'Wydział' },
  { key: 'Ogłoszenie', label: 'Ogłoszenie' },
]

export default function EventsView() {
  const {
    events,
    allEvents,
    featuredEvent,
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

  const trimmedFeaturedUrl = (featuredEvent?.imageUrl ?? '').trim()
  const [featuredBannerState, setFeaturedBannerState] = useState<
    'empty' | 'loading' | 'ok' | 'fail'
  >('empty')

  useEffect(() => {
    if (!trimmedFeaturedUrl) {
      setFeaturedBannerState('empty')
      return
    }
    setFeaturedBannerState('loading')
    let cancelled = false
    const probe = new Image()
    probe.onload = () => {
      if (!cancelled) setFeaturedBannerState('ok')
    }
    probe.onerror = () => {
      if (!cancelled) setFeaturedBannerState('fail')
    }
    probe.src = trimmedFeaturedUrl
    return () => {
      cancelled = true
    }
  }, [trimmedFeaturedUrl])

  const showFeaturedHeroImage = featuredBannerState === 'ok'

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [events, selectedEventId],
  )

  const filtered = useMemo(() => {
    let list =
      filter === 'all'
        ? events
        : filter === 'mine'
          ? events.filter((ev) => Boolean(ev.isAttending))
          : events.filter((ev) => ev.category === filter)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((ev) => ev.title.toLowerCase().includes(q))
    }
    return list
  }, [filter, events, searchQuery])

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
        {featuredEvent ? (
          <button
            type="button"
            onClick={() => setSelectedEventId(featuredEvent.id)}
            className="group relative w-full h-64 lg:h-80 rounded-3xl overflow-hidden mb-8 border border-border-app text-left shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            {showFeaturedHeroImage ? (
              <img
                src={trimmedFeaturedUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div
                className="absolute inset-0 bg-gradient-to-br from-amber-600/30 to-zinc-950"
                aria-hidden
              />
            )}
            <div className="absolute inset-0 bg-black/60" aria-hidden />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent dark:from-zinc-950 dark:via-zinc-950/80"
              aria-hidden
            />
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
              <span className={featuredHeroPillCls}>WYRÓŻNIONE</span>
              {featuredEvent.is_official ? (
                <span className={featuredHeroPillCls}>
                  <Shield size={12} className="text-[#e8c84a] dark:text-brand-gold-bright" strokeWidth={2.5} aria-hidden />
                  OFICJALNE UJ
                </span>
              ) : null}
            </div>
            <div className="relative z-[1] flex h-full min-h-[16rem] lg:min-h-[20rem] flex-col justify-end p-6 lg:p-8">
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight drop-shadow-md">
                {featuredEvent.title}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {formatEventDateLong(featuredEvent.date)}
              </p>
              <p className="mt-1 text-sm text-slate-400 line-clamp-2">{featuredEvent.location}</p>
              <span className="mt-5 inline-flex w-fit items-center rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-black/20 transition-colors group-hover:bg-zinc-800 dark:bg-brand-gold dark:text-zinc-900 dark:shadow-none dark:group-hover:bg-brand-gold/88">
                Sprawdź szczegóły
              </span>
            </div>
          </button>
        ) : null}

        <WziksOfficialHub events={allEvents} showOfflineHint={ingestFromStaticFallback} />

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
