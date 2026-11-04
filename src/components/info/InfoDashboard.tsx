/**
 * Strona startowa UJverse (`/`) — spokojny przegląd, nie gęsta lista.
 * Mało kart, krótkie teksty, wyraźne strefy z oddechem.
 */
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Library,
  Lock,
  Mail,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
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
  type PriorityItem,
} from '../../lib/info/relevance'
import { INFO_RESOURCES, type InfoResourceIcon } from '../../lib/info/resources'
import { formatDurationShort } from '../../lib/info/time'
import FacultyPicker from './FacultyPicker'
import { AnnouncementHubCard, EventHubCard, RegistrationHubCard } from './InfoHubCards'
import {
  InfoHubRailStats,
  InfoHubRailStatus,
  InfoHubSection,
  InfoHubShell,
  InfoHubSpotlight,
  InfoHubTitle,
} from './InfoHubShell'
import { CustomizeButton, SavedSection, SourcesNote } from './InfoBlocks'
import {
  AnnouncementStatusPill,
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  FOCUS_RING,
  INFO_ACTION_LINK_CLS,
  RowSkeletons,
} from './infoUi'

const DASHBOARD_TOOL_IDS = ['usosweb', 'pegaz', 'poczta', 'sale', 'moj-plan', 'miejsca']

const TOOL_ICONS: Record<InfoResourceIcon, LucideIcon> = {
  usos: GraduationCap,
  pegaz: BookOpen,
  mail: Mail,
  registrations: AlarmClock,
  calendar: CalendarDays,
  rooms: DoorOpen,
  plan: ClipboardList,
  spots: Library,
  discounts: Tag,
  assistant: Sparkles,
}

type Props = {
  faculty: FacultyPreference
  isAuthenticated: boolean
  firstName: string | null
}

function priorityEyebrow(entry: PriorityItem, now: Date): string {
  switch (entry.reason) {
    case 'registration-closing': {
      const left = Date.parse(entry.item.closesAt ?? entry.item.opensAt) - now.getTime()
      return `Rejestracja zamyka się za ${formatDurationShort(left)}`
    }
    case 'registration-opening': {
      const until = Date.parse(entry.item.opensAt) - now.getTime()
      return `Rejestracja otwiera się za ${formatDurationShort(until)}`
    }
    case 'cancelled':
      return 'Odwołane zajęcia'
    case 'remote':
      return 'Zajęcia zdalne'
  }
}

