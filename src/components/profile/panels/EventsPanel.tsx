import { Calendar } from 'lucide-react'
import type { UJEvent } from '../../../data/mockEvents'
import EmptyState from '../../EmptyState'
import EventCard from '../../events/EventCard'
import { DataService } from '../../../services/DataService'

type Props = {
  events: UJEvent[]
  loading?: boolean
  isOwn: boolean
  onNavigateToEvents?: () => void
}

export default function EventsPanel({ events, loading = false, isOwn, onNavigateToEvents }: Props) {
  if (loading) {
    return (
      <EmptyState
        icon={Calendar}
        title="Ładowanie wydarzeń"
        subtitle="Pobieram wydarzenia z profilu użytkownika."
      />
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Brak wydarzeń"
        subtitle={
          isOwn
            ? 'Utwórz lub dołącz do wydarzenia na karcie Wydarzenia.'
            : 'Ten użytkownik nie dodał jeszcze żadnych wydarzeń.'
        }
      />
    )
  }

  const unifiedEvents = DataService.toUnifiedEvents(events)

  return (
    <div className="relative z-10 grid gap-3 sm:grid-cols-2">
      {unifiedEvents.map((event) => (
        <EventCard key={event.id} content={event} onSelect={() => onNavigateToEvents?.()} />
      ))}
    </div>
  )
}
