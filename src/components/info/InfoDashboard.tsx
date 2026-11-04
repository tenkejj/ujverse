/**
 * Strona startowa UJverse (`/`) — hub overview w tym samym języku co
 * Komunikaty / Rejestracje / Wydarzenia / Niezbędnik.
 */
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  Archive,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  Library,
  Mail,
  Radio,
  Sparkles,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react'
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
  type PriorityItem,
} from '../../lib/info/relevance'
import { INFO_RESOURCES, type InfoResourceIcon } from '../../lib/info/resources'
import { formatDurationShort, formatRelativePast, parseIsoDate } from '../../lib/info/time'
import { theme } from '../../styles/theme'
import { EVENTS_TOOLBAR, FILTER_PILL } from '../../styles/mobile-theme'
import FacultyPicker from './FacultyPicker'
import { AnnouncementHubCard, EventHubCard, RegistrationHubCard, ResourceHubCard } from './InfoHubCards'
import {
  InfoHubCardGrid,
  InfoHubRailPanel,
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

const JUMPS = [
  { to: '/komunikaty', label: 'Komunikaty' },
  { to: '/rejestracje', label: 'Rejestracje' },
  { to: '/wydarzenia', label: 'Wydarzenia' },
  { to: '/niezbednik', label: 'Niezbędnik' },
] as const

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
  const announcements = announcementsAll.slice(0, 6)
  const registrationsAll = registrationsQ.data?.items ?? []
  const latestRegistrationRun = registrationsQ.data?.freshness.latest ?? null
  const activeRegistrations = activeRegistrationsSorted(registrationsAll, now)
  const registrations = activeRegistrations
    .filter((reg) => matchesFaculty(reg.faculty, selected))
    .slice(0, 4)
  const otherRegistrationsCount = activeRegistrations.length - registrations.length
  const events = upcomingEventsSorted(eventsQ.data?.items ?? [], now).slice(0, 4)
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
  const announcementsHint = selected
    ? `Ostatnie 30 dni · ${selectedShort}`
    : `Z ${ANNOUNCEMENT_SOURCE_COUNT} stron wydziałów · ostatnie 30 dni`

  const regsUnavailable = registrationsQ.isFetched && !registrationsQ.isError && latestRegistrationRun === null
  const eventsUnavailable =
    eventsQ.isFetched && !eventsQ.isError && (eventsQ.data?.freshness.latest ?? null) === null
  const showRegistrations = !hidden.has('registrations')
  const showEvents = !hidden.has('events')
  const showAnnouncements = !hidden.has('announcements')
  const showTools = !hidden.has('tools')

  const heroPriority = selectedShort && priority.length > 0 ? priority[0] : null
  const heroAnnouncement =
    !heroPriority && announcements.length > 0
      ? announcements.find((a) => a.status === 'cancelled' || a.status === 'remote') ?? announcements[0]
      : null
  const heroAdded = heroAnnouncement ? parseIsoDate(heroAnnouncement.addedAt) : null
  const announcementGrid = heroAnnouncement
    ? announcements.filter((item) => item.id !== heroAnnouncement.id)
    : announcements

  const live =
    (announcementsQ.isSuccess && !announcementsQ.isError) ||
    (registrationsQ.isSuccess && !registrationsQ.isError) ||
    (eventsQ.isSuccess && !eventsQ.isError)

  return (
    <InfoHubShell
      rail={
        <>
          <InfoHubRailStatus
            live={live}
            label={
              live
                ? `Źródła: wydziały · USOSweb · uj.edu.pl`
                : 'Część źródeł jest niedostępna'
            }
          />
          <InfoHubRailStats
            stats={[
              { value: announcementsAll.length, label: 'Komunikaty' },
              {
                value: regsUnavailable ? '—' : activeRegistrations.filter((r) => matchesFaculty(r.faculty, selected)).length,
                label: 'Rejestracje',
              },
              { value: eventsUnavailable ? '—' : eventsQ.data?.items.length ?? 0, label: 'Wydarzenia' },
            ]}
          />
          <InfoHubRailPanel title="Skróty" icon={Zap}>
            <div className="flex flex-col gap-1">
              {JUMPS.map((jump) => (
                <Link
                  key={jump.to}
                  to={jump.to}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.05] ${FOCUS_RING}`}
                >
                  {jump.label}
                  <ArrowUpRight size={14} className="opacity-50" aria-hidden />
                </Link>
              ))}
            </div>
          </InfoHubRailPanel>
        </>
      }
    >
      <InfoHubTitle
        title="Wszystko, co ważne na UJ, w jednym miejscu"
        description={
          firstName
            ? `Cześć, ${firstName}. Komunikaty, rejestracje USOS, wydarzenia i niezbędne serwisy — w jednym hubie.`
            : 'Komunikaty, rejestracje USOS, wydarzenia i niezbędne serwisy — w jednym hubie.'
        }
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Szybkie przejścia" className="flex flex-wrap gap-2">
          {JUMPS.map((jump) => (
            <Link
              key={jump.to}
              to={jump.to}
              className={`${FILTER_PILL.base} ${FILTER_PILL.inactive} ${FOCUS_RING}`}
            >
              {jump.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <span className={EVENTS_TOOLBAR.liveBadge} role="status" aria-label="Źródła informacyjne">
            {live ? (
              <>
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <Radio size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Live
              </>
            ) : (
              <>
                <Archive size={12} className="shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
                Offline
              </>
            )}
          </span>
          <Link to="/szukaj" className={`${theme.button.primary} !min-h-9 !rounded-full !px-3 !text-xs`}>
            Wyszukiwarka
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
      </div>

      {heroPriority ? (
        <section aria-labelledby="board-priority-heading" className="space-y-3">
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
      ) : heroAnnouncement ? (
        <InfoHubSpotlight
          eyebrow={
            heroAnnouncement.status === 'cancelled'
              ? 'Odwołane zajęcia'
              : heroAnnouncement.status === 'remote'
                ? 'Zajęcia zdalne'
                : 'Najnowszy komunikat'
          }
          title={heroAnnouncement.title}
          meta={
            <>
              <div className="flex flex-wrap items-center gap-2">
                <AnnouncementStatusPill status={heroAnnouncement.status} />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {[heroAnnouncement.facultyShort, heroAnnouncement.sourceLabel].filter(Boolean).join(' · ')}
                </span>
              </div>
              {heroAdded ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <time dateTime={heroAdded.toISOString()} title="Dodano do UJverse">
                    dodano {formatRelativePast(heroAdded, now)}
                  </time>
                </p>
              ) : null}
            </>
          }
          actions={
            <ExternalSourceLink href={heroAnnouncement.sourceUrl}>
              {heroAnnouncement.sourceIsListing ? 'Lista komunikatów wydziału' : 'Sprawdź w źródle'}
            </ExternalSourceLink>
          }
        />
      ) : null}

      {showAnnouncements ? (
        <InfoHubSection title={announcementsTitle} count={announcements.length || undefined}>
          <p className="-mt-1 mb-1 px-1 text-xs text-zinc-500 dark:text-zinc-400">{announcementsHint}</p>
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
          ) : announcementGrid.length > 0 ? (
            <InfoHubCardGrid>
              {announcementGrid.map((item) => (
                <li key={item.id} className="min-w-0">
                  <AnnouncementHubCard item={item} now={now} />
                </li>
              ))}
            </InfoHubCardGrid>
          ) : null}
          {announcements.length > 0 ? (
            <div className="px-1">
              <Link to="/komunikaty" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie komunikaty">
                Wszystkie komunikaty →
              </Link>
            </div>
          ) : null}
        </InfoHubSection>
      ) : null}

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
                <InfoHubCardGrid>
                  {registrations.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <RegistrationHubCard item={item} now={now} latestVerifiedAt={latestRegistrationRun} />
                    </li>
                  ))}
                </InfoHubCardGrid>
                <div className="px-1">
                  <Link to="/rejestracje" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie rejestracje">
                    Wszystkie rejestracje →
                  </Link>
                </div>
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
                <InfoHubCardGrid>
                  {events.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <EventHubCard item={item} now={now} />
                    </li>
                  ))}
                </InfoHubCardGrid>
                <div className="px-1">
                  <Link to="/wydarzenia" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie wydarzenia">
                    Wszystkie wydarzenia →
                  </Link>
                </div>
              </>
            )}
          </InfoHubSection>
        )
      ) : null}

      {showTools ? (
        <InfoHubSection title="Niezbędnik studenta" count={tools.length}>
          <InfoHubCardGrid>
            {tools.map((resource) => (
              <li key={resource.id} className="min-w-0">
                <ResourceHubCard
                  resource={resource}
                  isAuthenticated={isAuthenticated}
                  icon={TOOL_ICONS[resource.icon]}
                />
              </li>
            ))}
          </InfoHubCardGrid>
          <div className="px-1">
            <Link to="/niezbednik" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie narzędzia">
              Cały niezbędnik →
            </Link>
          </div>
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
