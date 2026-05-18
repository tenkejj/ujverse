import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { History, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useContentSearch } from '../hooks/useContentSearch'
import type { SearchHit } from '../types/search'
import SearchResultRow from './search/SearchResultRow'

const HISTORY_KEY = 'ujverse_search_history_v1'
const MAX_HISTORY = 12

function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  } catch {
    return []
  }
}

function persistSearchHistory(entries: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

export default function SearchPageView() {
  const location = useLocation()
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>(readSearchHistory)
  const { results, isLoading, error } = useContentSearch(activeQuery)

  const queryFromUrl = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim() ?? '',
    [location.search],
  )

  useEffect(() => {
    setInputValue(queryFromUrl)
    setActiveQuery(queryFromUrl)
  }, [queryFromUrl])

  const pushHistory = useCallback((query: string) => {
    const normalized = query.trim()
    if (normalized.length < 2) return
    setSearchHistory((previous) => {
      const next = [normalized, ...previous.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())]
        .slice(0, MAX_HISTORY)
      persistSearchHistory(next)
      return next
    })
  }, [])

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = inputValue.trim()
    setActiveQuery(normalized)
    pushHistory(normalized)
    if (!normalized) {
      navigate('/search')
      return
    }
    navigate(`/search?q=${encodeURIComponent(normalized)}`)
  }, [inputValue, navigate, pushHistory])

  const removeHistoryItem = useCallback((entry: string) => {
    setSearchHistory((previous) => {
      const next = previous.filter((item) => item !== entry)
      persistSearchHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    persistSearchHistory([])
  }, [])

  const handleOpenResult = useCallback((result: SearchHit) => {
    if (result.type === 'post') {
      navigate(`/thread/${encodeURIComponent(result.sourceId)}`)
      return
    }
    navigate('/')
  }, [navigate])

  const handleClearInput = useCallback(() => {
    setInputValue('')
    setActiveQuery('')
    navigate('/search')
  }, [navigate])

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-4">
      <aside className="hidden lg:col-span-3 lg:block" />

      <section className="lg:col-span-6">
        <div className="mx-auto w-full max-w-3xl px-0 pt-5 md:pt-2">
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
            <label className="sr-only" htmlFor="search-page-query-input">
              Wyszukaj w UJverse
            </label>
            <div className="relative flex h-14 w-full items-center rounded-full border border-zinc-200 bg-white/80 px-5 shadow-sm transition-colors focus-within:border-zinc-300 dark:border-white/10 dark:bg-black/35 dark:focus-within:border-brand-gold-bright/45">
              <Search size={19} strokeWidth={2} className="mr-3 shrink-0 text-[#1e293b] dark:text-brand-gold-bright" />
              <input
                id="search-page-query-input"
                type="search"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Szukaj wpisów i komunikatów..."
                className="h-full min-w-0 flex-1 bg-transparent pr-8 text-[15px] text-zinc-800 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                autoComplete="off"
                spellCheck={false}
              />
              {inputValue.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="absolute right-4 flex shrink-0 items-center justify-center rounded-full p-1 text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none dark:text-zinc-500 dark:hover:text-zinc-300"
                  aria-label="Wyczyść wyszukiwanie"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>
          </form>

          <div className="mx-auto mt-8 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-white/10 dark:bg-black/25">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1e293b] dark:text-brand-gold-bright">
                Ostatnio wyszukiwane
              </h2>
              {searchHistory.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-[#1e293b] dark:hover:text-brand-gold-bright"
                >
                  Wyczyść
                </button>
              )}
            </div>

            {searchHistory.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak ostatnich wyszukiwań.</p>
            ) : (
              <ul className="flex flex-wrap gap-2.5">
                {searchHistory.map((entry) => (
                  <li key={entry}>
                    <div className="group flex items-center gap-1 rounded-full border border-zinc-200 bg-white/70 px-2 py-1 dark:border-white/10 dark:bg-black/30">
                      <button
                        type="button"
                        onClick={() => {
                          setInputValue(entry)
                          setActiveQuery(entry)
                          navigate(`/search?q=${encodeURIComponent(entry)}`)
                        }}
                        className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-zinc-700 transition-colors hover:text-[#1e293b] dark:text-zinc-300 dark:hover:text-brand-gold-bright"
                      >
                        <History size={14} strokeWidth={2} className="shrink-0" />
                        <span>{entry}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHistoryItem(entry)}
                        className="rounded-full p-1 text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
                        aria-label={`Usuń „${entry}” z historii`}
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 dark:border-white/15 dark:bg-black/20">
            {activeQuery.trim().length < 2 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Wpisz co najmniej 2 znaki, aby rozpocząć wyszukiwanie.
                </p>
              </div>
            ) : isLoading ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Szukam wyników dla „{activeQuery}”...
                </p>
              </div>
            ) : error ? (
              <div className="py-6 text-center">
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Brak wyników dla „{activeQuery}”.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {results.map((result) => (
                  <li key={result.id}>
                    <SearchResultRow result={result} onOpen={handleOpenResult} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <aside className="hidden lg:col-span-3 lg:block" />
    </div>
  )
}
