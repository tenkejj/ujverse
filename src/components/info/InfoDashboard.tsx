/** Public student information overview. Real content comes before navigation shortcuts. */
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Lock,
  Megaphone,
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
  const [params, setParams] = useSearchParams()
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
  const sections = [
    {
      id: 'announcements',
      label: 'Komunikaty',
      Icon: Megaphone,
      count: announcementsQ.isSuccess ? announcements.length : null,
    },
    {
      id: 'registrations',
      label: 'Rejestracje',
      Icon: ClipboardList,
      count:
        registrationsQ.isSuccess && latestRun ? registrations.length : null,
    },
    {
      id: 'events',
      label: 'Wydarzenia',
      Icon: CalendarDays,
      count:
        eventsQ.isSuccess && eventsQ.data.freshness.latest
          ? events.length
          : null,
    },
  ].filter(
    (section) =>
      !hidden.has(section.id as 'announcements' | 'registrations' | 'events'),
  )
  const currentSection =
    sections.find((section) => section.id === params.get('sekcja'))?.id ??
    sections[0]?.id
  const selectSection = (id: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (id === 'announcements') next.delete('sekcja')
        else next.set('sekcja', id)
        return next
      },
      { replace: true },
    )
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
      <div className="dashboard-opening">
        <header className="dashboard-heading">
          <div>
            {firstName ? (
              <p className="dashboard-greeting">Cześć, {firstName}</p>
            ) : null}
            <h1>Twoje sprawy na UJ, w jednym miejscu</h1>
            <p className="dashboard-description">
              Komunikaty, rejestracje i wydarzenia dla studentów.
            </p>
            <p className="dashboard-context">
              {dateLabel}
              <span aria-hidden> · </span>
              {short ?? 'Wszystkie wydziały'}
            </p>
          </div>
          <CustomizeButton hidden={prefs.hiddenSections} />
        </header>

        <VersusEntry />
      </div>

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

      {sections.length ? (
        <BaseCard
          as="section"
          className="dashboard-overview"
          aria-labelledby="overview-heading"
        >
          <header className="dashboard-overview-heading">
            <div>
              <h2 id="overview-heading">Informacje z uczelni</h2>
              <p>Wybierz, co chcesz sprawdzić.</p>
            </div>
            <span>{short ?? 'Cały UJ'}</span>
          </header>
          <div
            className="dashboard-switcher"
            role="group"
            aria-label="Rodzaj informacji"
          >
            {sections.map(({ id, label, Icon, count }) => (
              <button
                key={id}
                type="button"
                aria-pressed={currentSection === id}
                onClick={() => selectSection(id)}
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden />
                <span>{label}</span>
                {count !== null ? (
                  <span className="dashboard-switcher-count">{count}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="dashboard-grid">
            {currentSection === 'announcements' ? (
              <DashboardPanel
                className="dashboard-announcements"
                title={
                  short
                    ? 'Komunikaty z Twojego wydziału'
                    : 'Najnowsze komunikaty'
                }
                description={short ?? 'Ogłoszenia z wydziałów UJ'}
                href="/komunikaty"
                action="Wszystkie komunikaty"
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
                  <ul className="dashboard-stories">
                    {announcements.slice(0, 2).map((item) => (
                      <li key={item.id}>
                        <AnnouncementHubCard item={item} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardPanel>
            ) : null}

            {currentSection === 'registrations' ? (
              <DashboardPanel
                className="dashboard-registrations"
                title="Rejestracje USOS"
                description={
                  short
                    ? `Trwające i nadchodzące · ${short}`
                    : 'Trwające i nadchodzące tury'
                }
                href="/rejestracje"
                action="Wszystkie rejestracje"
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
                  <ul className="dashboard-deadlines">
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

            {currentSection === 'events' ? (
              <DashboardPanel
                className="dashboard-events"
                title="Wydarzenia na UJ"
                description="Najbliższe spotkania i wydarzenia"
                href="/wydarzenia"
                action="Kalendarz wydarzeń"
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
                  <ul className="dashboard-event-previews">
                    {events.slice(0, 2).map((item) => (
                      <li key={item.id}>
                        <EventHubCard item={item} now={now} />
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardPanel>
            ) : null}
          </div>
        </BaseCard>
      ) : null}

      {!hidden.has('tools') ? (
        <DashboardPanel
          className="dashboard-tools"
          title="Serwisy uczelni"
          description="Serwisy i narzędzia studenckie"
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
  href,
  action,
  className,
  children,
}: {
  title: string
  description: string
  href: string
  action: string
  className: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section
      className={`dashboard-panel ${className}`}
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className={
          className === 'dashboard-tools'
            ? 'dashboard-tools-heading'
            : 'sr-only'
        }
      >
        {title}
      </h2>
      <div className="dashboard-panel-body">{children}</div>
      <footer className="dashboard-panel-heading">
        <p>{description}</p>
        <Link className="dashboard-panel-link" to={href}>
          {action}
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </footer>
    </section>
  )
}
