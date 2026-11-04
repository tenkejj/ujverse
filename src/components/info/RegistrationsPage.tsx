import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Bell, Building2 } from 'lucide-react'
import { FILTER_PILL } from '../../styles/mobile-theme'
import { usePublicRegistrations } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { canonicalDepartment, UJ_DEPARTMENTS } from '../../lib/departments'
import { facultyShortLabel, matchesFaculty, USOS_REGISTRATION_CATALOG_URL } from '../../lib/info/faculty'
import {
  activeRegistrationsSorted,
  isRegistrationDataStale,
  registrationTiming,
} from '../../lib/info/relevance'
import { formatFull, formatRelativePast, parseIsoDate } from '../../lib/info/time'
import type { InfoRegistration } from '../../lib/info/types'
import FacultyPicker from './FacultyPicker'
import { RegistrationItem } from './InfoItems'
import {
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  INFO_ACTION_LINK_CLS,
  InfoSection,
  PageIntro,
  RowSkeletons,
} from './infoUi'

type PhaseFilter = 'all' | 'open' | 'upcoming'

const PHASE_FILTERS: Array<{ id: PhaseFilter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'open', label: 'Trwają teraz' },
  { id: 'upcoming', label: 'Nadchodzące' },
]

const OTHER_UNITS = '__other__'

type Group = { key: string; title: string; items: InfoRegistration[] }

function groupByFaculty(items: InfoRegistration[]): Group[] {
  const map = new Map<string, InfoRegistration[]>()
  for (const item of items) {
    const key = canonicalDepartment(item.faculty) ?? OTHER_UNITS
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  const order = [...UJ_DEPARTMENTS, OTHER_UNITS] as string[]
  return [...map.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([key, list]) => ({
      key,
      title: key === OTHER_UNITS ? 'Jednostki ogólnouczelniane i inne' : key,
      items: list,
    }))
}

export default function RegistrationsPage({
  faculty,
  isAuthenticated,
}: {
  faculty: FacultyPreference
  isAuthenticated: boolean
}) {
  const now = useNow()
  const [phase, setPhase] = useState<PhaseFilter>('all')
  const [showOthers, setShowOthers] = useState(false)
  const selected = faculty.faculty
  const query = usePublicRegistrations()
  const latestRun = query.data?.freshness.latest ?? null
  const stale = query.isSuccess && isRegistrationDataStale(latestRun, now)

  const active = useMemo(() => activeRegistrationsSorted(query.data?.items ?? [], now), [query.data, now])
  const byPhase = active.filter((item) => phase === 'all' || registrationTiming(item, now).phase === phase)
  const mine = selected ? byPhase.filter((item) => matchesFaculty(item.faculty, selected)) : []
  const others = selected ? byPhase.filter((item) => !matchesFaculty(item.faculty, selected)) : byPhase
  const groups = groupByFaculty(others)
  const latestDate = parseIsoDate(latestRun)

  const renderList = (items: InfoRegistration[], showUnit = true) => (
    <ul className="space-y-2.5" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <RegistrationItem
            item={item}
            now={now}
            latestVerifiedAt={latestRun}
            variant="full"
            headingLevel="h4"
            showUnit={showUnit}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageIntro
        title="Rejestracje USOS"
        description="Trwające i nadchodzące rejestracje z publicznego katalogu USOSweb UJ. UJverse tylko je zbiera — zapisujesz się zawsze w USOSweb."
      >
        <FacultyPicker
          faculty={selected}
          source={faculty.source}
          persistent={faculty.persistent}
          onChange={faculty.setFaculty}
          className="lg:hidden"
        />
      </PageIntro>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etap rejestracji">
          {PHASE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={phase === filter.id}
              onClick={() => setPhase(filter.id)}
              className={`${FILTER_PILL.base} ${phase === filter.id ? FILTER_PILL.active : FILTER_PILL.inactive}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className={`text-xs ${stale ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400'}`} role="status">
          {latestDate ? (
            <>
              Katalog USOSweb sprawdzony{' '}
              <time dateTime={latestDate.toISOString()} title={formatFull(latestDate)}>
                {formatRelativePast(latestDate, now)}
              </time>
              {stale ? ' — dane mogą być nieaktualne' : ''}
            </>
          ) : query.isSuccess ? (
            'Brak informacji o ostatniej aktualizacji'
          ) : null}
        </p>
      </div>

      {query.isPending ? (
        <InfoSection icon={AlarmClock} title="Rejestracje" busy>
          <RowSkeletons count={4} />
        </InfoSection>
      ) : query.isError ? (
        <InfoSection icon={AlarmClock} title="Rejestracje">
          <DomainError what="rejestracje z USOSweb" onRetry={() => void query.refetch()} />
        </InfoSection>
      ) : latestRun === null ? (
        <InfoSection icon={AlarmClock} title="Rejestracje">
          <DomainEmpty>Dane o rejestracjach z USOSweb są chwilowo niedostępne.</DomainEmpty>
        </InfoSection>
      ) : (
        <>
          {selected ? (
            <InfoSection
              icon={AlarmClock}
              title={`Twój wydział: ${facultyShortLabel(selected) ?? selected}`}
              subtitle={selected}
              busy={query.isFetching}
            >
              {mine.length === 0 ? (
                <DomainEmpty>
                  Brak {phase === 'open' ? 'trwających' : phase === 'upcoming' ? 'nadchodzących' : 'trwających ani zapowiedzianych'} rejestracji
                  dla tego wydziału w katalogu USOSweb.
                </DomainEmpty>
              ) : (
                renderList(mine)
              )}
            </InfoSection>
          ) : null}

          {groups.length > 0 && (!selected || showOthers) ? (
            groups.map((group) => (
              <InfoSection key={group.key} icon={Building2} title={group.title}>
                {renderList(group.items)}
              </InfoSection>
            ))
          ) : null}

          {selected && others.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowOthers((v) => !v)}
              aria-expanded={showOthers}
              className={`${INFO_ACTION_LINK_CLS} self-start`}
            >
              {showOthers ? 'Ukryj inne jednostki UJ' : `Pokaż rejestracje w innych jednostkach UJ (${others.length})`}
            </button>
          ) : null}

          {!selected && byPhase.length === 0 ? (
            <InfoSection icon={AlarmClock} title="Rejestracje">
              <DomainEmpty>Brak rejestracji spełniających wybrane kryteria w katalogu USOSweb.</DomainEmpty>
            </InfoSection>
          ) : null}
        </>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 p-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        <p className="flex items-start gap-2">
          <Bell size={14} className="mt-0.5 shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
          <span>
            {isAuthenticated
              ? 'Chcesz przypomnienia przed startem tury albo wpisy dodane przez innych studentów?'
              : 'Przypomnienia przed startem tury i wpisy społeczności wymagają konta.'}{' '}
            <Link to="/usos" className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright">
              Alarmy rejestracji
            </Link>
          </span>
        </p>
        <p>
          Pełny, oficjalny katalog:{' '}
          <ExternalSourceLink href={USOS_REGISTRATION_CATALOG_URL}>Rejestracje w USOSweb</ExternalSourceLink>
        </p>
      </div>
    </div>
  )
}
