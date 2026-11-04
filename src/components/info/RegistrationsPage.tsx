import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { usePublicRegistrations } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { facultyShortLabel, matchesFaculty, USOS_REGISTRATION_CATALOG_URL } from '../../lib/info/faculty'
import {
  activeRegistrationsSorted,
  canShowCountdown,
  isRegistrationDataStale,
  registrationTiming,
  type RegistrationTiming,
} from '../../lib/info/relevance'
import type { InfoRegistration } from '../../lib/info/types'
import { formatDateTime, formatDurationShort, formatFull, formatRelativePast, parseIsoDate } from '../../lib/info/time'
import { theme } from '../../styles/theme'
import FacultyPicker from './FacultyPicker'
import { RegistrationHubCard } from './InfoHubCards'
import {
  InfoHubCardGrid,
  InfoHubRailFilters,
  InfoHubRailStats,
  InfoHubRailStatus,
  InfoHubSection,
  InfoHubShell,
  InfoHubSpotlight,
  InfoHubTitle,
  InfoHubToolbar,
} from './InfoHubShell'
import {
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  INFO_ACTION_LINK_CLS,
  RowSkeletons,
} from './infoUi'

type PhaseFilter = 'all' | 'open' | 'upcoming'

const PHASE_FILTERS: Array<{ id: PhaseFilter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'open', label: 'Trwają teraz' },
  { id: 'upcoming', label: 'Nadchodzące' },
]

