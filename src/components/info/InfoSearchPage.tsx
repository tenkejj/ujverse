import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Languages,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Search,
  Users,
  X,
} from 'lucide-react'
import {
  usePublicRegistrations,
  usePublicSearch,
} from '../../hooks/usePublicInfo'
import type { FacultyPreference } from '../../hooks/useInfoPreferences'
import { useNow } from '../../hooks/useNow'
import { facultyShortLabel } from '../../lib/info/faculty'
import { MIN_QUERY_LENGTH } from '../../lib/info/search'
import { pluralPL } from '../../lib/info/time'
import {
  AnnouncementHubCard,
  EventHubCard,
  RegistrationHubCard,
} from './InfoHubCards'
import { ResourceGrid } from './InfoBlocks'
import { DomainEmpty, DomainError, InfoSection } from './infoUi'

import '../../styles/info-search.css'

const SUGGESTIONS = [
  { query: 'stypendium', label: 'Stypendia', icon: GraduationCap },
  { query: 'rejestracja', label: 'Rejestracje', icon: ClipboardList },
  { query: 'lektorat', label: 'Lektoraty', icon: Languages },
  { query: 'egzamin', label: 'Egzaminy', icon: BookOpen },
  { query: 'odwołane', label: 'Odwołane zajęcia', icon: AlarmClock },
  { query: 'konferencja', label: 'Konferencje', icon: CalendarDays },
  { query: 'poczta', label: 'Poczta', icon: Mail },
  { query: 'sala', label: 'Sale i budynki', icon: MapPin },
] as const
const DESTINATIONS = [
  {
    href: '/komunikaty',
    label: 'Komunikaty',
    detail: 'Ogłoszenia wydziałów',
    icon: Megaphone,
  },
  {
    href: '/rejestracje',
    label: 'Rejestracje',
    detail: 'Terminy zapisów',
    icon: ClipboardList,
  },
  {
    href: '/wydarzenia',
    label: 'Wydarzenia',
    detail: 'Kalendarz UJ',
    icon: CalendarDays,
  },
] as const

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
    setParams(next ? { q: next } : {}, {
      replace: true,
      state: navigationState,
    })
  }, [search.debouncedQuery, urlQuery, setParams, navigationState])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    inputRef.current?.blur()
  }

  const data = search.data
  const showResults = search.enabled && data !== undefined
  const loading =
    search.enabled && (search.isFetching || search.isTyping) && !data
  const counts = data
    ? {
        announcements: data.announcements.items.length,
        registrations: data.registrations.items.length,
        events: data.events.items.length,
        resources: data.resources.length,
      }
    : null
  const total = counts
    ? counts.announcements +
      counts.registrations +
      counts.events +
      counts.resources
    : 0
  const allFailed =
    data !== undefined &&
    data.announcements.status === 'error' &&
    data.registrations.status === 'error' &&
    data.events.status === 'error'
  const facultyShort = faculty.faculty
    ? (facultyShortLabel(faculty.faculty) ?? faculty.faculty)
    : null

  return (
    <div className="campus-search-page info-search-workspace">
      <header className="info-search-heading">
        <Search size={24} strokeWidth={1.75} aria-hidden />
        <h1>Szukaj na UJ</h1>
      </header>

      <form role="search" onSubmit={onSubmit} className="info-search-form">
        <label htmlFor="info-search-input" className="sr-only">
          Szukaj informacji na UJ
        </label>
        <div className="info-search-field">
          <Search
            size={22}
            strokeWidth={1.75}
            className="info-search-glyph"
            aria-hidden
          />
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
            className="ujverse-search-input"
          />
          {input ? (
            <button
              type="button"
              onClick={() => {
                setInput('')
                inputRef.current?.focus()
              }}
              aria-label="Wyczyść wyszukiwanie"
              className="info-search-clear"
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
          <button
            type="submit"
            className="info-search-submit"
            aria-label="Szukaj"
          >
            <span>Szukaj</span>
            <ArrowRight size={18} aria-hidden />
          </button>
        </div>
        {facultyShort ? (
          <label className="info-search-faculty">
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
        <div className="info-search-start">
          <section
            className="info-search-topics"
            aria-labelledby="search-topics-heading"
          >
            <h2 id="search-topics-heading">Czego szukasz?</h2>
            {input.trim().length > 0 &&
            input.trim().length < MIN_QUERY_LENGTH ? (
              <p className="info-search-hint">
                Wpisz co najmniej {MIN_QUERY_LENGTH} znaki.
              </p>
            ) : null}
            <div className="info-search-topic-grid">
              {SUGGESTIONS.map(({ query, label, icon: Icon }) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => setInput(query)}
                  aria-label={`Szukaj: ${query}`}
                >
                  <Icon size={21} strokeWidth={1.75} aria-hidden />
                  <span>{label}</span>
                  <ArrowRight size={15} aria-hidden />
                </button>
              ))}
            </div>
          </section>
          <aside
            className="info-search-shortcuts"
            aria-labelledby="search-shortcuts-heading"
          >
            <h2 id="search-shortcuts-heading">Przejdź od razu</h2>
            <nav aria-label="Zbiory informacji na UJ">
              {DESTINATIONS.map(({ href, label, detail, icon: Icon }) => (
                <Link key={href} to={href}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowRight size={16} aria-hidden />
                </Link>
              ))}
            </nav>
            <Link to="/niezbednik" className="info-search-toolkit">
              <Link2 size={17} aria-hidden />
              Niezbędnik studenta
              <ArrowRight size={15} aria-hidden />
            </Link>
          </aside>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Szukam…
        </p>
      ) : null}

      {search.isError && !data ? (
        <DomainError
          what="wyniki wyszukiwania"
          onRetry={() => void search.refetch()}
        />
      ) : null}

      {showResults && data ? (
        <div
          className={`info-search-results ${search.isFetching || search.isTyping ? 'opacity-70' : ''}`}
        >
          <div className="info-search-results-heading">
            <h2>
              Wyniki <span>{total}</span>
            </h2>
            <span>„{data.query}”</span>
          </div>
          {total === 0 && !allFailed ? (
            <DomainEmpty>
              Nic nie znaleźliśmy dla „{data.query}". Spróbuj krótszego słowa,
              innej formy (np. „stypendi") albo nazwy wydziału.
            </DomainEmpty>
          ) : null}

          {allFailed ? (
            <DomainError
              what="wyniki wyszukiwania"
              onRetry={() => void search.refetch()}
            />
          ) : null}

          {data.announcements.status === 'error' && !allFailed ? (
            <InfoSection
              className="info-search-result-group"
              icon={Megaphone}
              title="Komunikaty"
            >
              <DomainError
                what="komunikaty"
                onRetry={() => void search.refetch()}
              />
            </InfoSection>
          ) : counts && counts.announcements > 0 ? (
            <InfoSection
              className="info-search-result-group"
              icon={Megaphone}
              title={`Komunikaty (${counts.announcements})`}
              subtitle={
                scopeFaculty
                  ? `Tylko ${facultyShort}`
                  : 'Wszystkie wydziały, także starsze niż 30 dni'
              }
            >
              <ul className="info-search-result-list" role="list">
                {data.announcements.items.map((item) => (
                  <li key={item.id}>
                    <AnnouncementHubCard item={item} now={now} />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {data.registrations.status === 'error' && !allFailed ? (
            <InfoSection
              className="info-search-result-group"
              icon={AlarmClock}
              title="Rejestracje"
            >
              <DomainError
                what="rejestracje"
                onRetry={() => void search.refetch()}
              />
            </InfoSection>
          ) : counts && counts.registrations > 0 ? (
            <InfoSection
              className="info-search-result-group"
              icon={AlarmClock}
              title={`Rejestracje (${counts.registrations})`}
              subtitle="Trwające i nadchodzące, z USOSweb"
            >
              <ul className="info-search-result-list" role="list">
                {data.registrations.items.map((item) => (
                  <li key={item.id}>
                    <RegistrationHubCard
                      item={item}
                      now={now}
                      latestVerifiedAt={latestRegistrationRun}
                    />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {data.events.status === 'error' && !allFailed ? (
            <InfoSection
              className="info-search-result-group"
              icon={CalendarDays}
              title="Wydarzenia"
            >
              <DomainError
                what="wydarzenia"
                onRetry={() => void search.refetch()}
              />
            </InfoSection>
          ) : counts && counts.events > 0 ? (
            <InfoSection
              className="info-search-result-group"
              icon={CalendarDays}
              title={`Wydarzenia (${counts.events})`}
              subtitle="Z kalendarza uj.edu.pl (także z ostatnich 90 dni)"
            >
              <ul className="info-search-result-list" role="list">
                {data.events.items.map((item) => (
                  <li key={item.id}>
                    <EventHubCard item={item} now={now} />
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}

          {counts && counts.resources > 0 ? (
            <InfoSection
              className="info-search-result-group"
              icon={Link2}
              title={`Narzędzia (${counts.resources})`}
            >
              <ResourceGrid
                resources={data.resources}
                isAuthenticated={isAuthenticated}
                columns="sm:grid-cols-2"
              />
            </InfoSection>
          ) : null}
        </div>
      ) : null}

      {isAuthenticated ? (
        <p className="info-search-community">
          <Users size={14} aria-hidden />
          Szukasz osób, wpisów albo wiadomości z Auli?{' '}
          <Link
            to={
              input.trim()
                ? `/search?q=${encodeURIComponent(input.trim())}`
                : '/search'
            }
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
