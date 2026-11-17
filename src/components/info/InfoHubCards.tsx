import { ArrowUpRight, Lock } from 'lucide-react'
import { useId, useState, type ComponentType, type SVGProps } from 'react'
import { DataService } from '../../services/DataService'
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
  detailed = false,
}: {
  item: InfoAnnouncement
  now: Date
  compact?: boolean
  detailed?: boolean
}) {
  const added = parseIsoDate(item.addedAt)
  const [fullBody, setFullBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const loadBody = async () => {
    if (!item.mayHaveFullBody || fullBody !== null || loading) return
    setLoading(true)
    setError(false)
    try {
      setFullBody(await DataService.fetchPublicAnnouncementFullBody(item.id) || item.body)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
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
          <p className="info-entry-excerpt">{detailed ? item.excerpt : item.excerpt.slice(0, 140) + (item.excerpt.length > 140 ? '…' : '')}</p>
        ) : null}
        {!compact && (item.body || item.mayHaveFullBody) ? (
          <div className="announcement-disclosure">
            <button type="button" aria-expanded={expanded} aria-controls={bodyId}
              onClick={() => { setExpanded(!expanded); if (!expanded) void loadBody() }}>
              {expanded ? 'Zwiń treść' : 'Czytaj treść'}
            </button>
            <div id={bodyId} hidden={!expanded}>
              <p className="announcement-body">{fullBody ?? item.body}</p>
              {loading ? <p role="status">Wczytuję pełną treść…</p> : null}
              {error ? <p role="status">Nie udało się pobrać pełnej treści. <button type="button" onClick={() => void loadBody()}>Spróbuj ponownie</button> lub sprawdź źródło.</p> : null}
            </div>
          </div>
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

function registrationDeadline(
  item: InfoRegistration,
  now: Date,
  timing: ReturnType<typeof registrationTiming>,
  countdown: boolean,
): string {
  const opens = new Date(item.opensAt)
  const closes = item.closesAt ? new Date(item.closesAt) : null
  if (timing.phase === 'closed') return closes ? `Zakończona ${formatDateTime(closes, now)}` : 'Zakończona'
  if (timing.phase === 'open') {
    if (!closes) return 'Bez terminu zamknięcia'
    if (countdown && timing.msUntilClose !== null) return `Zamyka się za ${formatDurationShort(timing.msUntilClose)}`
    return `Do ${formatDateTime(closes, now)}`
  }
  return countdown ? `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}` : `Od ${formatDateTime(opens, now)}`
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
  const critical = countdown && timing.urgency === 'closing-critical'
  const phaseLabel = { open: 'Trwa', upcoming: 'Wkrótce', closed: 'Zakończona' }[timing.phase]
  const deadline = registrationDeadline(item, now, timing, countdown)
  return (
    <article
      className={`deadline-entry semantic-item ${compact ? 'deadline-entry-compact' : ''}`}
      data-tone={critical ? 'urgent' : timing.phase}
    >
      <div className="info-entry-content">
        <div className="info-entry-meta">
          <span
            className={`campus-phase ${timing.phase === 'open' ? 'campus-phase-open' : ''}`}
          >
            {phaseLabel}
          </span>
          {!compact && item.facultyShort ? (
            <span>{item.facultyShort}</span>
          ) : null}
        </div>
        <h3>{item.title}</h3>
        {!compact && item.unitName ? (
          <p className="info-entry-excerpt">{item.unitName}</p>
        ) : null}
      {!compact ? <dl className="registration-dates">
        <div><dt>Rozpoczęcie</dt><dd><time dateTime={item.opensAt}>{formatDateTime(opens, now)}</time></dd></div>
        <div><dt>Zakończenie</dt><dd>{closes ? <time dateTime={item.closesAt!}>{formatDateTime(closes, now)}</time> : 'Bez terminu zamknięcia'}</dd></div>
      </dl> : null}
        <p
          className={`deadline-time ${critical ? 'deadline-urgent' : ''}`}
        >
          <time
            dateTime={(timing.phase !== 'upcoming'
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
