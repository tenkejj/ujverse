import { useRef, useState, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
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
import { supabase } from '../supabaseClient'
import type { Profile, Post } from '../types'
import UserAvatar from './UserAvatar'
import { getDeptAbbreviation } from '../lib/departments'
import { useEvents } from '../hooks/useEvents'
import type { UJEvent } from '../data/mockEvents'

type Props = {
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToEvents: () => void
}

type PlaceHit = { id: string; title: string; location: string }

type Results = {
  users: Profile[]
  posts: Post[]
  places: PlaceHit[]
}

/** Aktywna pigułka w mobilnym overlay (wpływa na zapytania). */
type MobilePill = 'all' | 'users' | 'places' | 'wpi'

const WPIA_DEPARTMENT = 'Wydział Prawa i Administracji' as const

const HISTORY_KEY = 'ujverse_search_history_v1'
const MAX_HISTORY = 12

/** Jak nagłówek „Wydziały” w sidebarze feedu. */
const crystalSectionTitleCls =
  'font-bold text-[10px] uppercase tracking-[0.2em] text-brand-gold dark:text-brand-gold-bright'

/** Ramka i promień jak karta postu (PostCard, variant card). */
const searchResultPanelCls =
  'rounded-2xl border border-[#0f172a]/5 dark:border-white/10 bg-transparent shadow-sm dark:shadow-lg dark:shadow-black/25'

/** Powrót: sama ikona, cel dotykowy min. 44×44, bez ramki / tła (delikatny hover). */
const backIconBtnCls =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-gold transition-colors duration-200 hover:bg-black/[0.06] dark:text-brand-gold-bright dark:hover:bg-white/[0.06] [-webkit-tap-highlight-color:transparent]'

const searchSpringContent = { type: 'spring' as const, stiffness: 300, damping: 30 }

/** Wejście modala: płynny slide z dołu (Crystal Entry). */
const searchCrystalEntry = { duration: 0.4, ease: 'easeOut' as const }

const searchStaggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

/** Historia wyszukiwania: kaskada co 0,05 s. */
const historyStaggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0 },
  },
}

const searchStaggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: searchSpringContent,
  },
}

function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX_HISTORY)
  } catch {
    return []
  }
}

