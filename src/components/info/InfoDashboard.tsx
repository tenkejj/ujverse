/** Public student information overview. Real content comes before navigation shortcuts. */
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Lock,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import BaseCard from '../ui/BaseCard'
import {
  usePublicAnnouncements,
  usePublicOfficialEvents,
  usePublicRegistrations,
} from '../../hooks/usePublicInfo'
import {
  useInfoStore,
  type FacultyPreference,
} from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { facultyShortLabel, matchesFaculty } from '../../lib/info/faculty'
import {
  activeRegistrationsSorted,
  buildPriorityItems,
  isRegistrationDataStale,
  sortAnnouncementsNewestFirst,
} from '../../lib/info/relevance'
import { upcomingEventsSorted } from '../../lib/info/relevance'
import { INFO_RESOURCES } from '../../lib/info/resources'
import { formatDurationShort } from '../../lib/info/time'
import VersusEntry from '../chat/VersusEntry'
import {
  AnnouncementHubCard,
  EventHubCard,
  RegistrationHubCard,
} from './InfoHubCards'
import { CustomizeButton, SavedSection, SourcesNote } from './InfoBlocks'
import {
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  RowSkeletons,
} from './infoUi'

type Props = {
  faculty: FacultyPreference
  isAuthenticated: boolean
  firstName: string | null
}

