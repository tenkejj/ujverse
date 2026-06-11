import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import { DataService } from '../services/DataService'
import { SearchService } from '../services/SearchService'
import type { EventMeta, UnifiedContent } from '../types/content'
import { useTheme } from '../ThemeContext'
import { parseSearchCommand, type ParsedCommand } from '../lib/searchCommands'
import { parseTagSearchQuery } from '../lib/postTags'
import {
  loadSearchHistory,
  pushHistoryEntry,
  removeHistoryEntry,
  clearAllHistory,
  RECENT_VISIBLE,
} from '../lib/searchHistory'
import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'

/** Wyniki dropdowna OmniSearchHub. Każda sekcja max 5 pozycji. */
export type OmniResults = {
  profiles: SearchUserHit[]
  posts: SearchHit[]
  announcements: SearchHit[]
  events: UnifiedContent<EventMeta>[]
  aula: AulaSearchHit[]
}

type CacheEntry = { results: OmniResults; expiresAt: number }

const EMPTY_RESULTS: OmniResults = {
  profiles: [],
  posts: [],
  announcements: [],
  events: [],
  aula: [],
}
const SECTION_LIMIT = 5
const DEBOUNCE_MS = 180
const CACHE_TTL_MS = 120_000
const DESKTOP_MEDIA_QUERY = '(min-width: 768px)'

export type OmniSearchHandlers = {
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToEvents: (openEventId?: string) => void
  onNavigateToSearch: (query?: string) => void
  /** Klik w wynik Auli — App.tsx routes na `/aula?message=<id>`. */
  onNavigateToAulaMessage?: (messageId: number) => void
}

export type UseOmniSearchOptions = OmniSearchHandlers & {
  inputRef: RefObject<HTMLInputElement | null>
  /** Cohort zalogowanego usera — bez tego sekcja "Aula" jest wyłączona. */
  cohortId?: string | null
}

export type UseOmniSearchReturn = {
  query: string
  setQuery: (next: string) => void
  parsed: ParsedCommand
  isOpen: boolean
  open: () => void
  close: () => void
  activeIndex: number
  setActiveIndex: (next: number) => void
  results: OmniResults
  isLoading: boolean
  error: string | null
  totalCount: number
  hasResults: boolean
  searched: boolean
  history: string[]
  removeHistoryItem: (entry: string) => void
  clearHistory: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  /** Wpisuje frazę do inputu i odpala focus (np. klik chipa / historii). */
  applyQuery: (next: string) => void
  /** Przejście na /search — czyści input i zamyka dropdown (Enter bez wiersza / stopka). */
  submitFullSearch: (overrideQuery?: string) => void
  /** Otwiera highlight dla wskazanego flat-index (nav klawiaturowa zawsze przez setActiveIndex). */
  /** Stabilny rejestr setterów ref dla wierszy (scroll-into-view aktywnego). */
  registerRow: (index: number, node: HTMLElement | null) => void
}

function shouldIgnoreHotkeyTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * useOmniSearch — centralna logika OmniSearchHub v2.
 *
 *  SYSTEM 1: debounce 180 ms → SearchService.searchUnified (limit 5 per sekcja)
 *  SYSTEM 2: globalny listener Ctrl/Cmd+K (md:+) + klawiatura w panelu
 *  SYSTEM 3: smart hints — sygnalizowany przez `searched && !hasResults`
 *  SYSTEM 4: ostatnie wyszukiwania (RECENT_VISIBLE z localStorage)
 *  SYSTEM 5: parseSearchCommand (/p, /k, /ciemny, /jasny) + instant theme toggle
 *  SYSTEM 6: AbortController per zapytanie + cache Map 120 s
 */
