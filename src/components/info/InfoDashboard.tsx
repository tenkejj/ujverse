/**
 * Strona startowa UJverse (`/`) — landing z wyraźnym wyborem wydziału
 * i spokojnymi wejściami do hubów, zamiast gęstej listy treści.
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
  Megaphone,
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
import { EVENTS_HUB } from '../../styles/mobile-theme'
import FacultyPicker from './FacultyPicker'
import { AnnouncementHubCard, EventHubCard, RegistrationHubCard } from './InfoHubCards'
import { InfoHubSection, InfoHubSpotlight } from './InfoHubShell'
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

const DOORS: Array<{
  to: string
  label: string
  blurb: string
  icon: LucideIcon
}> = [
  { to: '/komunikaty', label: 'Komunikaty', blurb: 'Ogłoszenia z wydziałów', icon: Megaphone },
  { to: '/rejestracje', label: 'Rejestracje', blurb: 'Terminy z USOSweb', icon: AlarmClock },
  { to: '/wydarzenia', label: 'Wydarzenia', blurb: 'Kalendarz UJ', icon: CalendarDays },
  { to: '/niezbednik', label: 'Niezbędnik', blurb: 'USOS, PEGAZ, narzędzia', icon: BookOpen },
]

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
  const needsFaculty = !selected && faculty.source === 'none'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 pb-8 md:space-y-16">
      <header className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            {firstName ? (
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cześć, {firstName}</p>
            ) : null}
            <h1 className="mt-1 text-[1.85rem] font-extrabold leading-[1.15] tracking-tight text-zinc-900 sm:text-[2.15rem] dark:text-zinc-50">
              Wszystko, co ważne na UJ, w jednym miejscu
            </h1>
          </div>
          <CustomizeButton hidden={prefs.hiddenSections} />
        </div>

        <section aria-label="Wybór wydziału" className="space-y-3">
          <FacultyPicker
            faculty={selected}
            source={faculty.source}
            persistent={faculty.persistent}
            onChange={faculty.setFaculty}
            variant="hero"
          />
          {needsFaculty ? (
            <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
              Bez wyboru pokażemy cały UJ — wydział zawęża komunikaty i rejestracje.
            </p>
          ) : null}
        </section>

        <nav aria-label="Główne sekcje" className="grid gap-3 sm:grid-cols-2">
          {DOORS.map((door) => {
            const Icon = door.icon
            return (
              <Link
                key={door.to}
                to={door.to}
                className={`${EVENTS_HUB.hero.cardClass} group flex items-center gap-4 p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 ${FOCUS_RING}`}
              >
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-ink/[0.07] text-brand-ink dark:bg-brand-gold-bright/12 dark:text-brand-gold-bright"
                  aria-hidden
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {door.label}
                    <ArrowUpRight
                      size={15}
                      className="opacity-40 transition-opacity group-hover:opacity-70"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{door.blurb}</span>
                </span>
              </Link>
            )
          })}
        </nav>
      </header>

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
          {announcements.length > 0 ? (
            <div className="pt-1">
              <Link to="/komunikaty" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie komunikaty">
                Wszystkie komunikaty →
              </Link>
            </div>
          ) : null}
        </InfoHubSection>
      ) : null}

      {showRegistrations || showEvents ? (
        <div className="grid items-start gap-12 md:grid-cols-2 md:gap-10">
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
                    <div className="pt-1">
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
                    <ul className="grid gap-4" role="list">
                      {events.map((item) => (
                        <li key={item.id} className="min-w-0">
                          <EventHubCard item={item} now={now} />
                        </li>
                      ))}
                    </ul>
                    <div className="pt-1">
                      <Link to="/wydarzenia" className={INFO_ACTION_LINK_CLS} aria-label="Wszystkie wydarzenia">
                        Wszystkie wydarzenia →
                      </Link>
                    </div>
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
          <div className="pt-1">
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
    </div>
  )
}
