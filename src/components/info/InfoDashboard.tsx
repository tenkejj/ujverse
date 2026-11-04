/**
 * Strona startowa UJverse (`/`) — informacje zamiast feedu.
 *
 * Trzy niezależne źródła (komunikaty, rejestracje, wydarzenia): każde ma
 * własny stan ładowania / błędu / pustki, więc awaria jednego nie ukrywa reszty.
 */
import { Link } from 'react-router-dom'
import { AlarmClock, CalendarDays, Link2, Megaphone } from 'lucide-react'
import { usePublicAnnouncements, usePublicOfficialEvents, usePublicRegistrations } from '../../hooks/usePublicInfo'
import { useInfoStore, type FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { ANNOUNCEMENT_SOURCE_COUNT, facultyShortLabel, matchesFaculty } from '../../lib/info/faculty'
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
  ResourceGrid,
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

const DASHBOARD_ANNOUNCEMENTS = 6
const DASHBOARD_REGISTRATIONS = 4
const DASHBOARD_EVENTS = 4
const DASHBOARD_TOOL_IDS = ['usosweb', 'pegaz', 'poczta', 'sale', 'moj-plan', 'miejsca', 'znizki', 'asystent']

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-ink dark:text-brand-gold-bright">
            {firstName ? `Cześć, ${firstName}` : 'Dla Ciebie'}
          </p>
          <h1 className="mt-1 text-xl font-extrabold leading-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
            Wszystko, co ważne na UJ, w jednym miejscu
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {isAuthenticated
              ? 'Komunikaty, rejestracje i wydarzenia z oficjalnych źródeł UJ.'
              : 'Komunikaty, rejestracje i wydarzenia z oficjalnych źródeł UJ — bez zakładania konta.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FacultyPicker
            faculty={selected}
            source={faculty.source}
            persistent={faculty.persistent}
            onChange={faculty.setFaculty}
          />
          <CustomizeButton hidden={prefs.hiddenSections} />
        </div>
      </header>

      {!selected ? (
        <p className="rounded-2xl border border-brand-ink/15 bg-brand-ink/[0.03] px-4 py-3 text-sm text-zinc-700 dark:border-brand-gold-bright/20 dark:bg-brand-gold-bright/[0.04] dark:text-zinc-300">
          Pokazujemy informacje z całego UJ. Wybierz swój wydział, żeby zobaczyć jego komunikaty, rejestracje
          i sekcję „Ważne teraz".
        </p>
      ) : null}

      {selectedShort ? <PrioritySection items={priority} facultyLabel={selectedShort} now={now} /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {!hidden.has('announcements') ? (
          <InfoSection
            icon={Megaphone}
            title={selected ? 'Komunikaty z Twojego wydziału' : 'Najnowsze komunikaty wydziałów'}
            subtitle={
              selected
                ? `${selected} · ostatnie 30 dni`
                : `Z ${ANNOUNCEMENT_SOURCE_COUNT} oficjalnych stron wydziałów UJ · ostatnie 30 dni`
            }
            action={<SeeAll to="/komunikaty" label="Wszystkie komunikaty" />}
            busy={announcementsQ.isFetching}
          >
            {announcementsQ.isPending ? (
              <RowSkeletons count={4} />
            ) : announcementsQ.isError && announcements.length === 0 ? (
              <DomainError what="komunikaty" onRetry={() => void announcementsQ.refetch()} />
            ) : announcements.length === 0 ? (
              <DomainEmpty
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
            ) : (
              <ul className={`space-y-2.5 ${announcementsQ.isPlaceholderData ? 'opacity-60' : ''}`} role="list">
                {announcements.slice(0, DASHBOARD_ANNOUNCEMENTS).map((item) => (
                  <li key={item.id}>
                    <AnnouncementItem item={item} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </InfoSection>
        ) : null}

        <div className="flex min-w-0 flex-col gap-4">
          {!hidden.has('registrations') ? (
            <InfoSection
              icon={AlarmClock}
              title="Nadchodzące rejestracje"
              subtitle={selected ? `${selectedShort} · z katalogu USOSweb` : 'Z publicznego katalogu USOSweb'}
              action={<SeeAll to="/rejestracje" label="Wszystkie rejestracje" />}
              busy={registrationsQ.isFetching}
            >
              {registrationsQ.isPending ? (
                <RowSkeletons count={2} />
              ) : registrationsQ.isError ? (
                <DomainError what="rejestracje z USOSweb" onRetry={() => void registrationsQ.refetch()} />
              ) : latestRegistrationRun === null ? (
                <DomainEmpty>Dane o rejestracjach z USOSweb są chwilowo niedostępne.</DomainEmpty>
              ) : (
                <>
                  {registrationsStale ? (
                    <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      Dane z USOSweb mogą być nieaktualne — ostatnia aktualizacja była dawno. Sprawdź terminy w USOSweb.
                    </p>
                  ) : null}
                  {registrations.length === 0 ? (
                    <DomainEmpty
                      action={
                        selected && otherRegistrationsCount > 0 ? (
                          <Link to="/rejestracje" className={`${INFO_ACTION_LINK_CLS} -ml-2`}>
                            Zobacz {otherRegistrationsCount} w innych jednostkach UJ
                          </Link>
                        ) : undefined
                      }
                    >
                      {selected
                        ? `Brak trwających ani zapowiedzianych rejestracji dla ${selectedShort} w katalogu USOSweb.`
                        : 'Brak trwających ani zapowiedzianych rejestracji w katalogu USOSweb.'}
                    </DomainEmpty>
                  ) : (
                    <ul className="space-y-2.5" role="list">
                      {registrations.slice(0, DASHBOARD_REGISTRATIONS).map((item) => (
                        <li key={item.id}>
                          <RegistrationItem item={item} now={now} latestVerifiedAt={latestRegistrationRun} />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </InfoSection>
          ) : null}

          {!hidden.has('events') ? (
            <InfoSection
              icon={CalendarDays}
              title="Wydarzenia na UJ"
              subtitle="Ogólnouczelniane, z kalendarza uj.edu.pl"
              action={<SeeAll to="/wydarzenia" label="Wszystkie wydarzenia" />}
              busy={eventsQ.isFetching}
            >
              {eventsQ.isPending ? (
                <RowSkeletons count={2} />
              ) : eventsQ.isError ? (
                <DomainError what="wydarzenia" onRetry={() => void eventsQ.refetch()} />
              ) : eventsQ.data.freshness.latest === null ? (
                <DomainEmpty>Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.</DomainEmpty>
              ) : events.length === 0 ? (
                <DomainEmpty>Brak zapowiedzianych wydarzeń w kalendarzu UJ.</DomainEmpty>
              ) : (
                <ul className="space-y-2.5" role="list">
                  {events.slice(0, DASHBOARD_EVENTS).map((item) => (
                    <li key={item.id}>
                      <EventItem item={item} now={now} />
                    </li>
                  ))}
                </ul>
              )}
            </InfoSection>
          ) : null}
        </div>
      </div>

      <SavedSection items={saved} now={now} />

      {!hidden.has('tools') ? (
        <InfoSection
          icon={Link2}
          title="Niezbędnik studenta"
          action={<SeeAll to="/niezbednik" label="Wszystkie narzędzia" />}
        >
          <ResourceGrid resources={tools} isAuthenticated={isAuthenticated} />
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
