import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, Search } from 'lucide-react'
import { FILTER_PILL } from '../../styles/mobile-theme'
import { usePublicAnnouncements } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { ANNOUNCEMENT_SOURCE_COUNT, facultyShortLabel } from '../../lib/info/faculty'
import { sortAnnouncementsNewestFirst } from '../../lib/info/relevance'
import { foldForSearch } from '../../lib/info/resources'
import type { AnnouncementStatus } from '../../types/content'
import FacultyPicker from './FacultyPicker'
import { AnnouncementItem } from './InfoItems'
import {
  DomainEmpty,
  DomainError,
  FOCUS_RING,
  INFO_ACTION_LINK_CLS,
  InfoSection,
  PageIntro,
  RowSkeletons,
} from './infoUi'

type StatusFilter = 'all' | AnnouncementStatus

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'cancelled', label: 'Odwołane zajęcia' },
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
  const visible = all.filter((item) => {
    if (status !== 'all' && item.status !== status) return false
    if (!folded) return true
    return foldForSearch(`${item.title} ${item.body} ${item.sourceLabel}`).includes(folded)
  })

  const scope = selected ? `${selected} (${facultyShortLabel(selected) ?? ''})` : 'wszystkie wydziały'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageIntro
        title="Komunikaty"
        description={
          <>
            Ogłoszenia z {ANNOUNCEMENT_SOURCE_COUNT} oficjalnych stron wydziałów UJ z ostatnich 30 dni. Data przy komunikacie
            to moment pobrania go przez UJverse — szczegóły i aktualizacje zawsze w źródle.
          </>
        }
      >
        <FacultyPicker faculty={selected} source={faculty.source} persistent={faculty.persistent} onChange={faculty.setFaculty} />
      </PageIntro>

      <div className="flex flex-col gap-3 px-1">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rodzaj komunikatu">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.id
            const count = counts[filter.id]
            if (filter.id !== 'all' && count === 0) return null
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(filter.id)}
                className={`${FILTER_PILL.base} ${active ? FILTER_PILL.active : FILTER_PILL.inactive}`}
              >
                {filter.label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        <label className="relative block max-w-md">
          <span className="sr-only">Filtruj komunikaty na tej liście</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filtruj tę listę…"
            className={`ujverse-search-input h-10 w-full rounded-xl border border-zinc-200 bg-white/80 pl-9 pr-3 text-sm text-zinc-800 placeholder:text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 ${FOCUS_RING}`}
          />
        </label>
      </div>

      <InfoSection
        icon={Megaphone}
        title={selected ? `Komunikaty: ${facultyShortLabel(selected) ?? selected}` : 'Komunikaty wszystkich wydziałów'}
        subtitle={`Zakres: ${scope}`}
        busy={query.isFetching}
      >
        {query.isPending ? (
          <RowSkeletons count={5} />
        ) : query.isError && all.length === 0 ? (
          <DomainError what="komunikaty" onRetry={() => void query.refetch()} />
        ) : visible.length === 0 ? (
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
              ? `Brak nowych komunikatów (${scope}) w ostatnich 30 dniach.`
              : 'Żaden komunikat nie pasuje do wybranych filtrów.'}
          </DomainEmpty>
        ) : (
          <>
            <p className="sr-only" role="status">
              {`Wyświetlane komunikaty: ${visible.length}`}
            </p>
            <ul className={`space-y-2.5 ${query.isPlaceholderData ? 'opacity-60' : ''}`} role="list">
              {visible.map((item) => (
                <li key={item.id}>
                  <AnnouncementItem item={item} now={now} variant="full" headingLevel="h3" />
                </li>
              ))}
            </ul>
          </>
        )}
      </InfoSection>

      <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
        Szukasz starszego komunikatu?{' '}
        <Link to="/szukaj" className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright">
          Skorzystaj z wyszukiwarki
        </Link>
        .
      </p>
    </div>
  )
}
