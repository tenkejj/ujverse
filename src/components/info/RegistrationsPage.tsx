import { Link, useSearchParams } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { usePublicRegistrations } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import {
  facultyShortLabel,
  matchesFaculty,
  USOS_REGISTRATION_CATALOG_URL,
} from '../../lib/info/faculty'
import {
  activeRegistrationsSorted,
  isRegistrationDataStale,
  registrationTiming,
} from '../../lib/info/relevance'
import {
  formatFull,
  formatRelativePast,
  parseIsoDate,
} from '../../lib/info/time'
import { RegistrationHubCard } from './InfoHubCards'
import {
  InfoHubCardGrid,
  InfoHubSection,
  InfoHubShell,
  InfoHubTitle,
  InfoHubToolbar,
} from './InfoHubShell'
import { DomainEmpty, DomainError, RowSkeletons } from './infoUi'

export default function RegistrationsPage({
  faculty,
  isAuthenticated,
}: {
  faculty: FacultyPreference
  isAuthenticated: boolean
}) {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const rawPhase = params.get('phase')
  const phase =
    rawPhase === 'open' || rawPhase === 'upcoming' ? rawPhase : 'all'
  const query = usePublicRegistrations()
  const latestRun = query.data?.freshness.latest ?? null
  const stale = query.isSuccess && isRegistrationDataStale(latestRun, now)
  const latestDate = parseIsoDate(latestRun)
  const active = activeRegistrationsSorted(query.data?.items ?? [], now)
  const scoped = active.filter((item) =>
    matchesFaculty(item.faculty, faculty.faculty),
  )
  const filtered = scoped.filter(
    (item) => phase === 'all' || registrationTiming(item, now).phase === phase,
  )
  const short = faculty.faculty
    ? (facultyShortLabel(faculty.faculty) ?? faculty.faculty)
    : null
  const filters = [
    { key: 'all', label: 'Wszystkie', count: scoped.length },
    {
      key: 'open',
      label: 'Trwają teraz',
      count: scoped.filter((i) => registrationTiming(i, now).phase === 'open')
        .length,
    },
    {
      key: 'upcoming',
      label: 'Nadchodzące',
      count: scoped.filter(
        (i) => registrationTiming(i, now).phase === 'upcoming',
      ).length,
    },
  ]
  return (
    <InfoHubShell>
      <InfoHubTitle
        title="Rejestracje USOS"
        description="Sprawdź terminy. Zapisz się w USOSweb."

      />
      <InfoHubToolbar
        filters={filters}
        activeKey={phase}
        onFilterChange={(value) =>
          setParams((previous) => {
            const next = new URLSearchParams(previous)
            if (value === 'all') next.delete('phase')
            else next.set('phase', value)
            return next
          })
        }
        trailing={
          <a
            className="campus-text-link"
            href={USOS_REGISTRATION_CATALOG_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Katalog USOSweb <span className="sr-only">(nowa karta)</span>
          </a>
        }
      />
      {stale && latestRun ? (
        <p className="campus-stale-note">
          Katalog może być nieaktualny. Przed zapisami potwierdź termin w
          USOSweb.
        </p>
      ) : null}
      <InfoHubSection
        title={short ? `Twój wydział: ${short}` : 'Wszystkie jednostki UJ'}
        count={filtered.length}
      >
        {query.isPending ? (
          <RowSkeletons count={4} variant="feed" />
        ) : query.isError ? (
          <DomainError
            what="rejestracje z USOSweb"
            onRetry={() => void query.refetch()}
          />
        ) : !latestRun ? (
          <DomainEmpty>
            Dane o rejestracjach z USOSweb są chwilowo niedostępne.
          </DomainEmpty>
        ) : !filtered.length ? (
          <DomainEmpty
            action={
              short && active.length > scoped.length ? (
                <button
                  type="button"
                  className="campus-text-link"
                  onClick={() => faculty.setFaculty(null)}
                >
                  Pokaż też rejestracje z innych jednostek UJ
                </button>
              ) : phase !== 'all' ? (
                <button
                  type="button"
                  className="campus-text-link"
                  onClick={() => setParams({})}
                >
                  Pokaż wszystkie fazy rejestracji
                </button>
              ) : undefined
            }
          >
            Brak rejestracji spełniających wybrane kryteria.
          </DomainEmpty>
        ) : (
          <InfoHubCardGrid layout="open">
            {filtered.map((item) => (
              <li key={item.id}>
                <RegistrationHubCard
                  item={item}
                  now={now}
                  latestVerifiedAt={latestRun}
                />
              </li>
            ))}
          </InfoHubCardGrid>
        )}
      </InfoHubSection>
      <div className="campus-page-note">
        <p>
          <Bell size={15} aria-hidden />
          {isAuthenticated
            ? 'Chcesz przypomnienie?'
            : 'Przypomnienia wymagają konta.'}{' '}
          <Link className="campus-text-link" to="/usos">
            Alarmy rejestracji
          </Link>
        </p>
        {latestDate ? (
          <p>
            Ostatnio potwierdzono w USOSweb:{' '}
            <time
              dateTime={latestDate.toISOString()}
              title={formatFull(latestDate)}
            >
              {formatRelativePast(latestDate, now)}
            </time>
            .
          </p>
        ) : null}
      </div>
    </InfoHubShell>
  )
}
