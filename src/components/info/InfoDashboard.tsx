/** Public student information overview. Real content comes before navigation shortcuts. */
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays } from 'lucide-react'
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
import FacultyPicker from './FacultyPicker'
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

export default function InfoDashboard({ faculty, firstName }: Props) {
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
  const priorityHidden =
    priority &&
    hidden.has(
      priority.kind === 'announcement' ? 'announcements' : 'registrations',
    )
  const quickLinks = ['usosweb', 'pegaz', 'poczta', 'sale'].flatMap((id) =>
    INFO_RESOURCES.filter((r) => r.id === id),
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
    <div className="campus-home">
      <header className="campus-page-heading">
        <div>
          <p className="campus-intro">
            {firstName
              ? `Cześć, ${firstName}. Co słychać na uczelni?`
              : 'Twój przegląd spraw uczelni'}
          </p>
          <h1>Na bieżąco z UJ.</h1>
          <p>Komunikaty, terminy i życie uczelni.</p>
        </div>
        <div className="campus-heading-side">
          <time
            dateTime={new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'Europe/Warsaw',
            }).format(now)}
          >
            {dateLabel}
          </time>
          <CustomizeButton hidden={prefs.hiddenSections} />
        </div>
      </header>

      <div className="campus-faculty-bar">
        <div>
          <span className="campus-faculty-label">
            {short ? 'Twój wydział' : 'Informacje dla Ciebie'}
          </span>
          <p>
            {short
              ? 'Komunikaty i rejestracje dopasowane do wydziału.'
              : 'Wybierz wydział, żeby zawęzić komunikaty i rejestracje.'}
          </p>
        </div>
        <FacultyPicker
          faculty={selected}
          source={faculty.source}
          persistent={faculty.persistent}
          onChange={faculty.setFaculty}
        />
      </div>

      {priority && !priorityHidden ? (
        <section className="campus-priority" aria-labelledby="priority-heading">
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

      <div className="campus-overview">
        <div className="campus-main-column">
          {!hidden.has('announcements') ? (
            <section aria-labelledby="announcements-heading">
              <div className="campus-section-heading">
                <div>
                  <h2 id="announcements-heading">
                    {short
                      ? 'Komunikaty z Twojego wydziału'
                      : 'Najnowsze komunikaty'}
                  </h2>
                  <p>{short ?? 'Z wydziałów Uniwersytetu Jagiellońskiego'}</p>
                </div>
                <Link to="/komunikaty">
                  Wszystkie <span className="sr-only">komunikaty</span>
                  <ArrowUpRight size={15} aria-hidden />
                </Link>
              </div>
              {announcementsQ.isPending ? (
                <RowSkeletons count={5} variant="feed" />
              ) : announcementsQ.isError && !announcements.length ? (
                <DomainError
                  what="komunikaty"
                  onRetry={() => void announcementsQ.refetch()}
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
              {announcements.length > 3 ? (
                <Link className="campus-more-link" to="/komunikaty">
                  Przejdź do wszystkich komunikatów{' '}
                  <span aria-hidden>({announcements.length})</span>
                </Link>
              ) : null}
            </section>
          ) : null}
          {!hidden.has('events') ? (
            <section className="campus-events" aria-labelledby="events-heading">
              <div className="campus-section-heading">
                <div>
                  <h2 id="events-heading">W najbliższym czasie</h2>
                  <p>Wydarzenia dla całej społeczności UJ</p>
                </div>
                <Link to="/wydarzenia">
                  Kalendarz <ArrowUpRight size={15} aria-hidden />
                </Link>
              </div>
              {eventsQ.isPending ? (
                <RowSkeletons count={2} variant="feed" />
              ) : eventsQ.isError ? (
                <DomainError
                  what="wydarzenia"
                  onRetry={() => void eventsQ.refetch()}
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
            </section>
          ) : null}
          {saved.length ? (
            <div className="campus-saved">
              <SavedSection items={saved} now={now} />
            </div>
          ) : null}
          {hidden.size > 0 ? (
            <p className="campus-hidden-note">
              Część sekcji jest ukryta. Możesz je przywrócić przez „Dostosuj” u
              góry strony.
            </p>
          ) : null}
        </div>

        <aside
          className="campus-context"
          aria-label="Terminy i przydatne linki"
        >
          {!hidden.has('registrations') ? (
            <section aria-labelledby="registrations-heading">
              <div className="campus-section-heading">
                <div>
                  <h2 id="registrations-heading">Rejestracje USOS</h2>
                  <p>
                    {short ? `Dla ${short}` : 'Trwające i nadchodzące tury'}
                  </p>
                </div>
                <CalendarDays size={18} aria-hidden />
              </div>
              {registrationsQ.isPending ? (
                <RowSkeletons count={2} variant="feed" />
              ) : registrationsQ.isError ? (
                <DomainError
                  what="rejestracje z USOSweb"
                  onRetry={() => void registrationsQ.refetch()}
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
              <Link to="/rejestracje" className="campus-more-link">
                Wszystkie rejestracje <ArrowUpRight size={14} aria-hidden />
              </Link>
            </section>
          ) : null}
          {!hidden.has('tools') ? (
            <section
              className="campus-quick-links"
              aria-labelledby="quick-links-heading"
            >
              <div className="campus-section-heading">
                <h2 id="quick-links-heading">Pod ręką</h2>
                <Link to="/niezbednik">
                  Niezbędnik <ArrowUpRight size={14} aria-hidden />
                </Link>
              </div>
              <ul>
                {quickLinks.map((resource) => (
                  <li key={resource.id}>
                    {resource.external ? (
                      <a
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {resource.label}
                        <ArrowUpRight size={16} aria-hidden />
                        <span className="sr-only"> (nowa karta)</span>
                      </a>
                    ) : (
                      <Link to={resource.href}>
                        {resource.label}
                        <ArrowUpRight size={16} aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <div className="campus-about">
            <p>
              Z oficjalnych źródeł.
              <br />Z myślą o studentach.
            </p>
            <span>
              UJverse to niezależny projekt studencki. Najważniejsze informacje
              potwierdzaj w źródle.
            </span>
          </div>
        </aside>
      </div>
      <div className="campus-source-footer">
        <SourcesNote
          announcementsLatest={announcementsQ.data?.freshness.latest ?? null}
          registrationsLatest={latestRun}
          registrationsStale={stale}
          eventsLatest={eventsQ.data?.freshness.latest ?? null}
          now={now}
        />
      </div>
    </div>
  )
}