function saveSearchHistory(entries: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch {
    /* ignore */
  }
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

function shouldIgnoreSearchHotkeyTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return false
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
  const [desktopOverlayOpen, setDesktopOverlayOpen] = useState(false)
  const [mobilePill, setMobilePill] = useState<MobilePill>('all')
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [desktopInputFocused, setDesktopInputFocused] = useState(false)
  const [mobileInputFocused, setMobileInputFocused] = useState(false)

  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightIndexRef = useRef(-1)

  const hasResults =
    results.users.length > 0 || results.posts.length > 0 || results.places.length > 0
  const searched = !isSearching && query.length >= 2
  const resultCount = results.users.length + results.posts.length + results.places.length

  const pushHistory = useCallback((q: string) => {
    const t = q.trim()
    if (t.length < 2) return
    setSearchHistory((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_HISTORY)
      saveSearchHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setSearchHistory([])
    saveSearchHistory([])
  }, [])

  const removeHistoryItem = useCallback((entry: string) => {
    setSearchHistory((prev) => {
      const next = prev.filter((x) => x !== entry)
      saveSearchHistory(next)
      return next
    })
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults({ users: [], posts: [], places: [] })
    setIsSearching(false)
    setHighlightIndex(-1)
  }, [])

  const closeMobileModal = useCallback(() => {
    setMobileModalOpen(false)
    setMobilePill('all')
    clearSearch()
  }, [clearSearch])

  const closeDesktopOverlay = useCallback(() => {
    setDesktopOverlayOpen(false)
    clearSearch()
  }, [clearSearch])

  const handleNavigateUser = useCallback(
    (userId: string) => {
      pushHistory(query)
      setMobileModalOpen(false)
      setDesktopOverlayOpen(false)
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
      setDesktopOverlayOpen(false)
      setMobilePill('all')
      clearSearch()
      onNavigateToPost(postId)
    },
    [clearSearch, onNavigateToPost, pushHistory, query],
  )

  const handleNavigatePlace = useCallback(() => {
    pushHistory(query)
    setMobileModalOpen(false)
    setDesktopOverlayOpen(false)
    setMobilePill('all')
    clearSearch()
    onNavigateToEvents()
  }, [clearSearch, onNavigateToEvents, pushHistory, query])

  // Ctrl/Cmd+K — otwiera paletę (pomija pola formularzy poza naszym inputem)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      const active = document.activeElement
      if (active === desktopInputRef.current) {
        e.preventDefault()
        return
      }
      if (shouldIgnoreSearchHotkeyTarget(active)) return
      e.preventDefault()
      if (desktopOverlayOpen) {
        desktopInputRef.current?.focus({ preventScroll: true })
        return
      }
      setDesktopOverlayOpen(true)
      window.setTimeout(() => {
        desktopInputRef.current?.focus({ preventScroll: true })
      }, 80)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktopOverlayOpen])

  // Focus desktop input when overlay opens
  useEffect(() => {
    if (!desktopOverlayOpen) return
    const t = window.setTimeout(() => {
      desktopInputRef.current?.focus({ preventScroll: true })
    }, 120)
    return () => window.clearTimeout(t)
  }, [desktopOverlayOpen])

  // Blokada scrolla pod overlayem (body + html)
  useEffect(() => {
    if (!mobileModalOpen && !desktopOverlayOpen) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [mobileModalOpen, desktopOverlayOpen])

  // Focus mobile input when modal opens
  useEffect(() => {
    if (!mobileModalOpen) return
    const t = window.setTimeout(() => {
      const el = mobileInputRef.current
      el?.focus({ preventScroll: true })
      el?.click()
    }, 120)
    return () => window.clearTimeout(t)
  }, [mobileModalOpen])

  // Reset podświetlenia przy nowym zapytaniu / wynikach
  useEffect(() => {
    setHighlightIndex(-1)
  }, [query, results.users, results.posts, results.places, isSearching])

  useEffect(() => {
    highlightIndexRef.current = highlightIndex
  }, [highlightIndex])

  // Przewiń do aktywnego wyniku
  useEffect(() => {
    if (!desktopOverlayOpen || highlightIndex < 0) return
    const el = document.querySelector(`[data-search-result-index="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightIndex, desktopOverlayOpen])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ users: [], posts: [], places: [] })
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    const timer = window.setTimeout(async () => {
      const mode = mobileModalOpen ? mobilePill : 'all'
      const wantUsers = mode === 'all' || mode === 'users' || mode === 'wpi'
      const wantPosts = mode === 'all'
      const wantPlaces = mode === 'all' || mode === 'places'

      const usersP = wantUsers
        ? (() => {
            let qb = supabase
              .from('profiles')
              .select('id, full_name, avatar_url, department')
              .ilike('full_name', `%${query}%`)
            if (mode === 'wpi') qb = qb.eq('department', WPIA_DEPARTMENT)
            return qb.limit(5)
          })()
        : Promise.resolve({ data: [] as Profile[] })

      const postsP =
        wantPosts
          ? supabase
              .from('posts')
              .select('*, profiles(id, full_name, avatar_url)')
              .ilike('content', `%${query}%`)
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] as Post[] })

      const [usersRes, postsRes] = await Promise.all([usersP, postsP])

      const places = wantPlaces ? pickPlaceHits(allEvents, query, 5) : []

      setResults({
        users: (usersRes.data ?? []) as Profile[],
        posts: (postsRes.data ?? []) as Post[],
        places,
      })
      setIsSearching(false)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query, mobileModalOpen, mobilePill, allEvents])

  const resultItemBase =
    'w-full flex items-center gap-3 py-2.5 px-1 rounded-xl cursor-pointer text-left transition-colors duration-200'
  const mobileResultRow =
    'hover:bg-black/[0.04] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.07]'

  const desktopRowHover =
    'hover:bg-slate-100/90 dark:hover:bg-white/[0.06] active:bg-slate-200/80 dark:active:bg-white/[0.08]'
  const desktopHighlight =
    'ring-2 ring-brand-gold/45 dark:ring-brand-gold-bright/50 bg-brand-gold/[0.08] dark:bg-brand-gold/10'

  const activateHighlightedResult = useCallback(() => {
    const hi = highlightIndexRef.current
    if (hi < 0 || hi >= resultCount) return
    let idx = 0
    for (const u of results.users) {
      if (idx === hi) {
        handleNavigateUser(u.id)
        return
      }
      idx++
    }
    for (const p of results.posts) {
      if (idx === hi) {
        handleNavigatePost(String(p.id))
        return
      }
      idx++
    }
    for (const _pl of results.places) {
      if (idx === hi) {
        handleNavigatePlace()
        return
      }
      idx++
    }
  }, [resultCount, results.users, results.posts, results.places, handleNavigateUser, handleNavigatePost, handleNavigatePlace])

  const onDesktopSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeDesktopOverlay()
      return
    }
    if (resultCount === 0 || isSearching) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => (i < 0 ? 0 : (i + 1) % resultCount))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => (i < 0 ? resultCount - 1 : (i - 1 + resultCount) % resultCount))
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setHighlightIndex(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      setHighlightIndex(resultCount - 1)
      return
    }
    if (e.key === 'Enter') {
      const hi = highlightIndexRef.current
      if (hi >= 0 && hi < resultCount) {
        e.preventDefault()
        activateHighlightedResult()
      }
    }
  }

  const crystalHistorySection = (sectionClassName: string, focusInput: () => void) => (
    <section className={sectionClassName}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={crystalSectionTitleCls}>Ostatnio wyszukiwane</h3>
        {searchHistory.length > 0 && (
          <motion.button
            type="button"
            onClick={clearHistory}
            whileTap={{ scale: 0.97 }}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-brand-gold dark:hover:text-brand-gold-bright"
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
                  <Clock size={15} strokeWidth={2} className="shrink-0 text-brand-gold dark:text-brand-gold-bright" aria-hidden />
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
    const sectionIconCls = 'text-brand-gold dark:text-brand-gold-bright shrink-0'
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
            className={`flex items-center gap-2.5 px-4 py-4 text-[13px] ${tMuted}`}
          >
            <Loader2 size={14} className="animate-spin text-brand-gold dark:text-brand-gold-bright shrink-0" />
            Szukam…
          </motion.div>
        )}

        {!isSearching && query.length === 1 && (
          <motion.div variants={searchStaggerItem} className={`px-4 py-3 text-[12px] ${tHint}`}>
            Wpisz co najmniej 2 znaki…
          </motion.div>
        )}

        {!isSearching && searched && !hasResults && (
          <motion.div variants={searchStaggerItem} className={`px-4 py-5 text-center text-[13px] ${tHint}`}>
            Brak wyników dla <span className={`font-semibold ${tQuote}`}>"{query}"</span>
          </motion.div>
        )}

        {!isSearching && results.users.length > 0 && (
          <motion.div className="px-2 pt-2" variants={searchStaggerItem}>
            <div
              className={`flex items-center gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <UserRound size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
              Użytkownicy
            </div>
            <motion.div variants={searchStaggerContainer} initial="hidden" animate="show">
            {results.users.map((user) => (
              <motion.button
                key={user.id}
                type="button"
                variants={searchStaggerItem}
                onClick={() => handleNavigateUser(user.id)}
                whileTap={{ scale: 0.985 }}
                className={`${resultItemBase} ${mobileResultRow}`}
              >
                <UserRound
                  size={18}
                  strokeWidth={2}
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
            className={`px-2 pb-2 ${
              results.users.length > 0 ? `mt-1 border-t ${sectionDivider} pt-2` : 'pt-2'
            }`}
          >
            <div
              className={`flex items-center gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <MessageSquareText size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
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
                  onClick={() => handleNavigatePost(postId)}
                  whileTap={{ scale: 0.985 }}
                  className={`${resultItemBase} ${mobileResultRow}`}
                >
                  <MessageSquareText
                    size={18}
                    strokeWidth={2}
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
            className={`px-2 pb-2 ${
              results.users.length > 0 || results.posts.length > 0
                ? `mt-1 border-t ${sectionDivider} pt-2`
                : 'pt-2'
            }`}
          >
            <div
              className={`flex items-center gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <MapPin size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
              Miejsca
            </div>
            <motion.div variants={searchStaggerContainer} initial="hidden" animate="show">
            {results.places.map((place) => (
                <motion.button
                  key={place.id}
                  type="button"
                  variants={searchStaggerItem}
                  onClick={handleNavigatePlace}
                  whileTap={{ scale: 0.985 }}
                  className={`${resultItemBase} ${mobileResultRow}`}
                >
                  <MapPin
                    size={18}
                    strokeWidth={2}
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

        <div className="h-1" />
      </motion.div>
    )
  }

  const renderDesktopResultsGrid = () => {
    const tTitle = 'text-fg-primary dark:text-slate-200'
    const tMuted = 'text-fg-secondary dark:text-slate-400'
    const tHint = 'text-slate-500 dark:text-slate-500'
    const tQuote = 'text-fg-primary dark:text-slate-300'
    const sectionIconCls = 'text-brand-gold dark:text-brand-gold-bright shrink-0'
    const sectionDivider = 'border-slate-200/80 dark:border-white/10'
    let flatIdx = 0

    const mainStatuses = (
      <>
        {query.length >= 2 && isSearching && (
          <div
            className={`lg:col-span-2 flex items-center justify-center gap-2.5 py-10 text-[13px] ${tMuted}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Loader2 size={14} className="animate-spin text-brand-gold dark:text-brand-gold-bright shrink-0" />
            Szukam…
          </div>
        )}
        {query.length === 1 && (
          <div className={`lg:col-span-2 px-2 py-4 text-[12px] ${tHint}`} onPointerDown={(e) => e.stopPropagation()}>
            Wpisz co najmniej 2 znaki…
          </div>
        )}
        {query.length >= 2 && !isSearching && searched && !hasResults && (
          <div
            className={`lg:col-span-2 px-2 py-6 text-center text-[13px] ${tHint}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Brak wyników dla <span className={`font-semibold ${tQuote}`}>"{query}"</span>
          </div>
        )}
      </>
    )

    const resultsTwoColumns =
      query.length >= 2 && !isSearching && hasResults ? (
        <>
          <div
            className={`flex min-h-0 max-h-[min(62vh,520px)] min-w-0 flex-col overflow-hidden lg:max-h-none ${searchResultPanelCls}`}
            onPointerDown={(e) => e.stopPropagation()}
            role="listbox"
            aria-label="Użytkownicy"
          >
            <div
              className={`shrink-0 flex items-center gap-2 px-3 py-2 border-b ${sectionDivider} text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <UserRound size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
              Użytkownicy
            </div>
            <motion.div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1"
              variants={searchStaggerContainer}
              initial="hidden"
              animate="show"
            >
              {results.users.map((user) => {
                const idx = flatIdx++
                const hi = highlightIndex === idx
                return (
                  <motion.button
                    key={user.id}
                    type="button"
                    variants={searchStaggerItem}
                    data-search-result-index={idx}
                    role="option"
                    aria-selected={hi}
                    onClick={() => handleNavigateUser(user.id)}
                    whileTap={{ scale: 0.99 }}
                    className={`${resultItemBase} ${desktopRowHover} ${hi ? desktopHighlight : ''}`}
                  >
                    <UserAvatar
                      profile={user}
                      name={user.full_name ?? 'U'}
                      className="h-9 w-9 shrink-0 ring-2 ring-brand-gold/25 dark:ring-brand-gold/30"
                      textSize="text-sm"
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
                )
              })}
              {results.users.length === 0 && (
                <p className={`text-[12px] px-2 py-3 ${tHint}`}>Brak dopasowań w ludziach.</p>
              )}
            </motion.div>
          </div>

          <div
            className={`flex min-h-0 max-h-[min(62vh,520px)] min-w-0 flex-col overflow-hidden lg:max-h-none ${searchResultPanelCls}`}
            onPointerDown={(e) => e.stopPropagation()}
            role="listbox"
            aria-label="Wpisy i miejsca"
          >
            <div
              className={`shrink-0 flex items-center gap-2 px-3 py-2 border-b ${sectionDivider} text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <MessageSquareText size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
              Wpisy i miejsca
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-3">
              <motion.div
                className="space-y-1"
                variants={searchStaggerContainer}
                initial="hidden"
                animate="show"
              >
                {results.posts.length > 0 && (
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${tHint} px-1 pb-1`}>Wpisy</div>
                )}
                {results.posts.map((post) => {
                  const postId = String(post.id)
                  const author = post.profiles
                  const authorName = author?.full_name ?? 'Użytkownik'
                  const idx = flatIdx++
                  const hi = highlightIndex === idx
                  return (
                    <motion.button
                      key={postId}
                      type="button"
                      variants={searchStaggerItem}
                      data-search-result-index={idx}
                      role="option"
                      aria-selected={hi}
                      onClick={() => handleNavigatePost(postId)}
                      whileTap={{ scale: 0.99 }}
                      className={`${resultItemBase} ${desktopRowHover} ${hi ? desktopHighlight : ''}`}
                    >
                      <UserAvatar
                        profile={author}
                        name={authorName}
                        className="h-9 w-9 shrink-0 ring-2 ring-brand-gold/25 dark:ring-brand-gold/30"
                        textSize="text-sm"
                      />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-semibold truncate ${tTitle}`}>{authorName}</span>
                        <span className={`block text-sm line-clamp-2 mt-0.5 ${tMuted}`}>{post.content ?? ''}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </motion.div>
              {results.places.length > 0 && (
                <motion.div
                  className={`space-y-1 pt-1 border-t ${sectionDivider}`}
                  variants={searchStaggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${tHint} px-1 pb-1`}>Miejsca</div>
                  {results.places.map((place) => {
                    const idx = flatIdx++
                    const hi = highlightIndex === idx
                    return (
                      <motion.button
                        key={place.id}
                        type="button"
                        variants={searchStaggerItem}
                        data-search-result-index={idx}
                        role="option"
                        aria-selected={hi}
                        onClick={handleNavigatePlace}
                        whileTap={{ scale: 0.99 }}
                        className={`${resultItemBase} ${desktopRowHover} ${hi ? desktopHighlight : ''}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent-gold/35 bg-accent-gold/10 text-accent-gold">
                          <MapPin size={17} strokeWidth={2} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-semibold truncate ${tTitle}`}>
                            {place.location.trim() || place.title}
                          </span>
                          <span className={`block text-xs line-clamp-1 mt-0.5 ${tHint}`}>
                            {place.location.trim() && place.title !== place.location.trim()
                              ? place.title
                              : 'Wydarzenie'}
                          </span>
                        </span>
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}
              {results.posts.length === 0 && results.places.length === 0 && (
                <p className={`text-[12px] px-2 py-3 ${tHint}`}>Brak wpisów i miejsc.</p>
              )}
            </div>
          </div>
        </>
      ) : null

    return (
      <div
        className="mx-auto flex w-full max-w-5xl flex-1 min-h-0 flex-col"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="grid min-h-0 w-full flex-1 grid-cols-1 auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
          {query.length === 0 && (
            <p
              className={`hidden text-center text-[13px] lg:col-span-2 ${tHint} px-1 py-2 lg:block`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Wyniki wyszukiwania pojawią się tutaj — zacznij wpisywać powyżej.
            </p>
          )}
          {mainStatuses}
          {resultsTwoColumns}
        </div>
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className="md:hidden min-w-[40px] min-h-[40px] w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-brand-gold dark:hover:text-brand-gold-bright hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Szukaj"
        >
          <Search size={24} strokeWidth={2} className="shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setDesktopOverlayOpen(true)}
          className="hidden md:flex w-9 h-9 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-brand-gold dark:hover:text-brand-gold-bright hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Szukaj"
        >
          <Search size={20} strokeWidth={2} className="shrink-0" />
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {desktopOverlayOpen && (
            <motion.div
              key="desktop-search-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Wyszukiwanie"
              className="fixed inset-0 z-[200] hidden md:flex flex-col bg-bg-app/95"
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              onPointerDown={() => closeDesktopOverlay()}
            >
              <motion.div
                className="relative mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={searchCrystalEntry}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="relative mx-auto flex w-full max-w-5xl shrink-0 items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={closeDesktopOverlay}
                    whileTap={{ scale: 0.96 }}
                    className={backIconBtnCls}
                    aria-label="Wróć do feedu"
                  >
                    <ChevronLeft size={24} strokeWidth={2.25} className="h-6 w-6 shrink-0" aria-hidden />
                  </motion.button>
                  <div className="relative min-w-0 flex-1 rounded-2xl">
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute -inset-[1px] z-0 rounded-2xl border-2 border-brand-gold dark:border-brand-gold-bright"
                      initial={false}
                      animate={{
                        opacity: desktopInputFocused ? 1 : 0,
                        scale: desktopInputFocused ? 1 : 0.992,
                      }}
                      transition={searchSpringContent}
                    />
                    <Search
                      size={18}
                      strokeWidth={2}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-[2] -translate-y-1/2 text-brand-gold dark:text-brand-gold-bright"
                    />
                    <input
                      ref={desktopInputRef}
                      type="search"
                      name="ujverse-desktop-search"
                      autoComplete="off"
                      spellCheck={false}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onDesktopSearchKeyDown}
                      onFocus={() => setDesktopInputFocused(true)}
                      onBlur={() => setDesktopInputFocused(false)}
                      placeholder="Szukaj użytkowników, wpisów, miejsc…"
                      className="ujverse-search-input relative z-[1] h-12 w-full rounded-2xl border border-[#0f172a]/10 bg-black/[0.06] pl-11 pr-3 text-[15px] text-logo-navy shadow-none outline-none ring-0 transition-[border-color] duration-300 placeholder:text-fg-secondary focus:border-[#0f172a]/20 focus:ring-0 dark:border-white/10 dark:bg-black/40 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-white/25 caret-brand-gold dark:caret-brand-gold-bright"
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col mt-6 overflow-hidden">
                  {query.length === 0 &&
                    crystalHistorySection('mx-auto mb-6 w-full max-w-5xl shrink-0', () => {
                      desktopInputRef.current?.focus({ preventScroll: true })
                    })}

                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{renderDesktopResultsGrid()}</div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {createPortal(
        <AnimatePresence>
          {mobileModalOpen && (
            <motion.div
              key="mobile-search-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Wyszukiwanie"
              className="fixed inset-0 z-[200] md:hidden flex flex-col bg-bg-app/95"
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <motion.div
                className="relative flex flex-1 min-h-0 flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={searchCrystalEntry}
              >
                <div className="mb-5 flex shrink-0 items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={closeMobileModal}
                    whileTap={{ scale: 0.96 }}
                    className={backIconBtnCls}
                    aria-label="Wróć do feedu"
                  >
                    <ChevronLeft size={24} strokeWidth={2.25} className="h-6 w-6 shrink-0" aria-hidden />
                  </motion.button>
                  <div className="relative min-w-0 flex-1 rounded-2xl">
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute -inset-[1px] z-0 rounded-2xl border-2 border-brand-gold dark:border-brand-gold-bright"
                      initial={false}
                      animate={{
                        opacity: mobileInputFocused ? 1 : 0,
                        scale: mobileInputFocused ? 1 : 0.992,
                      }}
                      transition={searchSpringContent}
                    />
                    <Search
                      size={18}
                      strokeWidth={2}
                      className="pointer-events-none absolute left-3.5 top-1/2 z-[2] -translate-y-1/2 text-brand-gold dark:text-brand-gold-bright"
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
                      className="ujverse-search-input relative z-[1] h-12 w-full rounded-2xl border border-[#0f172a]/10 bg-black/[0.06] pl-11 pr-3 text-[16px] text-logo-navy shadow-none outline-none ring-0 transition-[border-color] duration-300 placeholder:text-fg-secondary focus:border-[#0f172a]/20 focus:ring-0 dark:border-white/10 dark:bg-black/40 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-white/25 caret-brand-gold dark:caret-brand-gold-bright"
                    />
                  </div>
                </div>

                <div className="-mx-4 mb-6 shrink-0 border-b border-border-app dark:border-white/10">
                  <LayoutGroup>
                    <nav
                      className="relative flex overflow-x-auto px-2 scrollbar-none [-webkit-overflow-scrolling:touch] gap-0.5"
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
                        const tabBase =
                          'relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 border-b-2 border-transparent -mb-px [-webkit-tap-highlight-color:transparent]'
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
                                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-gold dark:bg-brand-gold-bright"
                                transition={searchSpringContent}
                              />
                            )}
                          </button>
                        )
                      })}
                    </nav>
                  </LayoutGroup>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 -mx-1">
                  {query.length === 0 &&
                    crystalHistorySection('mx-auto w-full max-w-5xl px-1 pb-6', () => {
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
                        className="px-1 pb-6"
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
