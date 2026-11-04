import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AlarmClock, CalendarDays, Link2, Loader2, Megaphone, Search, Users, X } from 'lucide-react'
import { usePublicRegistrations, usePublicSearch } from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { facultyShortLabel } from '../../lib/info/faculty'
import { MIN_QUERY_LENGTH } from '../../lib/info/search'
import { pluralPL } from '../../lib/info/time'
import { AnnouncementItem, EventItem, RegistrationItem } from './InfoItems'
import { ResourceGrid } from './InfoBlocks'
import { DomainEmpty, DomainError, FOCUS_RING, InfoSection, PageIntro } from './infoUi'

const SUGGESTIONS = ['stypendium', 'rejestracja', 'lektorat', 'egzamin', 'odwołane', 'konferencja', 'poczta', 'sala']

export default function InfoSearchPage({
  faculty,
  isAuthenticated,
}: {
  faculty: FacultyPreference
  isAuthenticated: boolean
}) {
  const now = useNow()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  // Fraza z URL to tylko wartość początkowa — nowe wyszukiwanie z nagłówka
  // zmienia `key` strony w App.tsx i montuje ją od nowa.
  const [input, setInput] = useState(urlQuery)
  const [onlyFaculty, setOnlyFaculty] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const scopeFaculty = onlyFaculty ? faculty.faculty : null
  const search = usePublicSearch(input, scopeFaculty)
  const registrationsMeta = usePublicRegistrations()
  const latestRegistrationRun = registrationsMeta.data?.freshness.latest ?? null

  // Pole → URL (po debounce, bez zaśmiecania historii; `state` zachowuje klucz strony).
  const navigationState = location.state
  useEffect(() => {
    const next = search.debouncedQuery
    if (next === urlQuery) return
    setParams(next ? { q: next } : {}, { replace: true, state: navigationState })
  }, [search.debouncedQuery, urlQuery, setParams, navigationState])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    inputRef.current?.blur()
  }

  const data = search.data
  const showResults = search.enabled && data !== undefined
  const loading = search.enabled && (search.isFetching || search.isTyping) && !data
  const counts = data
    ? {
        announcements: data.announcements.items.length,
        registrations: data.registrations.items.length,
        events: data.events.items.length,
        resources: data.resources.length,
      }
    : null
  const total = counts ? counts.announcements + counts.registrations + counts.events + counts.resources : 0
  const allFailed =
    data !== undefined &&
    data.announcements.status === 'error' &&
    data.registrations.status === 'error' &&
    data.events.status === 'error'
  const facultyShort = faculty.faculty ? (facultyShortLabel(faculty.faculty) ?? faculty.faculty) : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageIntro
        title="Szukaj"
        description="Komunikaty wydziałów, rejestracje z USOSweb, wydarzenia UJ i narzędzia — bez zakładania konta."
      />

      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-2 px-1">
        <label htmlFor="info-search-input" className="sr-only">
          Szukaj informacji na UJ
        </label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink dark:text-zinc-400" aria-hidden />
          <input
            ref={inputRef}
            id="info-search-input"
            type="search"
            name="q"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="np. stypendium, lektorat, rejestracja WF…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            autoFocus={!urlQuery}
            className={`ujverse-search-input h-12 w-full rounded-2xl border border-zinc-200 bg-white/85 pl-11 pr-11 text-base text-zinc-900 shadow-sm placeholder:text-zinc-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 ${FOCUS_RING}`}
          />
          {input ? (
            <button
              type="button"
              onClick={() => {
                setInput('')
                inputRef.current?.focus()
              }}
              aria-label="Wyczyść wyszukiwanie"
              className={`absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10 ${FOCUS_RING}`}
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
        </div>
        {facultyShort ? (
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 self-start text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={onlyFaculty}
              onChange={(e) => setOnlyFaculty(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand-ink)] dark:accent-[var(--brand-gold-bright)]"
            />
            Komunikaty tylko z wydziału {facultyShort}
          </label>
        ) : null}
      </form>

      <div aria-live="polite" className="sr-only">
        {loading
          ? 'Szukam…'
          : showResults && counts
            ? `Wyniki: ${countLabel(counts.announcements, 'komunikat', 'komunikaty', 'komunikatów')}, ${countLabel(counts.registrations, 'rejestracja', 'rejestracje', 'rejestracji')}, ${countLabel(counts.events, 'wydarzenie', 'wydarzenia', 'wydarzeń')}, ${countLabel(counts.resources, 'narzędzie', 'narzędzia', 'narzędzi')}.`
            : ''}
      </div>

      {!search.enabled ? (
        <div className="flex flex-col gap-3 px-1">
          {input.trim().length > 0 && input.trim().length < MIN_QUERY_LENGTH ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Wpisz co najmniej {MIN_QUERY_LENGTH} znaki.</p>
          ) : null}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Popularne wyszukiwania:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInput(suggestion)}
                className={`inline-flex min-h-9 items-center rounded-full border border-zinc-200 bg-white/70 px-3 text-sm text-zinc-700 hover:border-brand-ink/35 dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:border-brand-gold-bright/45 ${FOCUS_RING}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Szukam…
        </p>
      ) : null}

      {search.isError && !data ? (
        <DomainError what="wyniki wyszukiwania" onRetry={() => void search.refetch()} />
      ) : null}

      {showResults && data ? (
        <div className={`flex flex-col gap-4 ${search.isFetching || search.isTyping ? 'opacity-70' : ''}`}>
          {data.announcementsEngine === 'fallback' ? (
            <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Pełnotekstowa wyszukiwarka jest chwilowo niedostępna — komunikaty dopasowujemy prostym wyszukiwaniem fragmentu tekstu,
              więc literówki mogą nie zostać rozpoznane.
            </p>
          ) : null}

          {total === 0 && !allFailed ? (
            <DomainEmpty>
              Nic nie znaleźliśmy dla „{data.query}". Spróbuj krótszego słowa, innej formy (np. „stypendi") albo nazwy
              wydziału.
            </DomainEmpty>
          ) : null}

          {allFailed ? <DomainError what="wyniki wyszukiwania" onRetry={() => void search.refetch()} /> : null}

          {data.announcements.status === 'error' && !allFailed ? (
            <InfoSection icon={Megaphone} title="Komunikaty">
              <DomainError what="komunikaty" onRetry={() => void search.refetch()} />
            </InfoSection>
          ) : counts && counts.announcements > 0 ? (
            <InfoSection
              icon={Megaphone}
              title={`Komunikaty (${counts.announcements})`}
              subtitle={scopeFaculty ? `Tylko ${facultyShort}` : 'Wszystkie wydziały, także starsze niż 30 dni'}
            >
              <ul className="space-y-2.5" role="list">
                {data.announcements.items.map((item) => (
                  <li key={item.id}>
                    <AnnouncementItem item={item} now={now} />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {data.registrations.status === 'error' && !allFailed ? (
            <InfoSection icon={AlarmClock} title="Rejestracje">
              <DomainError what="rejestracje" onRetry={() => void search.refetch()} />
            </InfoSection>
          ) : counts && counts.registrations > 0 ? (
            <InfoSection icon={AlarmClock} title={`Rejestracje (${counts.registrations})`} subtitle="Trwające i nadchodzące, z USOSweb">
              <ul className="space-y-2.5" role="list">
                {data.registrations.items.map((item) => (
                  <li key={item.id}>
                    <RegistrationItem item={item} now={now} latestVerifiedAt={latestRegistrationRun} />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {data.events.status === 'error' && !allFailed ? (
            <InfoSection icon={CalendarDays} title="Wydarzenia">
              <DomainError what="wydarzenia" onRetry={() => void search.refetch()} />
            </InfoSection>
          ) : counts && counts.events > 0 ? (
            <InfoSection icon={CalendarDays} title={`Wydarzenia (${counts.events})`} subtitle="Z kalendarza uj.edu.pl (także z ostatnich 90 dni)">
              <ul className="space-y-2.5" role="list">
                {data.events.items.map((item) => (
                  <li key={item.id}>
                    <EventItem item={item} now={now} />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {counts && counts.resources > 0 ? (
            <InfoSection icon={Link2} title={`Narzędzia (${counts.resources})`}>
              <ResourceGrid resources={data.resources} isAuthenticated={isAuthenticated} columns="sm:grid-cols-2" />
            </InfoSection>
          ) : null}
        </div>
      ) : null}

      {isAuthenticated ? (
        <p className="flex items-center gap-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Users size={14} aria-hidden />
          Szukasz osób, wpisów albo wiadomości z Auli?{' '}
          <Link
            to={input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : '/search'}
            className="font-semibold text-brand-ink underline-offset-2 hover:underline dark:text-brand-gold-bright"
          >
            Szukaj w społeczności
          </Link>
        </p>
      ) : null}
    </div>
  )
}

function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${pluralPL(n, one, few, many)}`
}
