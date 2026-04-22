import { Calendar, MapPin } from 'lucide-react'
import type { UJEvent } from '../../../data/mockEvents'
import EmptyState from '../../EmptyState'

type Props = {
  events: UJEvent[]
  isOwn: boolean
  onNavigateToEvents?: () => void
}

function eventDateParts(d: Date) {
  const day = d.toLocaleDateString('pl-PL', { day: 'numeric' })
  const month = d
    .toLocaleDateString('pl-PL', { month: 'short' })
    .replace('.', '')
    .toUpperCase()
  return { day, month }
}

export default function EventsPanel({ events, isOwn, onNavigateToEvents }: Props) {
  if (!isOwn) {
    return (
      <EmptyState
        icon={Calendar}
        title="Brak publicznych wydarzeń"
        subtitle="Wydarzenia innych użytkowników nie są jeszcze udostępniane."
      />
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Brak wydarzeń"
        subtitle="Zaznacz udział w wydarzeniach w zakładce Wydarzenia."
      />
    )
  }

  return (
    <ul className="relative z-10 space-y-3">
      {events.map((e) => {
        const { day, month } = eventDateParts(e.date)
        const timeStr = e.date.toLocaleTimeString('pl-PL', {
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <li key={e.id} className="list-none">
            <button
              type="button"
              onClick={() => onNavigateToEvents?.()}
              className="flex w-full cursor-pointer gap-4 rounded-xl border border-[#0f172a]/10 bg-card p-4 text-left shadow-sm transition-colors hover:border-[var(--profile-accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--profile-accent)]/40 dark:border-white/5 dark:shadow-none dark:hover:border-[var(--profile-accent)]/35"
            >
              <div className="pointer-events-none flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg border border-[#0f172a]/10 py-3 dark:border-white/5 dark:bg-white/[0.04]">
                <span className="text-2xl font-bold leading-none text-[var(--profile-accent)]">
                  {day}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
                  {month}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                {e.category ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--profile-accent)]">
                    {e.category}
                  </p>
                ) : null}
                <p className="text-base font-semibold leading-snug text-[#0f172a] dark:text-white">
                  {e.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{timeStr}</p>
                {e.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {e.description}
                  </p>
                ) : null}
                {e.location ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="mt-0.5 shrink-0 text-[var(--profile-accent)]" aria-hidden>
                      <MapPin className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span>{e.location}</span>
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
