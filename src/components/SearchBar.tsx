import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  X,
  Loader2,
  UserRound,
  MessageSquareText,
  MapPin,
  Clock,
  ChevronLeft,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import type { Profile, Post } from '../types'
import { SearchService } from '../services/SearchService'
import type { SearchHit } from '../types/search'
import { getDeptAbbreviation } from '../lib/departments'
import { useEvents } from '../hooks/useEvents'
import type { UJEvent } from '../data/mockEvents'
import { ICONS_MOBILE, SEARCH_MOBILE } from '../styles/mobile-theme'
import {
  loadSearchHistory,
  pushHistoryEntry,
  removeHistoryEntry,
  clearAllHistory,
} from '../lib/searchHistory'

type Props = {
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToEvents: () => void
}

type PlaceHit = { id: string; title: string; location: string }

type SearchPostResult = Post & {
  _searchType?: SearchHit['type']
}

type Results = {
  users: Profile[]
  posts: SearchPostResult[]
  places: PlaceHit[]
}

function contentHitToPost(hit: SearchHit): SearchPostResult {
  return {
    id: hit.sourceId,
    content: hit._formatted?.content ?? hit.content,
    _searchType: hit.type,
    profiles: {
      id: hit.authorId ?? hit.sourceId,
      full_name: (hit._formatted?.author ?? hit.author) || 'Użytkownik',
      avatar_url: null,
    },
  }
}

/** Aktywna pigułka w mobilnym overlay (wpływa na zapytania). */
type MobilePill = 'all' | 'users' | 'places' | 'wpi'

const WPIA_DEPARTMENT = 'Wydział Prawa i Administracji' as const

/** Jak nagłówek „Wydziały” w sidebarze feedu. */
const crystalSectionTitleCls =
  'font-bold text-[10px] uppercase tracking-[0.2em] text-[#1e293b] dark:text-brand-gold-bright'

/** Powrót: sama ikona, cel dotykowy min. 44×44, bez ramki / tła (delikatny hover). */
const backIconBtnCls = SEARCH_MOBILE.backButtonClass

const searchSpringContent = SEARCH_MOBILE.motion.springContent

/** Wejście modala: płynny slide z dołu (Crystal Entry). */
const searchCrystalEntry = SEARCH_MOBILE.motion.overlayEntry

const searchStaggerContainer = SEARCH_MOBILE.motion.staggerContainer

/** Historia wyszukiwania: kaskada co 0,05 s. */
const historyStaggerContainer = SEARCH_MOBILE.motion.historyStaggerContainer

const searchStaggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: searchSpringContent,
  },
}

function eventMatchesPlaceQuery(ev: UJEvent, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return false
  return (
    ev.location.toLowerCase().includes(n) ||
    ev.title.toLowerCase().includes(n) ||
    ev.description.toLowerCase().includes(n)
  )
}

function pickPlaceHits(events: UJEvent[], q: string, limit: number): PlaceHit[] {
  const hits = events.filter((ev) => eventMatchesPlaceQuery(ev, q))
  return hits.slice(0, limit).map((ev) => ({
    id: ev.id,
    title: ev.title,
    location: ev.location,
  }))
}

