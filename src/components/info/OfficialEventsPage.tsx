import { Link } from 'react-router-dom'
import { CalendarDays, Users } from 'lucide-react'
import { usePublicOfficialEvents } from '../../hooks/usePublicInfo'
import { useNow } from '../../hooks/useNow'
import { upcomingEventsSorted } from '../../lib/info/relevance'
import { UJ_LINKS } from '../../lib/info/resources'
import { dayKeyToDate, formatFull, formatRelativePast, parseIsoDate, WARSAW_TZ } from '../../lib/info/time'
import type { InfoEvent } from '../../lib/info/types'
import { EventItem } from './InfoItems'
import {
  DomainEmpty,
  DomainError,
  ExternalSourceLink,
  InfoSection,
  PageIntro,
  RowSkeletons,
} from './infoUi'

const monthFormatter = new Intl.DateTimeFormat('pl-PL', { timeZone: WARSAW_TZ, month: 'long', year: 'numeric' })

function groupByMonth(events: InfoEvent[]): Array<{ key: string; title: string; items: InfoEvent[] }> {
  const groups = new Map<string, InfoEvent[]>()
  for (const event of events) {
    const key = event.dayKey.slice(0, 7)
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }
  return [...groups.entries()].map(([key, items]) => {
    const label = monthFormatter.format(dayKeyToDate(`${key}-15`))
    return { key, title: label.charAt(0).toUpperCase() + label.slice(1), items }
  })
}

export default function OfficialEventsPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  const now = useNow()
  const query = usePublicOfficialEvents()
  const events = upcomingEventsSorted(query.data?.items ?? [], now)
  const groups = groupByMonth(events)
  const latest = parseIsoDate(query.data?.freshness.latest ?? null)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageIntro
        title="Wydarzenia na UJ"
        description="Wydarzenia ogólnouczelniane z kalendarza uj.edu.pl. Na liście podajemy daty — godziny, miejsce i zapisy sprawdź w źródle."
      />

      {latest ? (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400" role="status">
          Kalendarz uj.edu.pl sprawdzony{' '}
          <time dateTime={latest.toISOString()} title={formatFull(latest)}>
            {formatRelativePast(latest, now)}
          </time>
        </p>
      ) : null}

      {query.isPending ? (
        <InfoSection icon={CalendarDays} title="Nadchodzące wydarzenia" busy>
          <RowSkeletons count={4} />
        </InfoSection>
      ) : query.isError ? (
        <InfoSection icon={CalendarDays} title="Nadchodzące wydarzenia">
          <DomainError what="wydarzenia" onRetry={() => void query.refetch()} />
        </InfoSection>
      ) : query.data.freshness.latest === null ? (
        <InfoSection icon={CalendarDays} title="Nadchodzące wydarzenia">
          <DomainEmpty>Dane o wydarzeniach z uj.edu.pl są chwilowo niedostępne.</DomainEmpty>
        </InfoSection>
      ) : groups.length === 0 ? (
        <InfoSection icon={CalendarDays} title="Nadchodzące wydarzenia">
          <DomainEmpty>Brak zapowiedzianych wydarzeń w kalendarzu UJ.</DomainEmpty>
        </InfoSection>
      ) : (
        groups.map((group) => (
          <InfoSection key={group.key} icon={CalendarDays} title={group.title} busy={query.isFetching}>
            <ul className="space-y-2.5" role="list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <EventItem item={item} now={now} variant="full" />
                </li>
              ))}
            </ul>
          </InfoSection>
        ))
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 p-4 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        <p className="flex items-start gap-2">
          <Users size={14} className="mt-0.5 shrink-0 text-brand-ink dark:text-brand-gold-bright" aria-hidden />
          <span>
            Wydarzenia tworzone przez studentów są w osobnej części serwisu
            {isAuthenticated ? '' : ' (wymaga konta)'}:{' '}
            <Link to="/events" className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright">
              wydarzenia społeczności
            </Link>
            .
          </span>
        </p>
        <p>
          Oficjalny kalendarz: <ExternalSourceLink href={UJ_LINKS.ujCalendar}>uj.edu.pl/kalendarz</ExternalSourceLink>
        </p>
      </div>
    </div>
  )
}
