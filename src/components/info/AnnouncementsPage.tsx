import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePublicAnnouncements } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import {
  ANNOUNCEMENT_SOURCE_COUNT,
  facultyShortLabel,
} from '../../lib/info/faculty'
import { sortAnnouncementsNewestFirst } from '../../lib/info/relevance'
import { foldForSearch } from '../../lib/info/resources'
import type { AnnouncementStatus } from '../../types/content'
import { AnnouncementHubCard } from './InfoHubCards'
import {
  InfoHubCardGrid,
  InfoHubSection,
  InfoHubShell,
  InfoHubTitle,
  InfoHubToolbar,
} from './InfoHubShell'
import { DomainEmpty, DomainError, RowSkeletons } from './infoUi'

type StatusFilter = 'all' | AnnouncementStatus
const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'cancelled', label: 'Odwołane' },
  { key: 'remote', label: 'Zdalnie' },
  { key: 'duty', label: 'Dyżury' },
  { key: 'event', label: 'Wydarzenia' },
  { key: 'info', label: 'Pozostałe' },
]

export default function AnnouncementsPage({
  faculty,
}: {
  faculty: FacultyPreference
}) {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const rawStatus = params.get('status')
  const status = FILTERS.some((f) => f.key === rawStatus)
    ? (rawStatus as StatusFilter)
    : 'all'
  const text = params.get('q') ?? ''
  const setFilter = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('strona')
        if (!value || value === 'all') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const query = usePublicAnnouncements(faculty.faculty)
  const all = useMemo(
    () => sortAnnouncementsNewestFirst(query.data?.items ?? []),
    [query.data],
  )
  const folded = foldForSearch(text)
  const filtered = all.filter(
    (item) =>
      (status === 'all' || item.status === status) &&
      (!folded ||
        foldForSearch(
          `${item.title} ${item.body} ${item.sourceLabel}`,
        ).includes(folded)),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 12))
  const requestedPage = Number(params.get('strona') ?? 1)
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pages, Math.max(1, requestedPage))
    : 1
  const visible = filtered.slice((page - 1) * 12, page * 12)
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(params)
    if (nextPage === 1) next.delete('strona')
    else next.set('strona', String(nextPage))
    return `/komunikaty?${next.toString()}`
  }
  const filters = FILTERS.map((f) => ({
    ...f,
    count:
      f.key === 'all'
        ? all.length
        : all.filter((item) => item.status === f.key).length,
  }))
  const short = faculty.faculty
    ? (facultyShortLabel(faculty.faculty) ?? faculty.faculty)
    : null

  return (
    <InfoHubShell>
      <InfoHubTitle
        title="Komunikaty"
        description="Ogłoszenia z wydziałów. Najnowsze informacje zawsze na początku."

      />
      <InfoHubToolbar
        filters={filters}
        activeKey={status}
        onFilterChange={(v) => setFilter('status', v)}
        search={text}
        onSearchChange={(v) => setFilter('q', v)}
        searchPlaceholder="Szukaj w komunikatach…"
        searchAriaLabel="Szukaj w komunikatach"
      />
      <InfoHubSection
        title={short ? `Twój wydział: ${short}` : 'Wszystkie wydziały'}
        count={filtered.length}
      >
        {query.isPending ? (
          <RowSkeletons count={5} variant="feed" />
        ) : query.isError && !all.length ? (
          <DomainError what="komunikaty" onRetry={() => void query.refetch()} />
        ) : !filtered.length ? (
          <DomainEmpty
            action={
              status !== 'all' || text ? (
                <button
                  type="button"
                  className="campus-text-link"
                  onClick={() => setParams({})}
                >
                  Wyczyść filtry
                </button>
              ) : short ? (
                <button
                  type="button"
                  className="campus-text-link"
                  onClick={() => faculty.setFaculty(null)}
                >
                  Pokaż komunikaty z całego UJ
                </button>
              ) : undefined
            }
          >
            {all.length
              ? 'Żaden komunikat nie pasuje do wybranych filtrów.'
              : 'Brak nowych komunikatów w ostatnich 30 dniach.'}
          </DomainEmpty>
        ) : (
          <InfoHubCardGrid>
            {visible.map((item) => (
              <li key={item.id}>
                <AnnouncementHubCard item={item} now={now} />
              </li>
            ))}
          </InfoHubCardGrid>
        )}
      </InfoHubSection>
      {pages > 1 ? (
        <nav className="campus-pagination" aria-label="Strony komunikatów">
          {page > 1 ? (
            <Link
              to={pageHref(page - 1)}
              onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
            >
              Poprzednia strona
            </Link>
          ) : (
            <span />
          )}
          <span aria-live="polite">
            Strona {page} z {pages}
          </span>
          {page < pages ? (
            <Link
              to={pageHref(page + 1)}
              onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
            >
              Następna strona
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      <p className="campus-page-note">
        Źródła: {ANNOUNCEMENT_SOURCE_COUNT} stron wydziałów UJ. „Dodano” oznacza
        datę pobrania do UJverse, nie datę publikacji ogłoszenia.
      </p>
    </InfoHubShell>
  )
}
