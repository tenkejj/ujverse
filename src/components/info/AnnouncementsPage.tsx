import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { usePublicAnnouncements } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { ANNOUNCEMENT_SOURCE_COUNT, facultyShortLabel } from '../../lib/info/faculty'
import { sortAnnouncementsNewestFirst } from '../../lib/info/relevance'
import { foldForSearch } from '../../lib/info/resources'
import { formatRelativePast, parseIsoDate } from '../../lib/info/time'
import type { AnnouncementStatus } from '../../types/content'
import { theme } from '../../styles/theme'
import FacultyPicker from './FacultyPicker'
import { AnnouncementHubCard } from './InfoHubCards'
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
  AnnouncementStatusPill,
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  INFO_ACTION_LINK_CLS,
  RowSkeletons,
} from './infoUi'

type StatusFilter = 'all' | AnnouncementStatus

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'cancelled', label: 'Odwołane' },
  { id: 'remote', label: 'Zdalnie' },
  { id: 'duty', label: 'Dyżury' },
  { id: 'event', label: 'Wydarzenia' },
  { id: 'info', label: 'Pozostałe' },
]

export default function AnnouncementsPage({ faculty }: { faculty: FacultyPreference }) {
  const now = useNow()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [text, setText] = useState('')
  const selected = faculty.faculty
  const query = usePublicAnnouncements(selected)
  const all = useMemo(() => sortAnnouncementsNewestFirst(query.data?.items ?? []), [query.data])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: all.length, cancelled: 0, remote: 0, duty: 0, event: 0, info: 0 }
    for (const item of all) c[item.status] += 1
    return c
  }, [all])

  const folded = foldForSearch(text)
  const filtered = all.filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    if (!folded) return true
    return foldForSearch(`${item.title} ${item.body} ${item.sourceLabel}`).includes(folded)
  })

  const showSpotlight = status === 'all' && !folded && filtered.length > 0
  const hero =
    filtered.find((item) => item.status === 'cancelled' || item.status === 'remote') ?? filtered[0] ?? null
  const gridItems = showSpotlight && hero ? filtered.filter((item) => item.id !== hero.id) : filtered

  const filters = STATUS_FILTERS.map((f) => ({ key: f.id, label: f.label, count: counts[f.id] }))
  const short = selected ? facultyShortLabel(selected) ?? selected : null
  const heroAdded = hero ? parseIsoDate(hero.addedAt) : null

  return (
    <InfoHubShell
      rail={
        <>
          <InfoHubRailStatus
            live={query.isSuccess && !query.isError}
            label={
              query.isError
                ? 'Nie udało się pobrać komunikatów'
                : `Źródła: ${ANNOUNCEMENT_SOURCE_COUNT} stron wydziałów`
            }
          />
          <InfoHubRailStats
            stats={[
              { value: counts.all, label: 'Łącznie' },
              { value: counts.cancelled, label: 'Odwołane' },
              { value: counts.remote, label: 'Zdalnie' },
            ]}
          />
          <InfoHubRailFilters filters={filters} activeKey={status} onFilterChange={(k) => setStatus(k as StatusFilter)} />
        </>
      }
    >
      <InfoHubTitle
        title="Komunikaty"
        description={`Ogłoszenia z ${ANNOUNCEMENT_SOURCE_COUNT} stron wydziałów · ostatnie 30 dni. Data „dodano” to pobranie przez UJverse.`}
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
        activeKey={status}
        onFilterChange={(k) => setStatus(k as StatusFilter)}
        search={text}
        onSearchChange={setText}
        searchPlaceholder="Szukaj w komunikatach…"
        searchAriaLabel="Szukaj w komunikatach"
        live={{ on: query.isSuccess && !query.isError, label: 'Źródła wydziałowe' }}
        trailing={
          <Link to="/szukaj" className={`${theme.button.primary} !min-h-9 !rounded-full !px-3 !text-xs`}>
            Wyszukiwarka
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        }
      />

      {query.isPending ? (
        <RowSkeletons count={4} />
      ) : query.isError && all.length === 0 ? (
        <DomainError what="komunikaty" onRetry={() => void query.refetch()} />
      ) : filtered.length === 0 ? (
        <DomainEmpty
          action={
            status !== 'all' || folded ? (
              <button
                type="button"
                onClick={() => {
                  setStatus('all')
                  setText('')
                }}
                className={`${INFO_ACTION_LINK_CLS} -ml-2`}
              >
                Wyczyść filtry
              </button>
            ) : selected ? (
              <button type="button" onClick={() => faculty.setFaculty(null)} className={`${INFO_ACTION_LINK_CLS} -ml-2`}>
                Pokaż komunikaty z całego UJ
              </button>
            ) : undefined
          }
        >
          {all.length === 0
            ? `Brak nowych komunikatów${short ? ` (${short})` : ''} w ostatnich 30 dniach.`
            : 'Żaden komunikat nie pasuje do wybranych filtrów.'}
        </DomainEmpty>
      ) : (
        <>
          {showSpotlight && hero ? (
            <InfoHubSpotlight
              eyebrow={hero.status === 'cancelled' ? 'Odwołane zajęcia' : hero.status === 'remote' ? 'Zajęcia zdalne' : 'Najnowszy komunikat'}
              title={hero.title}
              meta={
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <AnnouncementStatusPill status={hero.status} />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {[hero.facultyShort, hero.sourceLabel].filter(Boolean).join(' · ')}
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
                <ExternalSourceLink href={hero.sourceUrl}>
                  {hero.sourceIsListing ? 'Lista komunikatów wydziału' : 'Sprawdź w źródle'}
                </ExternalSourceLink>
              }
            />
          ) : null}

          {gridItems.length > 0 ? (
            <InfoHubSection title={selected ? `Komunikaty · ${short}` : 'Wszystkie wydziały'} count={gridItems.length}>
              <InfoHubCardGrid>
                {gridItems.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <AnnouncementHubCard item={item} now={now} />
                  </li>
                ))}
              </InfoHubCardGrid>
            </InfoHubSection>
          ) : null}
        </>
      )}
    </InfoHubShell>
  )
}