export default function RegistrationsPage({
  faculty,
  isAuthenticated,
}: {
  faculty: FacultyPreference
  isAuthenticated: boolean
}) {
  const now = useNow()
  const [phase, setPhase] = useState<PhaseFilter>('all')
  const selected = faculty.faculty
  const query = usePublicRegistrations()
  const latestRun = query.data?.freshness.latest ?? null
  const stale = query.isSuccess && isRegistrationDataStale(latestRun, now)
  const latestDate = parseIsoDate(latestRun)

  const active = useMemo(() => activeRegistrationsSorted(query.data?.items ?? [], now), [query.data, now])
  const scoped = selected ? active.filter((item) => matchesFaculty(item.faculty, selected)) : active
  const othersCount = selected ? active.length - scoped.length : 0

  const byPhase = scoped.filter((item) => phase === 'all' || registrationTiming(item, now).phase === phase)
  const openCount = scoped.filter((item) => registrationTiming(item, now).phase === 'open').length
  const upcomingCount = scoped.filter((item) => registrationTiming(item, now).phase === 'upcoming').length

  const filters = PHASE_FILTERS.map((f) => ({
    key: f.id,
    label: f.label,
    count: f.id === 'all' ? scoped.length : f.id === 'open' ? openCount : upcomingCount,
  }))

  const showSpotlight = phase === 'all' && byPhase.length > 0
  const hero = byPhase[0] ?? null
  const gridItems = showSpotlight && hero ? byPhase.filter((item) => item.id !== hero.id) : byPhase
  const short = selected ? facultyShortLabel(selected) ?? selected : null

  const heroTiming = hero ? registrationTiming(hero, now) : null
  const heroCountdown =
    hero && heroTiming ? formatHeroCountdown(hero, heroTiming, now, latestRun) : null

  return (
    <InfoHubShell
      rail={
        <>
          <InfoHubRailStatus
            live={Boolean(latestRun) && !stale}
            label={
              !latestRun
                ? 'Dane chwilowo niedostępne'
                : stale
                  ? 'Katalog może być nieaktualny'
                  : latestDate
                    ? `USOSweb · ${formatRelativePast(latestDate, now)}`
                    : 'Katalog USOSweb'
            }
          />
          <InfoHubRailStats
            stats={[
              { value: scoped.length, label: short ? short : 'Aktywne' },
              { value: openCount, label: 'Trwają' },
              { value: upcomingCount, label: 'Wkrótce' },
            ]}
          />
          <InfoHubRailFilters filters={filters} activeKey={phase} onFilterChange={(k) => setPhase(k as PhaseFilter)} />
          <div className="rounded-2xl border border-zinc-200/70 bg-white/75 p-4 text-xs text-zinc-600 backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-950/45 dark:text-zinc-400">
            <p className="flex items-start gap-2">
              <Bell size={14} className="mt-0.5 shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
              <span>
                {isAuthenticated ? 'Alarmy i wpisy społeczności:' : 'Przypomnienia wymagają konta:'}{' '}
                <Link to="/usos" className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright">
                  Alarmy rejestracji
                </Link>
              </span>
            </p>
          </div>
        </>
      }
    >
      <InfoHubTitle
        title="Rejestracje USOS"
        description="Trwające i nadchodzące tury z publicznego katalogu USOSweb. Zapisujesz się zawsze w USOSweb."
        actions={
          <FacultyPicker
            faculty={selected}
            source={faculty.source}
            persistent={faculty.persistent}
            onChange={faculty.setFaculty}
            className="lg:hidden"
          />
        }
      />

      <InfoHubToolbar
        filters={filters}
        activeKey={phase}
        onFilterChange={(k) => setPhase(k as PhaseFilter)}
        live={{
          on: Boolean(latestRun) && !stale,
          label: latestDate ? `Sprawdzono ${formatFull(latestDate)}` : 'USOSweb',
        }}
        trailing={
          <a
            href={USOS_REGISTRATION_CATALOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${theme.button.primary} min-h-9 rounded-full px-3 text-xs`}
          >
            Katalog USOSweb
          </a>
        }
      />

      {query.isPending ? (
        <RowSkeletons count={4} />
      ) : query.isError ? (
        <DomainError what="rejestracje z USOSweb" onRetry={() => void query.refetch()} />
      ) : latestRun === null ? (
        <DomainEmpty>Dane o rejestracjach z USOSweb są chwilowo niedostępne.</DomainEmpty>
      ) : byPhase.length === 0 ? (
        <DomainEmpty
          action={
            selected && othersCount > 0 ? (
              <button type="button" onClick={() => faculty.setFaculty(null)} className={`${INFO_ACTION_LINK_CLS} -ml-2`}>
                Pokaż cały UJ ({othersCount} poza {short})
              </button>
            ) : undefined
          }
        >
          {selected
            ? `Brak ${phase === 'open' ? 'trwających' : phase === 'upcoming' ? 'nadchodzących' : 'aktywnych'} rejestracji dla ${short}.`
            : 'Brak rejestracji spełniających wybrane kryteria.'}
        </DomainEmpty>
      ) : (
        <>
          {showSpotlight && hero && heroTiming ? (
            <InfoHubSpotlight
              eyebrow={heroTiming.phase === 'open' ? 'Trwa rejestracja' : 'Nadchodząca rejestracja'}
              title={hero.title}
              meta={
                <>
                  <p>{[hero.unitName, hero.facultyShort].filter(Boolean).join(' · ') || 'USOSweb'}</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                    {heroCountdown ??
                      (heroTiming.phase === 'open' && hero.closesAt
                        ? `Do ${formatDateTime(new Date(hero.closesAt), now)}`
                        : `Od ${formatDateTime(new Date(hero.opensAt), now)}`)}
                  </p>
                </>
              }
              actions={<ExternalSourceLink href={hero.url}>Otwórz w USOSweb</ExternalSourceLink>}
            />
          ) : null}

          {gridItems.length > 0 ? (
            <InfoHubSection title={short ? `Rejestracje · ${short}` : 'Katalog USOSweb'} count={gridItems.length}>
              <InfoHubCardGrid>
                {gridItems.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <RegistrationHubCard item={item} now={now} latestVerifiedAt={latestRun} />
                  </li>
                ))}
              </InfoHubCardGrid>
            </InfoHubSection>
          ) : null}

          {selected && othersCount > 0 ? (
            <button type="button" onClick={() => faculty.setFaculty(null)} className={`${INFO_ACTION_LINK_CLS} self-start`}>
              Pokaż też {othersCount} rejestracji w innych jednostkach UJ
            </button>
          ) : null}
        </>
      )}
    </InfoHubShell>
  )
}

function formatHeroCountdown(
  item: InfoRegistration,
  timing: RegistrationTiming,
  now: Date,
  latestVerifiedAt: string | null,
): string | null {
  if (!canShowCountdown(item, timing, now, latestVerifiedAt)) return null
  if (timing.phase === 'open' && timing.msUntilClose != null) {
    return `Zamyka się za ${formatDurationShort(timing.msUntilClose)}`
  }
  if (timing.phase === 'upcoming') {
    return `Otwiera się za ${formatDurationShort(timing.msUntilOpen)}`
  }
  return null
}