export function useOmniSearch(opts: UseOmniSearchOptions): UseOmniSearchReturn {
  const {
    inputRef,
    cohortId,
    onNavigateToUser,
    onNavigateToPost,
    onNavigateToEvents,
    onNavigateToSearch,
    onNavigateToAulaMessage,
  } = opts
  const { theme, toggleTheme } = useTheme()

  const [query, setQueryRaw] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [results, setResults] = useState<OmniResults>(EMPTY_RESULTS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>(loadSearchHistory)
  /** Flag wskazujący że ostatnie zapytanie zakończyło się (do `searched`). */
  const [lastSearchedKey, setLastSearchedKey] = useState<string | null>(null)

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const controllerRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<number | null>(null)
  const activeIndexRef = useRef(-1)
  const rowRefsRef = useRef<Map<number, HTMLElement>>(new Map())

  const parsed = useMemo<ParsedCommand>(() => parseSearchCommand(query), [query])

  const setQuery = useCallback((next: string) => {
    setQueryRaw(next)
    setActiveIndex(-1)
    setError(null)
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => {
    setIsOpen(false)
    setActiveIndex(-1)
  }, [])

  const applyQuery = useCallback(
    (next: string) => {
      setQueryRaw(next)
      setActiveIndex(-1)
      setError(null)
      setIsOpen(true)
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0)
    },
    [inputRef],
  )

  const removeHistoryItem = useCallback((entry: string) => {
    setHistory((prev) => removeHistoryEntry(prev, entry))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory(clearAllHistory())
  }, [])

  const pushToHistory = useCallback((q: string) => {
    setHistory((prev) => pushHistoryEntry(prev, q))
  }, [])

  const registerRow = useCallback((index: number, node: HTMLElement | null) => {
    if (node) rowRefsRef.current.set(index, node)
    else rowRefsRef.current.delete(index)
  }, [])

  useEffect(() => {
    activeIndexRef.current = activeIndex
    if (activeIndex < 0) return
    const node = rowRefsRef.current.get(activeIndex)
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex])

  useEffect(() => {
    if (!parsed.action) return
    if (parsed.action === 'theme-dark' && theme !== 'dark') toggleTheme()
    if (parsed.action === 'theme-light' && theme !== 'light') toggleTheme()
    setQueryRaw('')
    setIsOpen(false)
    setActiveIndex(-1)
    window.setTimeout(() => inputRef.current?.blur(), 0)
  }, [parsed.action, theme, toggleTheme, inputRef])

  useEffect(() => {
    if (parsed.action) return

    const q = parsed.stripped.trim()
    const { tag: tagFilter } = parseTagSearchQuery(q)
    if (!tagFilter && q.length < 2) {
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      setError(null)
      setLastSearchedKey(null)
      controllerRef.current?.abort()
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      return
    }

    const cacheKey = `${parsed.mode}:${q.toLowerCase()}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      setResults(cached.results)
      setIsLoading(false)
      setError(null)
      setLastSearchedKey(cacheKey)
      return
    }

    controllerRef.current?.abort()
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current)

    const controller = new AbortController()
    controllerRef.current = controller
    const { signal } = controller

    setIsLoading(true)
    setError(null)

    debounceRef.current = window.setTimeout(async () => {
      const wantEvents = parsed.mode === 'all'
      const wantAula = parsed.mode === 'all' && Boolean(cohortId)

      try {
        const [meiliResponse, eventRows, aulaResult] = await Promise.all([
          SearchService.searchUnified(q, {
            signal,
            limit: SECTION_LIMIT,
            includeContent: parsed.mode !== 'profiles',
            includeUsers: tagFilter ? false : parsed.mode !== 'komunikaty',
            tag: tagFilter ?? undefined,
          }),
          wantEvents
            ? DataService.searchEvents(q, { limit: SECTION_LIMIT }).catch(() => [])
            : Promise.resolve([]),
          wantAula && cohortId
            ? SearchService.searchAula(q, {
                cohortId,
                limit: SECTION_LIMIT,
                signal,
              }).catch(() => ({ hits: [], estimatedTotalHits: 0 }))
            : Promise.resolve({ hits: [], estimatedTotalHits: 0 }),
        ])

        if (signal.aborted) return

        const { content, users } = meiliResponse

        const profiles = parsed.mode === 'komunikaty' ? [] : users.slice(0, SECTION_LIMIT)
        const posts =
          parsed.mode === 'profiles'
            ? []
            : content.filter((c) => c.type === 'post').slice(0, SECTION_LIMIT)
        const announcements =
          parsed.mode === 'profiles'
            ? []
            : content.filter((c) => c.type === 'komunikat').slice(0, SECTION_LIMIT)
        const events = wantEvents ? eventRows.slice(0, SECTION_LIMIT) : []
        const aula = wantAula ? aulaResult.hits.slice(0, SECTION_LIMIT) : []

        const next: OmniResults = { profiles, posts, announcements, events, aula }
        cacheRef.current.set(cacheKey, { results: next, expiresAt: Date.now() + CACHE_TTL_MS })
        setResults(next)
        setLastSearchedKey(cacheKey)
      } catch (err) {
        if (signal.aborted) return
        setResults(EMPTY_RESULTS)
        setError(err instanceof Error ? err.message : 'Błąd wyszukiwania')
        setLastSearchedKey(cacheKey)
      } finally {
        if (!signal.aborted) setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [parsed.action, parsed.mode, parsed.stripped, cohortId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(DESKTOP_MEDIA_QUERY)

    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== 'k') return
      if (!mq.matches) return

      const active = document.activeElement
      if (active === inputRef.current) {
        event.preventDefault()
        return
      }
      if (shouldIgnoreHotkeyTarget(active)) return

      event.preventDefault()
      setIsOpen(true)
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputRef])

  const totalCount =
    results.profiles.length +
    results.posts.length +
    results.announcements.length +
    results.events.length +
    results.aula.length
  const hasResults = totalCount > 0

  const searched = useMemo(() => {
    if (parsed.action) return false
    const q = parsed.stripped.trim()
    if (q.length < 2) return false
    if (isLoading) return false
    const key = `${parsed.mode}:${q.toLowerCase()}`
    return lastSearchedKey === key
  }, [parsed.action, parsed.mode, parsed.stripped, isLoading, lastSearchedKey])

  const activateAtIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= totalCount) return
      let cursor = 0

      for (const profile of results.profiles) {
        if (cursor === idx) {
          pushToHistory(query)
          setIsOpen(false)
          setActiveIndex(-1)
          onNavigateToUser(profile.id)
          return
        }
        cursor++
      }
      for (const post of results.posts) {
        if (cursor === idx) {
          pushToHistory(query)
          setIsOpen(false)
          setActiveIndex(-1)
          onNavigateToPost(post.sourceId)
          return
        }
        cursor++
      }
      for (let i = 0; i < results.announcements.length; i++) {
        if (cursor === idx) {
          pushToHistory(query)
          setIsOpen(false)
          setActiveIndex(-1)
          onNavigateToEvents()
          return
        }
        cursor++
      }
      for (const event of results.events) {
        if (cursor === idx) {
          pushToHistory(query)
          setIsOpen(false)
          setActiveIndex(-1)
          onNavigateToEvents(event.id)
          return
        }
        cursor++
      }
      for (const aulaHit of results.aula) {
        if (cursor === idx) {
          pushToHistory(query)
          setIsOpen(false)
          setActiveIndex(-1)
          onNavigateToAulaMessage?.(aulaHit.messageId)
          return
        }
        cursor++
      }
    },
    [
      results.profiles,
      results.posts,
      results.announcements,
      results.events,
      results.aula,
      totalCount,
      pushToHistory,
      query,
      onNavigateToUser,
      onNavigateToPost,
      onNavigateToEvents,
      onNavigateToAulaMessage,
    ],
  )

  const submitFullSearch = useCallback(
    (overrideQuery?: string) => {
      const q = (overrideQuery ?? query).trim()
      if (q.length < 2) return
      pushToHistory(q)
      onNavigateToSearch(q)
      setQueryRaw('')
      setIsOpen(false)
      setActiveIndex(-1)
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
      setError(null)
      setLastSearchedKey(null)
      controllerRef.current?.abort()
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    },
    [query, pushToHistory, onNavigateToSearch],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        inputRef.current?.blur()
        return
      }

      if (event.key === 'Enter') {
        const hi = activeIndexRef.current
        if (hi >= 0 && hi < totalCount) {
          event.preventDefault()
          activateAtIndex(hi)
          return
        }
        if (query.trim().length >= 2) {
          event.preventDefault()
          submitFullSearch()
        }
        return
      }

      if (totalCount === 0 || isLoading) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex(activeIndexRef.current < 0 ? 0 : (activeIndexRef.current + 1) % totalCount)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex(
          activeIndexRef.current < 0
            ? totalCount - 1
            : (activeIndexRef.current - 1 + totalCount) % totalCount,
        )
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(totalCount - 1)
      }
    },
    [activateAtIndex, close, inputRef, isLoading, query, submitFullSearch, totalCount],
  )

  return {
    query,
    setQuery,
    parsed,
    isOpen,
    open,
    close,
    activeIndex,
    setActiveIndex,
    results,
    isLoading,
    error,
    totalCount,
    hasResults,
    searched,
    history: history.slice(0, RECENT_VISIBLE),
    removeHistoryItem,
    clearHistory,
    onKeyDown,
    applyQuery,
    submitFullSearch,
    registerRow,
  }
}
