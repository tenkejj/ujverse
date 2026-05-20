import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, History, LayoutGrid, Megaphone, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useContentSearch } from '../hooks/useContentSearch'
import type { SearchHit } from '../types/search'
import SearchResultRow from './search/SearchResultRow'
import {
  loadSearchHistory,
  pushHistoryEntry,
  removeHistoryEntry,
  clearAllHistory,
} from '../lib/searchHistory'

type SearchFilter = 'all' | 'post' | 'komunikat'

const FILTER_TABS: ReadonlyArray<{
  id: SearchFilter
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'all', label: 'Wszystko', icon: LayoutGrid },
  { id: 'post', label: 'Posty', icon: FileText },
  { id: 'komunikat', label: 'Komunikaty', icon: Megaphone },
]

export default function SearchPageView() {
  const location = useLocation()
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all')
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const { results, isLoading, error } = useContentSearch(activeQuery)
  console.log("🔍 [SearchPageView] Aktywne zapytanie:", activeQuery, "Wyniki z Meilisearch:", results);

  const queryFromUrl = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim() ?? '',
    [location.search],
  )

  useEffect(() => {
    setInputValue(queryFromUrl)
    setActiveQuery(queryFromUrl)
    setActiveFilter('all')
  }, [queryFromUrl])

  const resultCounts = useMemo<Record<SearchFilter, number>>(() => ({
    all: results.length,
    post: results.filter((result) => result.type === 'post').length,
    komunikat: results.filter((result) => result.type === 'komunikat').length,
  }), [results])

  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results
    return results.filter((result) => result.type === activeFilter)
  }, [activeFilter, results])

  const activeTab = useMemo(
    () => FILTER_TABS.find((tab) => tab.id === activeFilter) ?? FILTER_TABS[0],
    [activeFilter],
  )
  const ActiveTabIcon = activeTab.icon

  const suggestedFilter = useMemo<'post' | 'komunikat' | null>(() => {
    const candidates = (['post', 'komunikat'] as const)
      .filter((tabId) => tabId !== activeFilter && resultCounts[tabId] > 0)
      .sort((left, right) => resultCounts[right] - resultCounts[left])

    return candidates[0] ?? null
  }, [activeFilter, resultCounts])
  const suggestedTab = useMemo(
    () => (suggestedFilter ? FILTER_TABS.find((tab) => tab.id === suggestedFilter) ?? null : null),
    [suggestedFilter],
  )

  const pushHistory = useCallback((query: string) => {
    setSearchHistory((previous) => pushHistoryEntry(previous, query))
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
    setSearchHistory((previous) => removeHistoryEntry(previous, entry))
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory(clearAllHistory())
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

          {activeQuery.trim().length >= 2 && results.length > 0 && (
            <div className="mx-auto mt-5 w-full max-w-2xl">
              <div
                role="tablist"
                aria-label="Filtr wyników wyszukiwania"
                className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {FILTER_TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeFilter === tab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveFilter(tab.id)}
                      className={
                        'group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 ' +
                        'text-sm font-semibold tracking-[0.01em] transition-all duration-200 ' +
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ' +
                        'focus-visible:ring-[#1e293b]/40 dark:focus-visible:ring-brand-gold-bright/45 ' +
                        (isActive
                          ? 'border-[#1e293b]/45 bg-[#1e293b]/10 text-[#1e293b] ' +
                            'shadow-[inset_0_0_0_1px_rgba(30,41,59,0.08)] ' +
                            'dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright ' +
                            'dark:shadow-[0_0_18px_-8px_rgba(232,200,74,0.45),inset_0_0_0_1px_rgba(232,200,74,0.18)]'
                          : 'border-zinc-200 bg-white/60 text-zinc-600 ' +
                            'hover:border-zinc-300 hover:bg-white/80 hover:text-[#1e293b] ' +
                            'dark:border-white/10 dark:bg-black/25 dark:text-zinc-400 ' +
                            'dark:hover:border-white/20 dark:hover:bg-black/40 dark:hover:text-brand-gold-bright')
                      }
                    >
                      <Icon size={15} strokeWidth={2} className="shrink-0" />
                      <span>{tab.label}</span>
                      <span
                        className={
                          'ml-1 inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 ' +
                          'text-[10px] font-bold tabular-nums leading-none ' +
                          (isActive
                            ? 'bg-[#1e293b]/15 text-[#1e293b] dark:bg-brand-gold-bright/20 dark:text-brand-gold-bright'
                            : 'bg-zinc-200/70 text-zinc-600 dark:bg-white/10 dark:text-zinc-300')
                        }
                      >
                        {resultCounts[tab.id]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
            ) : filteredResults.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white/70 text-zinc-400 dark:border-white/10 dark:bg-black/30 dark:text-zinc-500">
                  <ActiveTabIcon size={22} strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Brak wyników w kategorii „{activeTab.label}”.
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Dla frazy „{activeQuery}” nie znaleziono nic w tej kategorii.
                </p>
                {suggestedFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveFilter(suggestedFilter)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#1e293b]/45 bg-[#1e293b]/10 px-4 py-2 text-xs font-semibold text-[#1e293b] transition-colors hover:bg-[#1e293b]/15 dark:border-brand-gold-bright/45 dark:bg-brand-gold-bright/10 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/20"
                  >
                    Pokaż {suggestedTab?.label.toLowerCase()} ({resultCounts[suggestedFilter]})
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredResults.map((result) => (
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