function SectionMore({ to, label }: { to: string; label: string }) {
  return (
    <div className="pt-1">
      <Link to={to} className={INFO_ACTION_LINK_CLS} aria-label={label}>
        {label} →
      </Link>
    </div>
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

  const announcementsAll = sortAnnouncementsNewestFirst(announcementsQ.data?.items ?? [])
  const announcements = announcementsAll.slice(0, 3)
  const registrationsAll = registrationsQ.data?.items ?? []
  const latestRegistrationRun = registrationsQ.data?.freshness.latest ?? null
  const activeRegistrations = activeRegistrationsSorted(registrationsAll, now)
  const facultyRegs = activeRegistrations.filter((reg) => matchesFaculty(reg.faculty, selected))
  const registrations = facultyRegs.slice(0, 2)
  const otherRegistrationsCount = activeRegistrations.length - facultyRegs.length
  const events = upcomingEventsSorted(eventsQ.data?.items ?? [], now).slice(0, 2)
  const registrationsStale = registrationsQ.isSuccess && isRegistrationDataStale(latestRegistrationRun, now)

  const priority = buildPriorityItems({
    faculty: selected,
    announcements: announcementsAll,
    registrations: registrationsAll,
    now,
    latestRegistrationVerifiedAt: latestRegistrationRun,
  })

  const tools = INFO_RESOURCES.filter((r) => DASHBOARD_TOOL_IDS.includes(r.id))
  const announcementsTitle = selected ? 'Komunikaty z Twojego wydziału' : 'Najnowsze komunikaty'

  const regsUnavailable = registrationsQ.isFetched && !registrationsQ.isError && latestRegistrationRun === null
  const eventsUnavailable =
    eventsQ.isFetched && !eventsQ.isError && (eventsQ.data?.freshness.latest ?? null) === null
  const showRegistrations = !hidden.has('registrations')
  const showEvents = !hidden.has('events')
  const showAnnouncements = !hidden.has('announcements')
  const showTools = !hidden.has('tools')

  const heroPriority = selectedShort && priority.length > 0 ? priority[0] : null
  const live =
    (announcementsQ.isSuccess && !announcementsQ.isError) ||
    (registrationsQ.isSuccess && !registrationsQ.isError) ||
    (eventsQ.isSuccess && !eventsQ.isError)

  return (
    <InfoHubShell
      contentClassName="min-w-0 space-y-12 md:space-y-14"
      frameClassName="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12 2xl:grid-cols-[minmax(0,1fr)_300px]"
      rail={
        <>
          <InfoHubRailStatus
            live={live}
            label={live ? 'Wydziały · USOSweb · uj.edu.pl' : 'Część źródeł niedostępna'}
          />
          <InfoHubRailStats
            stats={[
              { value: announcementsAll.length, label: 'Komunikaty' },
              {
                value: regsUnavailable ? '—' : facultyRegs.length,
                label: 'Rejestracje',
              },
              {
                value: eventsUnavailable ? '—' : eventsQ.data?.items.length ?? 0,
                label: 'Wydarzenia',
              },
            ]}
          />
        </>
      }
    >
      <InfoHubTitle
        title="Wszystko, co ważne na UJ, w jednym miejscu"
        description={firstName ? `Cześć, ${firstName}` : undefined}
        actions={
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
        }
      />

      {heroPriority ? (
        <section aria-labelledby="board-priority-heading" className="space-y-4">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2
              id="board-priority-heading"
              className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-ink dark:text-brand-gold-bright"
            >
              Ważne teraz
            </h2>
            <span className="text-[11px] font-medium text-zinc-500">{selectedShort}</span>
          </div>
          <InfoHubSpotlight
            eyebrow={priorityEyebrow(heroPriority, now)}
            title={heroPriority.item.title}
            meta={
              heroPriority.kind === 'announcement' ? (
                <AnnouncementStatusPill status={heroPriority.item.status} />
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {[heroPriority.item.unitName, heroPriority.item.facultyShort].filter(Boolean).join(' · ')}
                </p>
              )
            }
            actions={
              <ExternalSourceLink
                href={heroPriority.kind === 'registration' ? heroPriority.item.url : heroPriority.item.sourceUrl}
              >
                {heroPriority.kind === 'registration' ? 'Otwórz w USOSweb' : 'Sprawdź w źródle'}
              </ExternalSourceLink>
            }
          />
        </section>
      ) : null}

      {showAnnouncements ? (
        <InfoHubSection title={announcementsTitle} count={announcements.length || undefined}>
          {announcementsQ.isPending ? (
            <RowSkeletons count={3} />
          ) : announcementsQ.isError && announcements.length === 0 ? (
            <DomainError what="komunikaty" onRetry={() => void announcementsQ.refetch()} />
          ) : announcements.length === 0 ? (
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
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="list">
              {announcements.map((item) => (
                <li key={item.id} className="min-w-0">
                  <AnnouncementHubCard item={item} now={now} compact />
                </li>
              ))}
            </ul>
          )}
          {announcements.length > 0 ? <SectionMore to="/komunikaty" label="Wszystkie komunikaty" /> : null}
        </InfoHubSection>
      ) : null}

      {showRegistrations || showEvents ? (
        <div className="grid items-start gap-12 xl:grid-cols-2 xl:gap-14">
          {showRegistrations ? (
            regsUnavailable ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
                Dane o rejestracjach z USOSweb są chwilowo niedostępne.
              </p>
            ) : (
              <InfoHubSection title="Nadchodzące rejestracje" count={registrations.length || undefined}>
                {registrationsQ.isPending ? (
                  <RowSkeletons count={2} />
                ) : registrationsQ.isError ? (
                  <DomainError what="rejestracje z USOSweb" onRetry={() => void registrationsQ.refetch()} />
                ) : registrations.length === 0 ? (
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
                ) : (
                  <>
                    {registrationsStale ? (
                      <p
                        role="status"
                        className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                      >
                        Dane z USOSweb mogą być nieaktualne — sprawdź terminy w źródle.
                      </p>
                    ) : null}
                    <ul className="grid gap-4" role="list">
                      {registrations.map((item) => (
                        <li key={item.id} className="min-w-0">
                          <RegistrationHubCard
                            item={item}
                            now={now}
                            latestVerifiedAt={latestRegistrationRun}
                            compact
                          />
                        </li>
                      ))}
                    </ul>
                    <SectionMore to="/rejestracje" label="Wszystkie rejestracje" />
                  </>
                )}
              </InfoHubSection>
            )
          ) : null}

          {showEvents ? (
            eventsUnavailable ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
                Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.
              </p>
            ) : (
              <InfoHubSection title="Wydarzenia na UJ" count={events.length || undefined}>
                {eventsQ.isPending ? (
                  <RowSkeletons count={2} />
                ) : eventsQ.isError ? (
                  <DomainError what="wydarzenia" onRetry={() => void eventsQ.refetch()} />
                ) : events.length === 0 ? (
                  <DomainEmpty tone="quiet">Brak zapowiedzianych wydarzeń w kalendarzu UJ.</DomainEmpty>
                ) : (
                  <>
                    <ul className="grid gap-4" role="list">
                      {events.map((item) => (
                        <li key={item.id} className="min-w-0">
                          <EventHubCard item={item} now={now} />
                        </li>
                      ))}
                    </ul>
                    <SectionMore to="/wydarzenia" label="Wszystkie wydarzenia" />
                  </>
                )}
              </InfoHubSection>
            )
          ) : null}
        </div>
      ) : null}

      {showTools ? (
        <InfoHubSection title="Niezbędnik">
          <ul className="flex flex-wrap gap-2.5" role="list">
            {tools.map((resource) => {
              const Glyph = TOOL_ICONS[resource.icon]
              const locked = resource.requiresAccount && !isAuthenticated
              const cls = `inline-flex min-h-11 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/80 px-3.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/[0.06] ${FOCUS_RING}`
              const body = (
                <>
                  <Glyph size={15} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
                  <span>{resource.label}</span>
                  {resource.external ? <ArrowUpRight size={13} className="opacity-45" aria-hidden /> : null}
                  {locked ? <Lock size={12} className="opacity-50" aria-hidden /> : null}
                </>
              )
              return (
                <li key={resource.id}>
                  {resource.external ? (
                    <a href={resource.href} target="_blank" rel="noopener noreferrer" className={cls}>
                      {body}
                      <span className="sr-only">(otwiera się w nowej karcie)</span>
                    </a>
                  ) : (
                    <Link to={resource.href} className={cls}>
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          <SectionMore to="/niezbednik" label="Cały niezbędnik" />
        </InfoHubSection>
      ) : null}

      <SavedSection items={saved} now={now} />

      <SourcesNote
        announcementsLatest={announcementsQ.data?.freshness.latest ?? null}
        registrationsLatest={latestRegistrationRun}
        registrationsStale={registrationsStale}
        eventsLatest={eventsQ.data?.freshness.latest ?? null}
        now={now}
      />
    </InfoHubShell>
  )
}
