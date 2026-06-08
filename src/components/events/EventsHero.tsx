import { ArrowRight, CalendarDays, MapPin, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatEventDateParts, type UJEvent } from '../../data/mockEvents'
import { EVENTS_HUB } from '../../styles/mobile-theme'
import { theme } from '../../styles/theme'
import OfficialBadge from '../ui/OfficialBadge'

/**
 * EventsHero — spotlight najbliższego wydarzenia w hubie /wydarzenia.
 *
 * Layout:
 *  - md+: split 3:2 — lewa kolumna plakat (lub dekoracyjny gradient
 *         gdy `imageUrl` jest puste), prawa kolumna meta + CTA.
 *  - sm:  kolumna, plakat na górze.
 *
 * Hero jest *czysto wizualne* — kliknięcie CTA wywołuje `onOpen(eventId)`,
 * który `EventsView` mapuje na otwarcie `EventModal`. Hero NIE renderuje
 * własnego modala, żeby zachować jedno źródło prawdy dla detali wydarzenia.
 */
type Props = {
  event: UJEvent
  onOpen: (eventId: string) => void
}

const H = EVENTS_HUB.hero

export default function EventsHero({ event, onOpen }: Props) {
  const { monthLabel, dayNum } = formatEventDateParts(event.date)
  const poster = event.imageUrl?.trim() || null

  return (
    <motion.section
      variants={EVENTS_HUB.motion.fadeUp}
      className={H.cardClass}
      aria-label="Najbliższe wydarzenie"
    >
      <div className={H.gridClass}>
        {poster ? (
          <div className={H.posterWrapClass}>
            <img src={poster} alt={event.title} className={H.posterImgClass} />
            <div className={H.posterShadeClass} aria-hidden />
            <span className={H.eyebrowFloatClass}>
              <CalendarDays size={12} strokeWidth={2.5} aria-hidden />
              Najbliższe wydarzenie
            </span>
            {event.is_official ? (
              <div className="absolute right-4 top-4 z-2">
                <OfficialBadge size="md" variant="floating" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className={H.posterFallbackClass}>
            <span className={H.eyebrowFloatClass} style={{ position: 'absolute' }}>
              <CalendarDays size={12} strokeWidth={2.5} aria-hidden />
              Najbliższe wydarzenie
            </span>
            <div className="flex flex-col items-center gap-1 px-6 text-center">
              <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme.text.goldMuted}`}>
                {monthLabel}
              </span>
              <span className={`text-7xl font-extrabold leading-none ${theme.text.goldMuted}`}>
                {dayNum}
              </span>
            </div>
            {event.is_official ? (
              <div className="absolute right-4 top-4 z-2">
                <OfficialBadge size="md" variant="floating" />
              </div>
            ) : null}
          </div>
        )}

        <div className={H.metaWrapClass}>
          <div className={H.dateBlockClass}>
            <span className={H.dateMonthClass}>{monthLabel}</span>
            <span className={H.dateDayClass}>{dayNum}</span>
          </div>

          <h2 className={H.titleClass}>{event.title}</h2>

          {event.location ? (
            <p className={H.metaRowClass}>
              <MapPin size={16} strokeWidth={2} className={H.metaIconClass} aria-hidden />
              <span className="min-w-0 truncate">{event.location}</span>
            </p>
          ) : null}

          {typeof event.attendees === 'number' && event.attendees > 0 ? (
            <p className={H.metaRowClass}>
              <Users size={16} strokeWidth={2} className={H.metaIconClass} aria-hidden />
              <span>
                <span className="font-bold tabular-nums">{event.attendees}</span>{' '}
                {event.attendees === 1 ? 'uczestnik' : 'uczestników'}
              </span>
            </p>
          ) : null}

          <div className={H.actionsRowClass}>
            <button
              type="button"
              onClick={() => onOpen(event.id)}
              className={`${theme.button.primary} px-5 py-2.5 text-sm`}
            >
              Zobacz szczegóły
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            </button>
            {event.event_url ? (
              <a
                href={event.event_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${theme.button.outline} px-4 py-2.5 text-sm`}
              >
                Otwórz w portalu UJ
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
