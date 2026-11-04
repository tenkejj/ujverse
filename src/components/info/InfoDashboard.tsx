/**
 * Strona startowa UJverse (`/`) — board informacyjny (nie lista / nie siatka tabel).
 */
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
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
import {
  BoardAnnouncements,
  BoardRail,
  BoardSpotlight,
} from './InfoBoard'
import {
  CustomizeButton,
  ResourceStrip,
  SavedSection,
  SourcesNote,
} from './InfoBlocks'
import { DomainEmpty, INFO_ACTION_LINK_CLS } from './infoUi'

const DASHBOARD_TOOL_IDS = ['usosweb', 'pegaz', 'poczta', 'sale', 'moj-plan', 'miejsca']

type Props = {
  faculty: FacultyPreference
  isAuthenticated: boolean
  firstName: string | null
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

  const announcements = sortAnnouncementsNewestFirst(announcementsQ.data?.items ?? []).slice(0, 3)
  const registrationsAll = registrationsQ.data?.items ?? []
  const latestRegistrationRun = registrationsQ.data?.freshness.latest ?? null
  const activeRegistrations = activeRegistrationsSorted(registrationsAll, now)
  const registrations = activeRegistrations.filter((reg) => matchesFaculty(reg.faculty, selected))
  const otherRegistrationsCount = activeRegistrations.length - registrations.length
  const events = upcomingEventsSorted(eventsQ.data?.items ?? [], now)
  const registrationsStale = registrationsQ.isSuccess && isRegistrationDataStale(latestRegistrationRun, now)

  const priority = buildPriorityItems({
    faculty: selected,
    announcements: sortAnnouncementsNewestFirst(announcementsQ.data?.items ?? []),
    registrations: registrationsAll,
    now,
    latestRegistrationVerifiedAt: latestRegistrationRun,
  })

  const tools = INFO_RESOURCES.filter((r) => DASHBOARD_TOOL_IDS.includes(r.id))
  const announcementsTitle = selected ? 'Komunikaty z Twojego wydziału' : 'Najnowsze komunikaty'

  const regsUnavailable = registrationsQ.isSuccess && latestRegistrationRun === null
  const eventsUnavailable = eventsQ.isSuccess && eventsQ.data.freshness.latest === null
  const showRegistrations = !hidden.has('registrations')
  const showEvents = !hidden.has('events')
  // Pusta szyna (brak dostępu anon) nie zabiera szerokości — komunikaty dostają pełny board.
  const railHasSignal =
    (showRegistrations &&
      (registrationsQ.isPending ||
        registrationsQ.isError ||
        (!regsUnavailable && registrations.length > 0) ||
        (!regsUnavailable && registrations.length === 0 && otherRegistrationsCount > 0))) ||
    (showEvents &&
      (eventsQ.isPending || eventsQ.isError || (!eventsUnavailable && events.length > 0)))
  const showRail = showRegistrations || showEvents
  // Nadal renderujemy cichy status „niedostępne”, ale w jednej wąskiej stopce pod boardem —
  // nie jako pustą kolumnę.
  const unavailableNotes: string[] = []
  if (showRegistrations && regsUnavailable) {
    unavailableNotes.push('Dane o rejestracjach z USOSweb są chwilowo niedostępne.')
  }
  if (showEvents && eventsUnavailable) {
    unavailableNotes.push('Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.')
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-4">
      <header className="flex flex-col gap-5 border-b border-zinc-200/80 pb-6 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-ink dark:text-brand-gold-bright">
            {firstName ? `Cześć, ${firstName}` : 'UJverse'}
          </p>
          <h1 className="mt-2 text-[1.65rem] font-extrabold leading-[1.15] tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
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
      </header>

      {selectedShort ? <BoardSpotlight items={priority} facultyLabel={selectedShort} now={now} /> : null}

      <div
        className={`grid items-start gap-10 ${
          showRail && railHasSignal ? 'xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]' : ''
        }`}
      >
        <div className="flex min-w-0 flex-col gap-10">
          {!hidden.has('announcements') ? (
            <BoardAnnouncements
              title={announcementsTitle}
              items={announcements}
              now={now}
              pending={announcementsQ.isPending}
              error={announcementsQ.isError}
              onRetry={() => void announcementsQ.refetch()}
              dimmed={announcementsQ.isPlaceholderData}
              empty={
                <DomainEmpty
                  tone="quiet"
                  action={
                    selected ? (
                      <button
                        type="button"
                        onClick={() => faculty.setFaculty(null)}
                        className={`${INFO_ACTION_LINK_CLS} -ml-2`}
                      >
                        Pokaż komunikaty z całego UJ
                      </button>
                    ) : undefined
                  }
                >
                  {selected
                    ? `Brak nowych komunikatów z wydziału ${selectedShort} w ostatnich 30 dniach.`
                    : 'Brak nowych komunikatów w ostatnich 30 dniach.'}
                </DomainEmpty>
              }
            />
          ) : null}

          {unavailableNotes.length > 0 && !railHasSignal ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
              {unavailableNotes.join(' ')}
            </p>
          ) : null}

          <SavedSection items={saved} now={now} />

          {!hidden.has('tools') ? (
            <section className="min-w-0" aria-labelledby="board-tools-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2
                  id="board-tools-heading"
                  className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400"
                >
                  <Link2 size={13} aria-hidden />
                  Niezbędnik studenta
                </h2>
                <Link to="/niezbednik" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie narzędzia">
                  Wszystkie →
                </Link>
              </div>
              <ResourceStrip resources={tools} isAuthenticated={isAuthenticated} />
            </section>
          ) : null}
        </div>

        {showRail && railHasSignal ? (
          <BoardRail
            registrations={registrations}
            events={events}
            now={now}
            latestRegistrationRun={latestRegistrationRun}
            registrationsPending={registrationsQ.isPending}
            registrationsError={registrationsQ.isError}
            registrationsUnavailable={regsUnavailable}
            registrationsStale={registrationsStale}
            onRetryRegistrations={() => void registrationsQ.refetch()}
            registrationsEmpty={
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
            }
            eventsPending={eventsQ.isPending}
            eventsError={eventsQ.isError}
            eventsUnavailable={eventsUnavailable}
            eventsEmpty={<DomainEmpty tone="quiet">Brak zapowiedzianych wydarzeń w kalendarzu UJ.</DomainEmpty>}
            onRetryEvents={() => void eventsQ.refetch()}
            hideRegistrations={!showRegistrations}
            hideEvents={!showEvents}
          />
        ) : null}
      </div>

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
