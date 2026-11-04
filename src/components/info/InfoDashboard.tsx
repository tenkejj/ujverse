/**
 * Strona startowa UJverse (`/`) — informacje zamiast feedu.
 *
 * Jedna kolumna list (bez zagnieżdżonych kafelek): komunikaty, rejestracje,
 * wydarzenia. Każde źródło ma własny stan ładowania / błędu / pustki.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, CalendarDays, Link2, Megaphone } from 'lucide-react'
import { usePublicAnnouncements, usePublicOfficialEvents, usePublicRegistrations } from '../../hooks/usePublicInfo'
import { useInfoStore, type FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { facultyShortLabel, matchesFaculty } from '../../lib/info/faculty'
import {
  activeRegistrationsSorted,
  buildPriorityItems,
  isRegistrationDataStale,
  sortAnnouncementsNewestFirst,
  upcomingEventsSorted,
} from '../../lib/info/relevance'
import { INFO_RESOURCES } from '../../lib/info/resources'
import FacultyPicker from './FacultyPicker'
import { AnnouncementItem, EventItem, RegistrationItem } from './InfoItems'
import {
  CustomizeButton,
  PrioritySection,
  ResourceStrip,
  SavedSection,
  SourcesNote,
} from './InfoBlocks'
import {
  DomainEmpty,
  DomainError,
  INFO_ACTION_LINK_CLS,
  InfoSection,
  RowSkeletons,
} from './infoUi'

const DASHBOARD_ANNOUNCEMENTS = 5
const DASHBOARD_REGISTRATIONS = 3
const DASHBOARD_EVENTS = 3
const DASHBOARD_TOOL_IDS = ['usosweb', 'pegaz', 'poczta', 'sale', 'moj-plan', 'miejsca']

type Props = {
  faculty: FacultyPreference
  isAuthenticated: boolean
  firstName: string | null
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={INFO_ACTION_LINK_CLS} aria-label={label}>
      Wszystkie →
    </Link>
  )
}

function FeedList({ children, dimmed = false }: { children: ReactNode; dimmed?: boolean }) {
  return (
    <ul
      className={`divide-y divide-zinc-200/80 dark:divide-white/10 ${dimmed ? 'opacity-60' : ''}`}
      role="list"
    >
      {children}
    </ul>
  )
}

export default function InfoDashboard({ faculty, isAuthenticated, firstName }: Props) {
  const now = useNow()
  const { prefs, saved } = useInfoStore()
  const hidden = new Set(prefs.hiddenSections)
  const selected = faculty.faculty
  const selectedShort = selected ? (facultyShortLabel(selected) ?? selected) : null

  const announcementsQ = usePublicAnnouncements(selected)
  const registrationsQ = usePublicRegistrations()
  const eventsQ = usePublicOfficialEvents()

  const announcements = sortAnnouncementsNewestFirst(announcementsQ.data?.items ?? [])
  const registrationsAll = registrationsQ.data?.items ?? []
  const latestRegistrationRun = registrationsQ.data?.freshness.latest ?? null
  const activeRegistrations = activeRegistrationsSorted(registrationsAll, now)
  const registrations = activeRegistrations.filter((reg) => matchesFaculty(reg.faculty, selected))
  const otherRegistrationsCount = activeRegistrations.length - registrations.length
  const events = upcomingEventsSorted(eventsQ.data?.items ?? [], now)
  const registrationsStale = registrationsQ.isSuccess && isRegistrationDataStale(latestRegistrationRun, now)

  const priority = buildPriorityItems({
    faculty: selected,
    announcements,
    registrations: registrationsAll,
    now,
    latestRegistrationVerifiedAt: latestRegistrationRun,
  })

  const tools = INFO_RESOURCES.filter((r) => DASHBOARD_TOOL_IDS.includes(r.id))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-2">
      <header className="flex flex-col gap-3 px-1 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-ink dark:text-brand-gold-bright">
            {firstName ? `Cześć, ${firstName}` : 'UJverse'}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
            Wszystko, co ważne na UJ, w jednym miejscu
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FacultyPicker
            faculty={selected}
            source={faculty.source}
            persistent={faculty.persistent}
            onChange={faculty.setFaculty}
            className="lg:hidden"
          />
          <CustomizeButton hidden={prefs.hiddenSections} />
        </div>
        {!selected ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Widok całego UJ — wybierz wydział, żeby zawęzić komunikaty i terminy.
          </p>
        ) : null}
      </header>

      {selectedShort ? <PrioritySection items={priority} facultyLabel={selectedShort} now={now} /> : null}

      {!hidden.has('announcements') ? (
        <InfoSection
          variant="feed"
          icon={Megaphone}
          title={selected ? 'Komunikaty z Twojego wydziału' : 'Najnowsze komunikaty'}
          action={<SeeAll to="/komunikaty" label="Wszystkie komunikaty" />}
          busy={announcementsQ.isFetching}
        >
          {announcementsQ.isPending ? (
            <RowSkeletons count={4} variant="feed" />
          ) : announcementsQ.isError && announcements.length === 0 ? (
            <div className="pt-3">
              <DomainError what="komunikaty" onRetry={() => void announcementsQ.refetch()} />
            </div>
          ) : announcements.length === 0 ? (
            <div className="pt-3">
              <DomainEmpty
                tone="quiet"
                action={
                  selected ? (
                    <button type="button" onClick={() => faculty.setFaculty(null)} className={`${INFO_ACTION_LINK_CLS} -ml-2`}>
                      Pokaż komunikaty z całego UJ
                    </button>
                  ) : undefined
                }
              >
                {selected
                  ? `Brak nowych komunikatów z wydziału ${selectedShort} w ostatnich 30 dniach.`
                  : 'Brak nowych komunikatów w ostatnich 30 dniach.'}
              </DomainEmpty>
            </div>
          ) : (
            <FeedList dimmed={announcementsQ.isPlaceholderData}>
              {announcements.slice(0, DASHBOARD_ANNOUNCEMENTS).map((item) => (
                <li key={item.id}>
                  <AnnouncementItem item={item} now={now} variant="feed" />
                </li>
              ))}
            </FeedList>
          )}
        </InfoSection>
      ) : null}

      {!hidden.has('registrations') ? (
        <InfoSection
          variant="feed"
          icon={AlarmClock}
          title="Nadchodzące rejestracje"
          action={<SeeAll to="/rejestracje" label="Wszystkie rejestracje" />}
          busy={registrationsQ.isFetching}
        >
          {registrationsQ.isPending ? (
            <RowSkeletons count={2} variant="feed" />
          ) : registrationsQ.isError ? (
            <div className="pt-3">
              <DomainError what="rejestracje z USOSweb" onRetry={() => void registrationsQ.refetch()} />
            </div>
          ) : latestRegistrationRun === null ? (
            <div className="pt-3">
              <DomainEmpty tone="quiet">Dane o rejestracjach z USOSweb są chwilowo niedostępne.</DomainEmpty>
            </div>
          ) : (
            <>
              {registrationsStale ? (
                <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  Dane z USOSweb mogą być nieaktualne — sprawdź terminy w źródle.
                </p>
              ) : null}
              {registrations.length === 0 ? (
                <div className="pt-3">
                  <DomainEmpty
                    tone="quiet"
                    action={
                      selected && otherRegistrationsCount > 0 ? (
                        <Link to="/rejestracje" className={`${INFO_ACTION_LINK_CLS} -ml-2`}>
                          Zobacz {otherRegistrationsCount} w innych jednostkach UJ
                        </Link>
                      ) : undefined
                    }
                  >
                    {selected
                      ? `Brak aktywnych rejestracji dla ${selectedShort}.`
                      : 'Brak aktywnych rejestracji w katalogu USOSweb.'}
                  </DomainEmpty>
                </div>
              ) : (
                <FeedList>
                  {registrations.slice(0, DASHBOARD_REGISTRATIONS).map((item) => (
                    <li key={item.id}>
                      <RegistrationItem item={item} now={now} latestVerifiedAt={latestRegistrationRun} variant="feed" />
                    </li>
                  ))}
                </FeedList>
              )}
            </>
          )}
        </InfoSection>
      ) : null}

      {!hidden.has('events') ? (
        <InfoSection
          variant="feed"
          icon={CalendarDays}
          title="Wydarzenia na UJ"
          action={<SeeAll to="/wydarzenia" label="Wszystkie wydarzenia" />}
          busy={eventsQ.isFetching}
        >
          {eventsQ.isPending ? (
            <RowSkeletons count={2} variant="feed" />
          ) : eventsQ.isError ? (
            <div className="pt-3">
              <DomainError what="wydarzenia" onRetry={() => void eventsQ.refetch()} />
            </div>
          ) : eventsQ.data.freshness.latest === null ? (
            <div className="pt-3">
              <DomainEmpty tone="quiet">Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.</DomainEmpty>
            </div>
          ) : events.length === 0 ? (
            <div className="pt-3">
              <DomainEmpty tone="quiet">Brak zapowiedzianych wydarzeń w kalendarzu UJ.</DomainEmpty>
            </div>
          ) : (
            <FeedList>
              {events.slice(0, DASHBOARD_EVENTS).map((item) => (
                <li key={item.id}>
                  <EventItem item={item} now={now} variant="feed" />
                </li>
              ))}
            </FeedList>
          )}
        </InfoSection>
      ) : null}

      <SavedSection items={saved} now={now} />

      {!hidden.has('tools') ? (
        <InfoSection
          variant="feed"
          icon={Link2}
          title="Niezbędnik studenta"
          action={<SeeAll to="/niezbednik" label="Wszystkie narzędzia" />}
        >
          <div className="pt-3">
            <ResourceStrip resources={tools} isAuthenticated={isAuthenticated} />
          </div>
        </InfoSection>
      ) : null}

      <SourcesNote
        announcementsLatest={announcementsQ.data?.freshness.latest ?? null}
        registrationsLatest={latestRegistrationRun}
        registrationsStale={registrationsStale}
        eventsLatest={eventsQ.data?.freshness.latest ?? null}
        now={now}
      />
    </div>
  )
}
