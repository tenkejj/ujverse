import { useMemo, useState } from 'react'
import { Archive, Plus, Radio, Search, Shield, User, Users } from 'lucide-react'
import { formatEventDateLong, formatEventDateParts, type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import WziksOfficialHub from './WziksOfficialHub'

type EventFilter = 'all' | 'mine' | 'Wydarzenie' | 'Wydział' | 'Ogłoszenie' | 'Oficjalne'

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'mine', label: 'Moje' },
  { key: 'Oficjalne', label: 'Oficjalne' },
  { key: 'Wydarzenie', label: 'Wydarzenie' },
  { key: 'Wydział', label: 'Wydział' },
  { key: 'Ogłoszenie', label: 'Ogłoszenie' },
]

function facultyTag(event: UJEvent): string | null {
  if (!event.is_official) return null
  if (event.faculty === 'WZiKS') return 'WZiKS'
  if (event.source_name && event.source_name.length < 28) return event.source_name
  return 'UJ'
}

function EventCard({ event, onSelect }: { event: UJEvent; onSelect: (e: UJEvent) => void }) {
  const { monthLabel, dayNum } = formatEventDateParts(event.date)
  const official = Boolean(event.is_official)
  const tag = facultyTag(event)
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`w-full text-left rounded-2xl p-4 cursor-pointer transition-colors relative ${
        official
          ? 'official-card-premium bg-gradient-to-br from-[#fdf8ed] via-brand-gold/8 to-slate-50/85 border border-brand-gold/45 shadow-[0_0_28px_-12px_rgba(201,162,39,0.4)] ring-1 ring-brand-gold/25 hover:ring-brand-gold/40 dark:from-[#1a1508]/90 dark:via-brand-gold/[0.07] dark:to-transparent dark:border-brand-gold/35 dark:shadow-[0_0_36px_-14px_rgba(201,162,39,0.25)] dark:ring-brand-gold/20 dark:hover:bg-white/[0.03]'
          : 'bg-card border border-border-app hover:bg-slate-50 dark:hover:bg-white/5'
      }`}
    >
      <div className="relative z-[2] flex items-start gap-3">
        <div className="shrink-0 text-center min-w-[40px]">
          <span
            className={`block text-[10px] font-bold leading-none uppercase tracking-wide ${
              official ? 'text-brand-gold dark:text-brand-gold-bright' : 'text-accent-interactive'
            }`}
          >
            {monthLabel}
          </span>
          <span className="block text-lg font-extrabold text-fg-primary leading-tight">{dayNum}</span>
        </div>
        <div className="min-w-0 flex-1">
          {official && tag ? (
            <span className="inline-flex mb-1 rounded-full border border-[#c9a227]/40 bg-[#c9a227]/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-uj-navy dark:text-[#e8c84a]">
              {tag}
            </span>
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm leading-snug min-w-0 ${
                official ? 'font-extrabold text-fg-primary' : 'font-semibold text-fg-primary'
              }`}
            >
              {event.title}
            </p>
            {official ? (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-[#c9a227]/45 bg-black/[0.04] dark:bg-black/30 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-uj-navy dark:text-[#f0d060]"
                title={event.source_name ? `Źródło: ${event.source_name}` : undefined}
              >
                <Shield size={11} className="text-[#b8922a] dark:text-[#e8c84a]" strokeWidth={2.5} aria-hidden />
                OFICJALNE UJ
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{event.location}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <Users size={16} strokeWidth={2} className="shrink-0 text-accent-interactive" aria-hidden />
            <span>{event.attendees} uczestników</span>
          </p>
        </div>
      </div>
    </button>
  )
}

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

  const gridEvents = useMemo(() => {
    if (!featuredEvent) return filtered
    return filtered.filter((ev) => ev.id !== featuredEvent.id)
  }, [filtered, featuredEvent])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">
      <aside className="hidden lg:block lg:col-span-3" aria-hidden />

      <div className="lg:col-span-6 space-y-4">
        {featuredEvent?.imageUrl ? (
          <button
            type="button"
            onClick={() => setSelectedEventId(featuredEvent.id)}
            className="group relative w-full h-64 lg:h-80 rounded-3xl overflow-hidden mb-8 border border-border-app text-left shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            <img
              src={featuredEvent.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/60" aria-hidden />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent dark:from-[#01020A] dark:via-[#040521]/80"
              aria-hidden
            />
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-black/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-gold-bright backdrop-blur-sm border border-brand-gold/40">
                🔥 WYRÓŻNIONE
              </span>
              {featuredEvent.is_official ? (
                <span className="inline-flex items-center gap-0.5 rounded-lg border border-[#c9a227]/55 bg-black/60 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#f5e6a8] backdrop-blur-sm">
                  <Shield size={12} className="text-[#e8c84a]" strokeWidth={2.5} aria-hidden />
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
              <span className="mt-5 inline-flex w-fit items-center rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-black transition-colors group-hover:bg-brand-gold/85">
                Sprawdź szczegóły
              </span>
            </div>
          </button>
        ) : null}

        {ingestFromStaticFallback ? (
          <p
            className="text-xs text-brand-gold dark:text-brand-gold-bright/95 bg-brand-gold/10 dark:bg-brand-gold/15 border border-brand-gold/35 dark:border-brand-gold/30 rounded-xl px-3 py-2.5 mb-2"
            role="status"
          >
            <span className="font-semibold">Dane archiwalne (polecane).</span>{' '}
            Nie udało się pobrać świeżych aktualności z serwisów UJ — wyświetlamy sprawdzony zestaw wydarzeń i linki do
            oficjalnych stron uczelni.
          </p>
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
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border-app bg-slate-100/90 dark:bg-black/25 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400"
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
                className="w-full rounded-xl border border-border-app bg-slate-100 py-2 pl-9 pr-3 text-sm text-fg-primary placeholder:text-slate-500 focus:border-accent-interactive focus:outline-none dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
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
          {gridEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} onSelect={(e) => setSelectedEventId(e.id)} />
          ))}
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