export default function InfoDashboard({
  faculty,
  firstName,
  isAuthenticated,
}: Props) {
  const now = useNow()
  const { prefs, saved } = useInfoStore()
  const hidden = new Set(prefs.hiddenSections)
  const selected = faculty.faculty
  const short = selected ? (facultyShortLabel(selected) ?? selected) : null
  const announcementsQ = usePublicAnnouncements(selected)
  const registrationsQ = usePublicRegistrations()
  const eventsQ = usePublicOfficialEvents()
  const announcements = sortAnnouncementsNewestFirst(
    announcementsQ.data?.items ?? [],
  )
  const latestRun = registrationsQ.data?.freshness.latest ?? null
  const active = activeRegistrationsSorted(
    registrationsQ.data?.items ?? [],
    now,
  )
  const registrations = active.filter((item) =>
    matchesFaculty(item.faculty, selected),
  )
  const events = upcomingEventsSorted(eventsQ.data?.items ?? [], now)
  const stale =
    registrationsQ.isSuccess && isRegistrationDataStale(latestRun, now)
  const priority = buildPriorityItems({
    faculty: selected,
    announcements,
    registrations: registrationsQ.data?.items ?? [],
    now,
    latestRegistrationVerifiedAt: latestRun,
  })[0]
  const quickLinks = [
    'usosweb',
    'pegaz',
    'poczta',
    'sale',
    'moj-plan',
    'miejsca',
  ].flatMap((id) => INFO_RESOURCES.filter((r) => r.id === id))
  const priorityLabel = !priority
    ? ''
    : priority.kind === 'announcement'
      ? priority.reason === 'cancelled'
        ? 'Odwołane zajęcia'
        : 'Zajęcia zdalne'
      : priority.reason === 'registration-closing'
        ? `Rejestracja zamyka się za ${formatDurationShort(Date.parse(priority.item.closesAt ?? priority.item.opensAt) - now.getTime())}`
        : `Rejestracja otwiera się za ${formatDurationShort(Date.parse(priority.item.opensAt) - now.getTime())}`
  const dateLabel = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'Europe/Warsaw',
  }).format(now)

  return (
    <div className="campus-home student-dashboard">
      <header className="dashboard-heading">
        <div>
          {firstName ? (
            <p className="dashboard-greeting">Cześć, {firstName}</p>
          ) : null}
          <h1>Dziś na UJ</h1>
          <p>
            {dateLabel}
            <span aria-hidden> · </span>
            {short ?? 'Wszystkie wydziały'}
          </p>
        </div>
        <CustomizeButton hidden={prefs.hiddenSections} />
      </header>

      <VersusEntry />

      {priority ? (
        <section
          className="dashboard-priority"
          aria-labelledby="priority-heading"
        >
          <div>
            <h2 id="priority-heading">Ważne teraz</h2>
            <p>{priorityLabel}</p>
            <h3>{priority.item.title}</h3>
          </div>
          <ExternalSourceLink
            href={
              priority.kind === 'announcement'
                ? priority.item.sourceUrl
                : priority.item.url
            }
          >
            Sprawdź w źródle
          </ExternalSourceLink>
        </section>
      ) : null}

      <div className="dashboard-grid">
        {!hidden.has('announcements') ? (
          <DashboardPanel
            className="dashboard-announcements"
            title={
              short ? 'Komunikaty z Twojego wydziału' : 'Najnowsze komunikaty'
            }
            description={short ?? 'Ogłoszenia z wydziałów UJ'}
            icon={Megaphone}
            href="/komunikaty"
            action="Wszystkie komunikaty"
            count={announcementsQ.isSuccess ? announcements.length : undefined}
          >
            {announcementsQ.isPending ? (
              <RowSkeletons count={3} variant="feed" />
            ) : announcementsQ.isError && !announcements.length ? (
              <DomainError
                what="komunikaty"
                onRetry={() => void announcementsQ.refetch()}
                compact
              />
            ) : !announcements.length ? (
              <DomainEmpty
                tone="quiet"
                action={
                  selected ? (
                    <button
                      type="button"
                      className="campus-text-link"
                      onClick={() => faculty.setFaculty(null)}
                    >
                      Pokaż cały UJ
                    </button>
                  ) : undefined
                }
              >
                Brak nowych komunikatów{short ? ` dla ${short}` : ''} w
                ostatnich 30 dniach.
              </DomainEmpty>
            ) : (
              <ul className="campus-entry-list">
                {announcements.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <AnnouncementHubCard item={item} now={now} compact />
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        ) : null}

        {!hidden.has('registrations') ? (
          <DashboardPanel
            className="dashboard-registrations"
            title="Rejestracje USOS"
            description={
              short
                ? `Trwające i nadchodzące · ${short}`
                : 'Trwające i nadchodzące tury'
            }
            icon={ClipboardList}
            href="/rejestracje"
            action="Wszystkie rejestracje"
            count={
              registrationsQ.isSuccess && latestRun
                ? registrations.length
                : undefined
            }
          >
            {registrationsQ.isPending ? (
              <RowSkeletons count={2} variant="feed" />
            ) : registrationsQ.isError ? (
              <DomainError
                what="rejestracje z USOSweb"
                onRetry={() => void registrationsQ.refetch()}
                compact
              />
            ) : !latestRun ? (
              <DomainEmpty tone="quiet">
                Dane o rejestracjach z USOSweb są chwilowo niedostępne.
              </DomainEmpty>
            ) : !registrations.length ? (
              <DomainEmpty
                tone="quiet"
                action={
                  selected && active.length ? (
                    <button
                      type="button"
                      className="campus-text-link"
                      onClick={() => faculty.setFaculty(null)}
                    >
                      Pokaż rejestracje z całego UJ
                    </button>
                  ) : undefined
                }
              >
                Brak aktywnych rejestracji{short ? ` dla ${short}` : ''}.
              </DomainEmpty>
            ) : (
              <ul className="campus-entry-list">
                {registrations.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <RegistrationHubCard
                      item={item}
                      now={now}
                      latestVerifiedAt={latestRun}
                      compact
                    />
                  </li>
                ))}
              </ul>
            )}
            {stale && latestRun ? (
              <p className="campus-stale-note">
                Dane mogą być nieaktualne. Potwierdź termin w USOSweb.
              </p>
            ) : null}
          </DashboardPanel>
        ) : null}

        {!hidden.has('events') ? (
          <DashboardPanel
            className="dashboard-events"
            title="Wydarzenia na UJ"
            description="Najbliższe spotkania i wydarzenia"
            icon={CalendarDays}
            href="/wydarzenia"
            action="Kalendarz wydarzeń"
            count={
              eventsQ.isSuccess && eventsQ.data.freshness.latest
                ? events.length
                : undefined
            }
          >
            {eventsQ.isPending ? (
              <RowSkeletons count={2} variant="feed" />
            ) : eventsQ.isError ? (
              <DomainError
                what="wydarzenia"
                onRetry={() => void eventsQ.refetch()}
                compact
              />
            ) : !events.length ? (
              <DomainEmpty tone="quiet">
                {eventsQ.data?.freshness.latest
                  ? 'Brak nadchodzących wydarzeń w katalogu.'
                  : 'Dane o wydarzeniach są chwilowo niedostępne.'}
              </DomainEmpty>
            ) : (
              <ul className="campus-event-list">
                {events.slice(0, 2).map((item) => (
                  <li key={item.id}>
                    <EventHubCard item={item} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        ) : null}

        {!hidden.has('tools') ? (
          <DashboardPanel
            className="dashboard-tools"
            title="Pod ręką"
            description="Serwisy i narzędzia studenckie"
            icon={BookOpen}
            href="/niezbednik"
            action="Cały niezbędnik"
          >
            <ul className="dashboard-tool-list">
              {quickLinks.map((resource) => {
                const label = (
                  <>
                    <span>{resource.label}</span>
                    {resource.requiresAccount && !isAuthenticated ? (
                      <>
                        <Lock size={13} aria-hidden />
                        <span className="sr-only"> (wymaga konta)</span>
                      </>
                    ) : null}
                    <ArrowUpRight size={14} aria-hidden />
                  </>
                )
                return (
                  <li key={resource.id}>
                    {resource.external ? (
                      <a
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {label}
                        <span className="sr-only"> (nowa karta)</span>
                      </a>
                    ) : (
                      <Link to={resource.href}>{label}</Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </DashboardPanel>
        ) : null}
      </div>

      {saved.length ? (
        <BaseCard className="dashboard-saved">
          <SavedSection items={saved} now={now} />
        </BaseCard>
      ) : null}
      {hidden.size > 0 ? (
        <p className="campus-hidden-note">
          Część sekcji jest ukryta. Możesz je przywrócić przez „Dostosuj” u góry
          strony.
        </p>
      ) : null}
      <p className="dashboard-disclaimer">
        UJverse to niezależny projekt studencki. Ważne informacje potwierdzaj w
        źródle.
      </p>
      <details className="dashboard-sources">
        <summary>Źródła i aktualność danych</summary>
        <SourcesNote
          announcementsLatest={announcementsQ.data?.freshness.latest ?? null}
          registrationsLatest={latestRun}
          registrationsStale={stale}
          eventsLatest={eventsQ.data?.freshness.latest ?? null}
          now={now}
        />
      </details>
    </div>
  )
}

function DashboardPanel({
  title,
  description,
  icon: Icon,
  href,
  action,
  count,
  className,
  children,
}: {
  title: string
  description: string
  icon: LucideIcon
  href: string
  action: string
  count?: number
  className: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <BaseCard
      as="section"
      className={`dashboard-panel ${className}`}
      aria-labelledby={headingId}
    >
      <header className="dashboard-panel-heading">
        <Icon size={18} strokeWidth={1.7} aria-hidden />
        <div>
          <h2 id={headingId}>
            {title}
            {typeof count === 'number' ? (
              <span className="dashboard-panel-count">{count}</span>
            ) : null}
          </h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="dashboard-panel-body">{children}</div>
      <Link className="dashboard-panel-link" to={href}>
        {action}
        <ArrowUpRight size={14} aria-hidden />
      </Link>
    </BaseCard>
  )
}
