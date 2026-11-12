/** Public student information overview. Real content comes before navigation shortcuts. */
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Megaphone,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
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
  isRegistrationDataStale,
  sortAnnouncementsNewestFirst,
} from '../../lib/info/relevance'
import { upcomingEventsSorted } from '../../lib/info/relevance'
import ActionRadar from './ActionRadar'
import StudyProfilePicker from './StudyProfilePicker'
import PilotParticipation from './PilotParticipation'
import { recordUsefulSourceOpen } from '../../lib/info/productMetrics'
import '../../styles/audit-start.css'
import VersusEntry from '../chat/VersusEntry'
import { AnnouncementHubCard, RegistrationHubCard } from './InfoHubCards'
import { CustomizeButton, SavedSection } from './InfoBlocks'
import InfoFooter from './InfoFooter'
import InfoEventCalendar from './InfoEventCalendar'
import { EventPreviewTile } from './InfoItems'
import DataFreshness, { type DataFreshnessKind } from './DataFreshness'
import { DomainEmpty, DomainError, RowSkeletons } from './infoUi'

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
  const visualEvents = events.filter((item) => item.imageUrl).slice(0, 2)
  const eventPreviews = visualEvents.length ? visualEvents : events.slice(0, 2)
  const showEventPreview = !hidden.has('events')
  const stale =
    registrationsQ.isSuccess && isRegistrationDataStale(latestRun, now)
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
      label: 'Kalendarz',
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
  const freshnessKind: DataFreshnessKind =
    currentSection === 'registrations'
      ? 'registrations'
      : currentSection === 'events'
        ? 'events'
        : 'announcements'
  const activeQuery =
    freshnessKind === 'registrations'
      ? registrationsQ
      : freshnessKind === 'events'
        ? eventsQ
        : announcementsQ
  const placeholder =
    freshnessKind === 'announcements' && announcementsQ.isPlaceholderData
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
          <h1>Co warto dziś sprawdzić?</h1>
          <p className="dashboard-context">
            <CalendarDays size={14} aria-hidden /> {dateLabel}
            <span aria-hidden> · </span>
            {short ?? 'Wszystkie wydziały'}
          </p>
        </div>
        <CustomizeButton hidden={prefs.hiddenSections} />
      </header>
      <StudyProfilePicker
        faculty={selected}
        onFacultyChange={faculty.setFaculty}
      />
      <ActionRadar
        faculty={selected}
        announcements={announcementsQ.isPlaceholderData ? [] : announcements}
        registrations={registrationsQ.data?.items ?? []}
        latestRegistrationVerifiedAt={latestRun}
        now={now}
        announcementsLoading={
          announcementsQ.isPending || announcementsQ.isPlaceholderData
        }
        registrationsLoading={registrationsQ.isPending}
        announcementsError={announcementsQ.isError}
        registrationsError={registrationsQ.isError}
        onActionOpen={(action) =>
          recordUsefulSourceOpen(
            action.kind === 'registration' ? 'registration' : 'announcement',
          )
        }
      />
      <div className="dashboard-guide-links" aria-label="Jak załatwić sprawę">
        <BookOpen size={18} aria-hidden />
        <Link to="/poradniki/stypendium-rektora">Stypendium rektora</Link>
        <Link to="/poradniki/akademik">Akademik</Link>
        <Link to="/poradniki/rejestracje-usos">Rejestracje USOS</Link>
        <Link to="/poradniki" className="dashboard-panel-link">
          Wszystkie poradniki <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="dashboard-opening dashboard-assistant-support">
        <VersusEntry />
      </div>

      <div
        className={`dashboard-content${showEventPreview ? ' dashboard-content-with-events' : ''}`}
      >
        {sections.length ? (
          <section
            className="dashboard-overview"
            aria-labelledby="overview-heading"
          >
            <header className="dashboard-overview-heading">
              <div>
                <h2 id="overview-heading">
                  <span className="dashboard-section-icon" aria-hidden>
                    <Megaphone size={20} strokeWidth={1.75} />
                  </span>{' '}
                  Na uczelni
                </h2>
              </div>
              <span>
                {currentSection === 'events' ? 'Cały UJ' : (short ?? 'Cały UJ')}
              </span>
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
            <div className="dashboard-freshness">
              <DataFreshness
                compact
                kind={freshnessKind}
                iso={
                  placeholder
                    ? null
                    : (activeQuery.data?.freshness.latest ?? null)
                }
                checkedAt={placeholder ? undefined : activeQuery.dataUpdatedAt}
                now={now}
                status={
                  activeQuery.isPending || placeholder
                    ? 'loading'
                    : activeQuery.isError
                      ? 'error'
                      : 'ready'
                }
                stale={freshnessKind === 'registrations' && stale}
              />
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
                      {announcements.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          <AnnouncementHubCard item={item} now={now} compact />
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
                  title="Kalendarz wydarzeń"
                  description="Wybierz dzień, żeby zobaczyć wydarzenia"
                  href="/wydarzenia?widok=kalendarz"
                  action="Pełny kalendarz"
                >
                  {eventsQ.isPending ? (
                    <RowSkeletons count={2} variant="feed" />
                  ) : eventsQ.isError ? (
                    <DomainError
                      what="wydarzenia"
                      onRetry={() => void eventsQ.refetch()}
                      compact
                    />
                  ) : !eventsQ.data?.freshness.latest ? (
                    <DomainEmpty tone="quiet">
                      Dane o wydarzeniach są chwilowo niedostępne.
                    </DomainEmpty>
                  ) : (
                    <InfoEventCalendar
                      events={events}
                      now={now}
                      variant="compact"
                    />
                  )}
                </DashboardPanel>
              ) : null}
            </div>
          </section>
        ) : null}
        {showEventPreview ? (
          <section
            className="dashboard-discover"
            aria-labelledby="discover-heading"
          >
            <header className="dashboard-discover-heading">
              <h2 id="discover-heading">
                <CalendarDays size={20} strokeWidth={1.75} aria-hidden />{' '}
                Wydarzenia na UJ
              </h2>
              <Link to="/wydarzenia" className="dashboard-panel-link">
                Zobacz wszystkie <ArrowUpRight size={14} aria-hidden />
              </Link>
            </header>
            <DataFreshness
              compact
              kind="events"
              iso={eventsQ.data?.freshness.latest ?? null}
              checkedAt={eventsQ.dataUpdatedAt}
              now={now}
              status={
                eventsQ.isPending
                  ? 'loading'
                  : eventsQ.isError
                    ? 'error'
                    : 'ready'
              }
            />
            {eventsQ.isPending ? (
              <RowSkeletons count={2} variant="feed" />
            ) : eventsQ.isError ? (
              <DomainError
                what="wydarzenia"
                onRetry={() => void eventsQ.refetch()}
                compact
              />
            ) : !eventPreviews.length ? (
              <DomainEmpty tone="quiet">
                Brak nadchodzących wydarzeń w pobranym kalendarzu.
              </DomainEmpty>
            ) : (
              <ul className="dashboard-photo-events">
                {eventPreviews.map((item) => (
                  <li key={item.id}>
                    <EventPreviewTile item={item} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <PilotParticipation />
      {saved.length ? (
        <section className="dashboard-saved" aria-label="Zapisane informacje">
          <SavedSection items={saved} now={now} />
        </section>
      ) : null}
      {hidden.size > 0 ? (
        <p className="campus-hidden-note">
          Część sekcji jest ukryta. Możesz je przywrócić przez „Dostosuj” u góry
          strony.
        </p>
      ) : null}
      <InfoFooter
        isAuthenticated={isAuthenticated}
        showTools={!hidden.has('tools')}
        announcementsLatest={announcementsQ.data?.freshness.latest ?? null}
        registrationsLatest={latestRun}
        registrationsStale={stale}
        eventsLatest={eventsQ.data?.freshness.latest ?? null}
        now={now}
      />
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
      <h2 id={headingId} className="sr-only">
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