export default function SearchBar({
  onNavigateToUser,
  onNavigateToPost,
  onNavigateToEvents,
}: Props) {
  const { allEvents } = useEvents()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>({ users: [], posts: [], places: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [mobilePill, setMobilePill] = useState<MobilePill>('all')
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const [mobileInputFocused, setMobileInputFocused] = useState(false)

  const mobileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasResults =
    results.users.length > 0 || results.posts.length > 0 || results.places.length > 0
  const searched = !isSearching && query.length >= 2

  const pushHistory = useCallback((q: string) => {
    setSearchHistory((prev) => pushHistoryEntry(prev, q))
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory(clearAllHistory())
  }, [])

  const removeHistoryItem = useCallback((entry: string) => {
    setSearchHistory((prev) => removeHistoryEntry(prev, entry))
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults({ users: [], posts: [], places: [] })
    setIsSearching(false)
  }, [])

  const closeMobileModal = useCallback(() => {
    setMobileModalOpen(false)
    setMobilePill('all')
    clearSearch()
  }, [clearSearch])

  const handleNavigateUser = useCallback(
    (userId: string) => {
      pushHistory(query)
      setMobileModalOpen(false)
      setMobilePill('all')
      clearSearch()
      onNavigateToUser(userId)
    },
    [clearSearch, onNavigateToUser, pushHistory, query],
  )

  const handleNavigatePost = useCallback(
    (postId: string) => {
      pushHistory(query)
      setMobileModalOpen(false)
      setMobilePill('all')
      clearSearch()
      onNavigateToPost(postId)
    },
    [clearSearch, onNavigateToPost, pushHistory, query],
  )

  const handleNavigateContent = useCallback(
    (post: SearchPostResult) => {
      if (post._searchType === 'komunikat') {
        pushHistory(query)
        setMobileModalOpen(false)
        setMobilePill('all')
        clearSearch()
        onNavigateToEvents()
        return
      }
      handleNavigatePost(String(post.id))
    },
    [clearSearch, handleNavigatePost, onNavigateToEvents, pushHistory, query],
  )

  const handleNavigatePlace = useCallback(() => {
    pushHistory(query)
    setMobileModalOpen(false)
    setMobilePill('all')
    clearSearch()
    onNavigateToEvents()
  }, [clearSearch, onNavigateToEvents, pushHistory, query])

  useEffect(() => {
    if (!mobileModalOpen) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [mobileModalOpen])

  useEffect(() => {
    if (!mobileModalOpen) return
    const t = window.setTimeout(() => {
      const el = mobileInputRef.current
      el?.focus({ preventScroll: true })
      el?.click()
    }, 120)
    return () => window.clearTimeout(t)
  }, [mobileModalOpen])

  // Debounced search (Meilisearch: ujverse_content + ujverse_users)
  useEffect(() => {
    if (query.length < 2) {
      setResults({ users: [], posts: [], places: [] })
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      const mode = mobileModalOpen ? mobilePill : 'all'
      const wantUsers = mode === 'all' || mode === 'users' || mode === 'wpi'
      const wantPosts = mode === 'all'
      const wantPlaces = mode === 'all' || mode === 'places'

      try {
        const { content, users } = await SearchService.searchUnified(query, {
          signal: controller.signal,
          limit: 5,
          includeContent: wantPosts,
          includeUsers: wantUsers,
          userDepartmentFilter: mode === 'wpi' ? WPIA_DEPARTMENT : undefined,
        })

        if (controller.signal.aborted) return

        if (controller.signal.aborted) return

        const places = wantPlaces ? pickPlaceHits(allEvents, query, 5) : []

        setResults({
          users: wantUsers
            ? users.map((u) => ({
                id: u.id,
                full_name: u.fullName ?? u.username ?? 'Użytkownik',
                username: u.username,
                avatar_url: u.avatarUrl,
                department: u.department,
              }))
            : [],
          posts: wantPosts ? content.map(contentHitToPost) : [],
          places,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('[SearchBar] Meilisearch search failed:', error)
        setResults({ users: [], posts: [], places: [] })
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query, mobileModalOpen, mobilePill, allEvents])

  const mobileResultRow = SEARCH_MOBILE.mobileResults.rowClass

  const crystalHistorySection = (sectionClassName: string, focusInput: () => void) => (
    <section className={sectionClassName}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={crystalSectionTitleCls}>Ostatnio wyszukiwane</h3>
        {searchHistory.length > 0 && (
          <motion.button
            type="button"
            onClick={clearHistory}
            whileTap={{ scale: 0.97 }}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-[#1e293b] dark:hover:text-brand-gold-bright"
          >
            Wyczyść
          </motion.button>
        )}
      </div>
      {searchHistory.length === 0 ? (
        <motion.p
          className="text-[14px] text-slate-500 dark:text-slate-500"
          variants={searchStaggerItem}
          initial="hidden"
          animate="show"
        >
          Brak ostatnich wyszukiwań.
        </motion.p>
      ) : (
        <motion.ul
          className="flex flex-col"
          variants={historyStaggerContainer}
          initial="hidden"
          animate="show"
        >
          {searchHistory.map((h) => (
            <motion.li key={h} variants={searchStaggerItem}>
              <div className="group flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                <motion.button
                  type="button"
                  onClick={() => {
                    setQuery(h)
                    window.setTimeout(focusInput, 0)
                  }}
                  whileTap={{ scale: 0.99 }}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-1 pr-0 text-left [-webkit-tap-highlight-color:transparent]"
                >
                  <Clock size={15} strokeWidth={2} className="shrink-0 text-[#1e293b] dark:text-brand-gold-bright" aria-hidden />
                  <span className="truncate text-[15px] text-fg-primary dark:text-white">{h}</span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeHistoryItem(h)
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="shrink-0 rounded-md p-2 text-slate-500 transition-colors duration-200 hover:text-slate-300 [-webkit-tap-highlight-color:transparent]"
                  aria-label={`Usuń „${h}” z historii`}
                >
                  <X size={16} strokeWidth={2} aria-hidden />
                </motion.button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  )

  const resultsContentMobile = () => {
    const tTitle = 'text-uj-navy dark:text-slate-200'
    const tMuted = 'text-slate-600 dark:text-slate-400'
    const tHint = 'text-slate-600 dark:text-slate-500'
    const tQuote = 'text-uj-navy dark:text-slate-300'
    const sectionIconCls = 'text-[#1e293b] dark:text-brand-gold-bright shrink-0'
    const sectionDivider = 'border-border-app'

    return (
      <motion.div
        variants={searchStaggerContainer}
        initial="hidden"
        animate="show"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isSearching && (
          <motion.div
            variants={searchStaggerItem}
            className={`${SEARCH_MOBILE.mobileResults.searchingClass} ${tMuted}`}
          >
            <Loader2
              size={ICONS_MOBILE.searchSectionIconSize}
              className="animate-spin text-[#1e293b] dark:text-brand-gold-bright shrink-0"
            />
            Szukam…
          </motion.div>
        )}

        {!isSearching && query.length === 1 && (
          <motion.div variants={searchStaggerItem} className={`${SEARCH_MOBILE.mobileResults.shortHintClass} ${tHint}`}>
            Wpisz co najmniej 2 znaki…
          </motion.div>
        )}

        {!isSearching && searched && !hasResults && (
          <motion.div variants={searchStaggerItem} className={`${SEARCH_MOBILE.mobileResults.emptyClass} ${tHint}`}>
            Brak wyników dla <span className={`font-semibold ${tQuote}`}>"{query}"</span>
          </motion.div>
        )}

        {!isSearching && results.users.length > 0 && (
          <motion.div className={SEARCH_MOBILE.mobileResults.sectionWrapperClass} variants={searchStaggerItem}>
            <div
              className={`${SEARCH_MOBILE.mobileResults.sectionTitleClass} ${tHint}`}
            >
              <UserRound
                size={ICONS_MOBILE.searchSectionIconSize}
                strokeWidth={ICONS_MOBILE.searchSectionIconStrokeWidth}
                className={sectionIconCls}
                aria-hidden
              />
              Użytkownicy
            </div>
            <motion.div variants={searchStaggerContainer} initial="hidden" animate="show">
            {results.users.map((user) => (
              <motion.button
                key={user.id}
                type="button"
                variants={searchStaggerItem}
                onClick={() => handleNavigateUser(user.id)}
                whileTap={{ scale: SEARCH_MOBILE.mobileResults.tapScale }}
                className={mobileResultRow}
              >
                <UserRound
                  size={ICONS_MOBILE.searchResultIconSize}
                  strokeWidth={ICONS_MOBILE.searchResultIconStrokeWidth}
                  className="shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold truncate ${tTitle}`}>
                    {user.full_name ?? 'Użytkownik'}
                  </span>
                  {user.department && (
                    <span className={`block text-xs truncate mt-0.5 ${tHint}`}>
                      {getDeptAbbreviation(user.department)}
                    </span>
                  )}
                </span>
              </motion.button>
            ))}
            </motion.div>
          </motion.div>
        )}

        {!isSearching && results.posts.length > 0 && (
          <motion.div
            variants={searchStaggerItem}
            className={`${SEARCH_MOBILE.mobileResults.sectionSecondaryWrapperClass} ${
              results.users.length > 0 ? `mt-1 border-t ${sectionDivider} pt-2` : 'pt-2'
            }`}
          >
            <div
              className={`${SEARCH_MOBILE.mobileResults.sectionTitleClass} ${tHint}`}
            >
              <MessageSquareText
                size={ICONS_MOBILE.searchSectionIconSize}
                strokeWidth={ICONS_MOBILE.searchSectionIconStrokeWidth}
                className={sectionIconCls}
                aria-hidden
              />
              Wpisy
            </div>
            <motion.div variants={searchStaggerContainer} initial="hidden" animate="show">
            {results.posts.map((post) => {
              const postId = String(post.id)
              const author = post.profiles
              const authorName = author?.full_name ?? 'Użytkownik'
              return (
                <motion.button
                  key={postId}
                  type="button"
                  variants={searchStaggerItem}
                  onClick={() => handleNavigateContent(post)}
                  whileTap={{ scale: SEARCH_MOBILE.mobileResults.tapScale }}
                  className={mobileResultRow}
                >
                  <MessageSquareText
                    size={ICONS_MOBILE.searchResultIconSize}
                    strokeWidth={ICONS_MOBILE.searchResultIconStrokeWidth}
                    className="shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${tTitle}`}>{authorName}</span>
                    <span className={`block text-sm line-clamp-1 mt-0.5 ${tMuted}`}>{post.content ?? ''}</span>
                  </span>
                </motion.button>
              )
            })}
            </motion.div>
          </motion.div>
        )}

        {!isSearching && results.places.length > 0 && (
          <motion.div
            variants={searchStaggerItem}
            className={`${SEARCH_MOBILE.mobileResults.sectionSecondaryWrapperClass} ${
              results.users.length > 0 || results.posts.length > 0
                ? `mt-1 border-t ${sectionDivider} pt-2`
                : 'pt-2'
            }`}
          >
            <div
              className={`${SEARCH_MOBILE.mobileResults.sectionTitleClass} ${tHint}`}
            >
              <MapPin
                size={ICONS_MOBILE.searchSectionIconSize}
                strokeWidth={ICONS_MOBILE.searchSectionIconStrokeWidth}
                className={sectionIconCls}
                aria-hidden
              />
              Miejsca
            </div>
            <motion.div variants={searchStaggerContainer} initial="hidden" animate="show">
            {results.places.map((place) => (
                <motion.button
                  key={place.id}
                  type="button"
                  variants={searchStaggerItem}
                  onClick={handleNavigatePlace}
                  whileTap={{ scale: SEARCH_MOBILE.mobileResults.tapScale }}
                  className={mobileResultRow}
                >
                  <MapPin
                    size={ICONS_MOBILE.searchResultIconSize}
                    strokeWidth={ICONS_MOBILE.searchResultIconStrokeWidth}
                    className="shrink-0 text-slate-400 dark:text-slate-500"
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${tTitle}`}>
                      {place.location.trim() || place.title}
                    </span>
                    <span className={`block text-xs line-clamp-1 mt-0.5 ${tHint}`}>
                      {place.location.trim() && place.title !== place.location.trim() ? place.title : 'Wydarzenie'}
                    </span>
                  </span>
                </motion.button>
            ))}
            </motion.div>
          </motion.div>
        )}

        <div className={SEARCH_MOBILE.mobileResults.bottomSpacerClass} />
      </motion.div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative flex shrink-0 items-center md:hidden">
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className={SEARCH_MOBILE.triggerButtonClass}
          aria-label="Szukaj"
        >
          <Search
            size={ICONS_MOBILE.searchTriggerSize}
            strokeWidth={ICONS_MOBILE.searchInputIconStrokeWidth}
            className={`shrink-0 ${ICONS_MOBILE.strongStrokeClass}`}
          />
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {mobileModalOpen && (
            <motion.div
              key="mobile-search-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Wyszukiwanie"
              className={SEARCH_MOBILE.mobileOverlayClass}
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <motion.div
                className={SEARCH_MOBILE.mobileOverlayContainerClass}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={searchCrystalEntry}
              >
                <div className={SEARCH_MOBILE.mobileHeaderRowClass}>
                  <motion.button
                    type="button"
                    onClick={closeMobileModal}
                    whileTap={{ scale: 0.96 }}
                    className={backIconBtnCls}
                    aria-label="Wróć do feedu"
                  >
                    <ChevronLeft
                      size={ICONS_MOBILE.searchBackIconSize}
                      strokeWidth={ICONS_MOBILE.searchBackIconStrokeWidth}
                      className="h-6 w-6 shrink-0"
                      aria-hidden
                    />
                  </motion.button>
                  <div className="relative min-w-0 flex-1 rounded-2xl">
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute -inset-[1px] z-0 rounded-2xl border-2 border-[#1e293b] dark:border-brand-gold-bright"
                      initial={false}
                      animate={{
                        opacity: mobileInputFocused ? 1 : 0,
                        scale: mobileInputFocused ? 1 : 0.992,
                      }}
                      transition={searchSpringContent}
                    />
                    <Search
                      size={ICONS_MOBILE.searchInputIconSize}
                      strokeWidth={ICONS_MOBILE.searchInputIconStrokeWidth}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-[2] -translate-y-1/2 text-[#1e293b] dark:text-brand-gold-bright"
                    />
                    <input
                      ref={mobileInputRef}
                      type="search"
                      name="ujverse-mobile-search"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="search"
                      inputMode="search"
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeMobileModal()
                      }}
                      onFocus={() => setMobileInputFocused(true)}
                      onBlur={() => setMobileInputFocused(false)}
                      placeholder="Szukaj…"
                      className={SEARCH_MOBILE.mobileInputClass}
                    />
                  </div>
                </div>

                <div className={SEARCH_MOBILE.mobilePillsWrapperClass}>
                  <LayoutGroup>
                    <nav
                      className={SEARCH_MOBILE.mobilePillsNavClass}
                      role="tablist"
                      aria-label="Zakres wyszukiwania"
                    >
                      {(
                        [
                          { id: 'all' as const, label: 'Wszystko' },
                          { id: 'users' as const, label: 'Ludzie' },
                          {
                            id: 'events' as const,
                            label: 'Wydarzenia',
                            action: 'navigate-events' as const,
                          },
                          { id: 'places' as const, label: 'Miejsca' },
                          { id: 'wpi' as const, label: 'WP' },
                        ] as const
                      ).map((pill) => {
                        const isActive = pill.id !== 'events' && mobilePill === pill.id
                        const tabBase = SEARCH_MOBILE.mobilePillTabBaseClass
                        const tabInactive =
                          'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        const tabActive = 'text-logo-navy dark:text-slate-100'
                        if (pill.id === 'events') {
                          return (
                            <button
                              key={pill.id}
                              type="button"
                              role="tab"
                              className={`${tabBase} ${tabInactive}`}
                              onClick={() => {
                                closeMobileModal()
                                onNavigateToEvents()
                              }}
                            >
                              {pill.label}
                            </button>
                          )
                        }
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`${tabBase} ${isActive ? tabActive : tabInactive}`}
                            onClick={() => {
                              setMobilePill(pill.id)
                              setTimeout(() => mobileInputRef.current?.focus(), 0)
                            }}
                          >
                            {pill.label}
                            {isActive && (
                              <motion.span
                                layoutId="searchMobileTabIndicator"
                                className={SEARCH_MOBILE.mobilePillIndicatorClass}
                                transition={searchSpringContent}
                              />
                            )}
                          </button>
                        )
                      })}
                    </nav>
                  </LayoutGroup>
                </div>

                <div className={SEARCH_MOBILE.mobileResultsScrollClass}>
                  {query.length === 0 &&
                    crystalHistorySection(SEARCH_MOBILE.mobileHistorySectionClass, () => {
                      mobileInputRef.current?.focus({ preventScroll: true })
                    })}

                  <AnimatePresence mode="wait">
                    {query.length > 0 && (
                      <motion.div
                        key={`results-${query}-${mobilePill}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className={SEARCH_MOBILE.mobileResultsWrapperClass}
                      >
                        {resultsContentMobile()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
