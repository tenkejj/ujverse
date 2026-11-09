import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, List } from 'lucide-react'
import { usePublicOfficialEvents } from '../../hooks/usePublicInfo'
import { useNow } from '../../hooks/useNow'
import { upcomingEventsSorted } from '../../lib/info/relevance'
import { foldForSearch, UJ_LINKS } from '../../lib/info/resources'
import { dayKeyToDate, WARSAW_TZ } from '../../lib/info/time'
import type { InfoEvent } from '../../lib/info/types'
import { EventPreviewTile } from './InfoItems'
import { InfoHubSection, InfoHubShell, InfoHubTitle } from './InfoHubShell'
import {
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  RowSkeletons,
} from './infoUi'

import InfoEventCalendar from './InfoEventCalendar'
import DataFreshness from './DataFreshness'
const monthFormatter = new Intl.DateTimeFormat('pl-PL', {
  timeZone: WARSAW_TZ,
  month: 'long',
  year: 'numeric',
})
function groupByMonth(events: InfoEvent[]) {
  const groups = new Map<string, InfoEvent[]>()
  for (const event of events) {
    const key = event.dayKey.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), event])
  }
  return [...groups].map(([key, items]) => ({
    key,
    title: monthFormatter.format(dayKeyToDate(`${key}-15`)),
    items,
  }))
}

export default function OfficialEventsPage({
  isAuthenticated,
}: {
  isAuthenticated: boolean
}) {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const calendar = params.get('widok') !== 'lista'
  const tabsRef = useRef<HTMLDivElement>(null)
  const query = usePublicOfficialEvents()
  const text = params.get('q') ?? ''
  const folded = foldForSearch(text)
  const events = upcomingEventsSorted(query.data?.items ?? [], now).filter(
    (item) =>
      !folded ||
      foldForSearch(`${item.title} ${item.description}`).includes(folded),
  )
  const groups = groupByMonth(events)
  const switchView = (next: boolean) =>
    setParams((previous) => {
      const p = new URLSearchParams(previous)
      if (next) p.set('widok', 'kalendarz')
      else p.set('widok', 'lista')
      return p
    })
  return (
    <InfoHubShell>
      <InfoHubTitle
        title="Wydarzenia na UJ"
        description="Wykłady, spotkania i życie uczelni. Z oficjalnego kalendarza UJ."
      />
      <DataFreshness
        kind="events"
        iso={query.data?.freshness.latest ?? null}
        now={now}
        status={
          query.isPending || query.isPlaceholderData
            ? 'loading'
            : query.isError
              ? 'error'
              : 'ready'
        }
        checkedAt={query.dataUpdatedAt}
      />
      <div
        ref={tabsRef}
        className="campus-view-tabs info-event-view-tabs"
        role="tablist"
        aria-label="Widoki strony Wydarzenia"
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const next =
              event.key === 'Home'
                ? false
                : event.key === 'End'
                  ? true
                  : !calendar
            switchView(next)
            ;(
              tabsRef.current?.querySelectorAll('button')[next ? 1 : 0] as
                HTMLButtonElement | undefined
            )?.focus()
          }
        }}
      >
        <button
          id="events-list-tab"
          type="button"
          role="tab"
          aria-selected={!calendar}
          aria-controls="events-list-panel"
          tabIndex={calendar ? -1 : 0}
          onClick={() => switchView(false)}
        >
          <List size={17} strokeWidth={1.75} aria-hidden />
          Wydarzenia
        </button>
        <button
          id="events-calendar-tab"
          type="button"
          role="tab"
          aria-selected={calendar}
          aria-controls="events-calendar-panel"
          tabIndex={calendar ? 0 : -1}
          onClick={() => switchView(true)}
        >
          <CalendarDays size={17} strokeWidth={1.75} aria-hidden />
          Kalendarz
        </button>
      </div>
      {calendar ? (
        <div
          id="events-calendar-panel"
          className="campus-calendar"
          role="tabpanel"
          aria-labelledby="events-calendar-tab"
        >
          {query.isPending ? (
            <RowSkeletons count={4} variant="feed" />
          ) : query.isError ? (
            <DomainError
              what="wydarzenia"
              onRetry={() => void query.refetch()}
            />
          ) : query.data?.freshness.latest === null ? (
            <DomainEmpty>
              Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.
            </DomainEmpty>
          ) : (
            <InfoEventCalendar
              events={upcomingEventsSorted(query.data?.items ?? [], now)}
              now={now}
            />
          )}
        </div>
      ) : (
        <div
          id="events-list-panel"
          role="tabpanel"
          aria-labelledby="events-list-tab"
        >
          <label className="campus-events-search" htmlFor="events-search">
            Znajdź wydarzenie
            <input
              id="events-search"
              type="search"
              name="q"
              autoComplete="off"
              placeholder="np. wykład, konferencja…"
              value={text}
              onChange={(e) =>
                setParams(
                  (previous) => {
                    const p = new URLSearchParams(previous)
                    if (e.target.value) p.set('q', e.target.value)
                    else p.delete('q')
                    return p
                  },
                  { replace: true },
                )
              }
            />
          </label>
          {query.isPending ? (
            <RowSkeletons count={4} variant="feed" />
          ) : query.isError ? (
            <DomainError
              what="wydarzenia"
              onRetry={() => void query.refetch()}
            />
          ) : query.data?.freshness.latest === null ? (
            <DomainEmpty>
              Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.
            </DomainEmpty>
          ) : !groups.length ? (
            <DomainEmpty>
              {text
                ? 'Brak wydarzeń pasujących do wyszukiwania.'
                : 'Brak zapowiedzianych wydarzeń w kalendarzu UJ.'}
            </DomainEmpty>
          ) : (
            groups.map((group) => (
              <InfoHubSection
                key={group.key}
                title={group.title}
                count={group.items.length}
              >
                <ul className="event-preview-grid">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <EventPreviewTile item={item} now={now} />
                    </li>
                  ))}
                </ul>
              </InfoHubSection>
            ))
          )}
        </div>
      )}
      <div className="campus-page-note">
        <p>
          Podajemy dni wydarzeń. Godziny i zasady zapisów potwierdź w źródle:{' '}
          <ExternalSourceLink href={UJ_LINKS.ujCalendar}>
            kalendarz UJ
          </ExternalSourceLink>
          .
        </p>
        <p>
          Organizujesz własne wydarzenie?{' '}
          <Link to="/events" className="campus-text-link">
            Wydarzenia społeczności{isAuthenticated ? '' : ' (wymaga konta)'}
          </Link>
        </p>
      </div>
    </InfoHubShell>
  )
}
