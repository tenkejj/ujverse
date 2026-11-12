import { ArrowUpRight, Lock } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import { announcementPresentation } from '../../lib/info/presentation'
import { canShowCountdown, registrationTiming } from '../../lib/info/relevance'
import {
  formatDateTime,
  formatDurationShort,
  formatRelativePast,
  parseIsoDate,
} from '../../lib/info/time'
import type {
  InfoAnnouncement,
  InfoEvent,
  InfoRegistration,
} from '../../lib/info/types'
import type { InfoResource } from '../../lib/info/resources'
import {
  AnnouncementCategoryPill,
  ExternalSourceLink,
  SaveToggle,
} from './infoUi'
import { EventPreviewTile } from './InfoItems'
import { recordUsefulSourceOpen } from '../../lib/info/productMetrics'

type Icon = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }
>

export function AnnouncementHubCard({
  item,
  now,
  compact = false,
}: {
  item: InfoAnnouncement
  now: Date
  compact?: boolean
}) {
  const added = parseIsoDate(item.addedAt)
  return (
    <article
      className="info-entry semantic-item"
      data-tone={announcementPresentation(item).tone}
    >
      <div className="info-entry-content">
        <div className="info-entry-meta">
          <span>
            {item.facultyShort ||
              item.sourceLabel ||
              'Uniwersytet Jagielloński'}
          </span>
          <AnnouncementCategoryPill item={item} />
          {added ? (
            <time
              dateTime={added.toISOString()}
              title={`Dodano do UJverse (data pobrania, nie publikacji): ${added.toISOString()}`}
            >
              dodano {formatRelativePast(added, now)}
            </time>
          ) : null}
        </div>
        <h3>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordUsefulSourceOpen('announcement')}
            >
              {item.title}
              <span className="sr-only"> (nowa karta)</span>
            </a>
          ) : (
            item.title
          )}
        </h3>
        {!compact && item.excerpt && item.excerpt !== item.title ? (
          <p className="info-entry-excerpt">{item.excerpt}</p>
        ) : null}
        <ExternalSourceLink
          kind="announcement"
          href={item.sourceUrl}
          title={
            item.sourceIsListing
              ? 'Otwiera listę komunikatów wydziału, ponieważ ogłoszenie nie ma osobnego adresu'
              : undefined
          }
        >
          {item.sourceIsListing
            ? 'Lista komunikatów wydziału'
            : 'Sprawdź w źródle'}
        </ExternalSourceLink>
      </div>
      <SaveToggle item={item} />
    </article>
  )
}

export function RegistrationHubCard({
  item,
  now,
  latestVerifiedAt,
  compact = false,
}: {
  item: InfoRegistration
  now: Date
  latestVerifiedAt: string | null
  compact?: boolean
}) {
  const timing = registrationTiming(item, now)
  const countdown = canShowCountdown(item, timing, now, latestVerifiedAt)
  const opens = new Date(item.opensAt)
  const closes = item.closesAt ? new Date(item.closesAt) : null
  const deadline =
    timing.phase === 'open'
      ? !closes
        ? 'Bez terminu zamknięcia'
        : countdown && timing.msUntilClose !== null
          ? `Zamyka się za ${formatDurationShort(timing.msUntilClose)}`
          : `Do ${formatDateTime(closes, now)}`
      : countdown
        ? `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}`
        : `Od ${formatDateTime(opens, now)}`
  return (
    <article
      className={`deadline-entry semantic-item ${compact ? 'deadline-entry-compact' : ''}`}
      data-tone={
        countdown && timing.urgency === 'closing-critical'
          ? 'urgent'
          : timing.phase === 'open'
            ? 'open'
            : 'upcoming'
      }
    >
      <div className="info-entry-content">
        <div className="info-entry-meta">
          <span
            className={`campus-phase ${timing.phase === 'open' ? 'campus-phase-open' : ''}`}
          >
            {timing.phase === 'open' ? 'Trwa rejestracja' : 'Wkrótce'}
          </span>
          {!compact && item.facultyShort ? (
            <span>{item.facultyShort}</span>
          ) : null}
        </div>
        <h3>{item.title}</h3>
        {!compact && item.unitName ? (
          <p className="info-entry-excerpt">{item.unitName}</p>
        ) : null}
        <p
          className={`deadline-time ${countdown && timing.urgency === 'closing-critical' ? 'deadline-urgent' : ''}`}
        >
          <time
            dateTime={(timing.phase === 'open'
              ? (closes ?? opens)
              : opens
            ).toISOString()}
          >
            {deadline}
          </time>
        </p>
        <ExternalSourceLink href={item.url} kind="registration">
          Otwórz w USOSweb
        </ExternalSourceLink>
      </div>
      {!compact ? <SaveToggle item={item} /> : null}
    </article>
  )
}

export function EventHubCard({ item, now }: { item: InfoEvent; now: Date }) {
  return <EventPreviewTile item={item} now={now} compact />
}

export function ResourceHubCard({
  resource,
  isAuthenticated,
  icon: Glyph,
}: {
  resource: InfoResource
  isAuthenticated: boolean
  icon: Icon
}) {
  const locked = resource.requiresAccount && !isAuthenticated
  const inner = (
    <>
      <Glyph size={21} strokeWidth={1.6} aria-hidden />
      <span className="info-entry-content">
        <span className="campus-resource-title">{resource.label}</span>
        <span className="campus-resource-description">
          {resource.description}
        </span>
        {locked ? (
          <span className="campus-resource-lock">
            <Lock size={12} aria-hidden /> Wymaga konta
          </span>
        ) : null}
      </span>
      <ArrowUpRight size={16} aria-hidden />
    </>
  )
  return resource.external ? (
    <a
      className="resource-entry"
      onClick={() => recordUsefulSourceOpen('tool')}
      href={resource.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
      <span className="sr-only"> (nowa karta)</span>
    </a>
  ) : (
    <Link to={resource.href} className="resource-entry">
      {inner}
    </Link>
  )
}
