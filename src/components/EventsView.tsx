import { useMemo, useState } from 'react'
import { mockEvents, formatEventDateParts, type UJEvent } from '../data/mockEvents'
import EventModal from './EventModal'

type EventFilter = 'all' | 'Wydarzenie' | 'Wydział' | 'Ogłoszenie'

const FILTERS: { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'Wydarzenie', label: 'Wydarzenie' },
  { key: 'Wydział', label: 'Wydział' },
  { key: 'Ogłoszenie', label: 'Ogłoszenie' },
]

function EventCard({ event, onSelect }: { event: UJEvent; onSelect: (e: UJEvent) => void }) {
  const { monthLabel, dayNum } = formatEventDateParts(event.date)
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="w-full text-left bg-[#040521] border border-[#1c2b4e] rounded-2xl p-4 cursor-pointer hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center min-w-[40px]">
          <span className="block text-[10px] font-bold text-[#ffa000] leading-none uppercase tracking-wide">
            {monthLabel}
          </span>
          <span className="block text-lg font-extrabold text-white leading-tight">{dayNum}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-snug">{event.title}</p>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{event.location}</p>
          <p className="text-xs text-slate-500 mt-2">🔥 {event.attendees} uczestników</p>
        </div>
      </div>
    </button>
  )
}

export default function EventsView() {
  const [filter, setFilter] = useState<EventFilter>('all')
  const [selectedEvent, setSelectedEvent] = useState<UJEvent | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return mockEvents
    return mockEvents.filter((ev) => ev.category === filter)
  }, [filter])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">
      <aside className="hidden lg:block lg:col-span-3" aria-hidden />

      <div className="lg:col-span-6 space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-slate-200/10 dark:border-border-app pb-4">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                filter === key
                  ? 'text-[#ffa000] font-bold'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((ev) => (
            <EventCard key={ev.id} event={ev} onSelect={setSelectedEvent} />
          ))}
        </div>
      </div>

      <aside className="hidden lg:block lg:col-span-3" aria-hidden />

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
