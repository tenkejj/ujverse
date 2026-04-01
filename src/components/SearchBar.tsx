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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

export default function SearchBar({
  onNavigateToUser,
  onNavigateToPost,
  onNavigateToEvents,
}: Props) {
  const { allEvents } = useEvents()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>({ users: [], posts: [], places: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)
  const [mobilePill, setMobilePill] = useState<MobilePill>('all')
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)

  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const showDropdown = isOpen && (query.length >= 2 || isSearching)
  const hasResults =
    results.users.length > 0 || results.posts.length > 0 || results.places.length > 0
  const searched = !isSearching && query.length >= 2

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

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults({ users: [], posts: [], places: [] })
    setIsOpen(false)
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

  const handleNavigatePlace = useCallback(() => {
    pushHistory(query)
    setMobileModalOpen(false)
    setMobilePill('all')
    clearSearch()
    onNavigateToEvents()
  }, [clearSearch, onNavigateToEvents, pushHistory, query])

  // Click-outside for desktop dropdown — only active when NOT in mobile modal
  useEffect(() => {
    if (!isOpen || mobileModalOpen) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clearSearch()
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [isOpen, mobileModalOpen, clearSearch])

  // Focus mobile input when modal opens (keyboard)
  useEffect(() => {
    if (!mobileModalOpen) return
    const t = window.setTimeout(() => {
      const el = mobileInputRef.current
      el?.focus({ preventScroll: true })
      el?.click()
    }, 120)
    return () => window.clearTimeout(t)
  }, [mobileModalOpen])

  // Blokada scrolla pod overlayem
  useEffect(() => {
    if (!mobileModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileModalOpen])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ users: [], posts: [], places: [] })
      setIsOpen(query.length > 0)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setIsOpen(true)

    const timer = window.setTimeout(async () => {
      const mode = !mobileModalOpen ? 'all' : mobilePill
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
    'w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left transition-colors duration-200'

  const resultsContent = (isMobile: boolean) => {
    const tTitle = isMobile ? 'text-uj-navy dark:text-slate-200' : 'text-slate-200'
    const tMuted = isMobile ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'
    const tHint = isMobile ? 'text-slate-600 dark:text-slate-500' : 'text-slate-500'
    const tQuote = isMobile ? 'text-uj-navy dark:text-slate-300' : 'text-slate-300'

    return (
    <div onPointerDown={(e) => e.stopPropagation()}>
      {isSearching && (
        <div className={`flex items-center gap-2.5 px-4 py-4 text-[13px] ${tMuted}`}>
          <Loader2 size={14} className="animate-spin text-accent-gold shrink-0" />
          Szukam…
        </div>
      )}

      {!isSearching && query.length === 1 && (
        <div className={`px-4 py-3 text-[12px] ${tHint}`}>
          Wpisz co najmniej 2 znaki…
        </div>
      )}

      {!isSearching && searched && !hasResults && (
        <div className={`px-4 py-5 text-center text-[13px] ${tHint}`}>
          Brak wyników dla{' '}
          <span className={`font-semibold ${tQuote}`}>"{query}"</span>
        </div>
      )}

      {/* Users */}
      {!isSearching && results.users.length > 0 && (
        <div className="px-2 pt-2">
          <p className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}>
            Użytkownicy
          </p>
          {results.users.map((user, i) => (
            <motion.button
              key={user.id}
              type="button"
              onClick={() => handleNavigateUser(user.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                className={`${resultItemBase} ${
                isMobile
                  ? 'bg-slate-50 dark:bg-white/[0.03] border border-slate-200/90 dark:border-accent-gold/20 hover:bg-amber-50/80 dark:hover:bg-accent-gold/10 active:bg-amber-50 dark:active:bg-accent-gold/15'
                  : 'hover:bg-slate-800/50 active:bg-slate-700'
              }`}
            >
              {isMobile ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/40 bg-accent-gold/15 text-accent-gold">
                  <UserRound size={18} strokeWidth={2} />
                </span>
              ) : (
                <UserAvatar
                  profile={user}
                  name={user.full_name ?? 'U'}
                  className="h-9 w-9 shrink-0"
                  textSize="text-sm"
                />
              )}
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
        </div>
      )}

      {/* Posts */}
      {!isSearching && results.posts.length > 0 && (
        <div
          className={`px-2 pb-2 ${
            results.users.length > 0 ? 'mt-1 border-t border-border-app pt-2' : 'pt-2'
          }`}
        >
          <p className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}>
            Wpisy
          </p>
          {results.posts.map((post, i) => {
            const postId = String(post.id)
            const author = post.profiles
            const authorName = author?.full_name ?? 'Użytkownik'
            const offset = results.users.length
            return (
              <motion.button
                key={postId}
                type="button"
                onClick={() => handleNavigatePost(postId)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                  delay: (offset + i) * 0.05,
                }}
                className={`${resultItemBase} ${
                  isMobile
                    ? 'bg-slate-50 dark:bg-white/[0.03] border border-uj-blue/25 dark:border-uj-blue/35 hover:bg-slate-100 dark:hover:bg-uj-navy/25 active:bg-slate-200/80 dark:active:bg-uj-navy/35'
                    : 'hover:bg-slate-800/50 active:bg-slate-700'
                }`}
              >
                {isMobile ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-uj-blue/50 bg-uj-navy/40 text-sky-200">
                    <MessageSquareText size={18} strokeWidth={2} />
                  </span>
                ) : (
                  <UserAvatar
                    profile={author}
                    name={authorName}
                    className="h-9 w-9 shrink-0"
                    textSize="text-sm"
                  />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold truncate ${tTitle}`}>
                    {authorName}
                  </span>
                  <span className={`block text-sm line-clamp-1 mt-0.5 ${tMuted}`}>
                    {post.content ?? ''}
                  </span>
                </span>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Places (wydarzenia / lokalizacje) */}
      {!isSearching && results.places.length > 0 && (
        <div
          className={`px-2 pb-2 ${
            results.users.length > 0 || results.posts.length > 0
              ? 'mt-1 border-t border-border-app pt-2'
              : 'pt-2'
          }`}
        >
          <p className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}>
            Miejsca
          </p>
          {results.places.map((place, i) => {
            const offset = results.users.length + results.posts.length
            return (
              <motion.button
                key={place.id}
                type="button"
                onClick={handleNavigatePlace}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                  delay: (offset + i) * 0.05,
                }}
                className={`${resultItemBase} ${
                  isMobile
                    ? 'bg-slate-50 dark:bg-white/[0.03] border border-amber-200/80 dark:border-accent-gold/25 hover:bg-amber-50/90 dark:hover:bg-accent-gold/10 active:bg-amber-100/70 dark:active:bg-accent-gold/15'
                    : 'hover:bg-slate-800/50 active:bg-slate-700'
                }`}
              >
                {isMobile ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/45 bg-accent-gold/12 text-accent-gold">
                    <MapPin size={18} strokeWidth={2} />
                  </span>
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent-gold/35 bg-accent-gold/10 text-accent-gold">
                    <MapPin size={17} strokeWidth={2} />
                  </span>
                )}
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
        </div>
      )}

      <div className="h-1" />
    </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className="md:hidden min-w-[40px] min-h-[40px] w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-accent-gold hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label="Szukaj"
        >
          <Search size={24} strokeWidth={2} className="shrink-0" />
        </button>

        <div className="hidden md:block relative">
          <div className="relative flex items-center">
            <Search
              size={14}
              className="absolute left-3 pointer-events-none text-slate-400 dark:text-gray-500 transition-colors duration-200"
            />
            <input
              ref={desktopInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (query.length >= 2) setIsOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') clearSearch()
              }}
              placeholder="Szukaj użytkowników, wpisów..."
              className="w-[280px] h-8 pl-8 pr-8 rounded-full bg-slate-100 dark:bg-white/8 text-[13px] text-slate-700 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 border border-transparent focus:border-uj-orange/40 focus:ring-2 focus:ring-uj-orange/15 focus:bg-white dark:focus:bg-white/10 focus:outline-none transition-all duration-200"
            />
            <AnimatePresence>
              {query.length > 0 && (
                <motion.button
                  type="button"
                  onClick={clearSearch}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-2.5 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300"
                  aria-label="Wyczyść"
                >
                  <X size={12} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full mt-2 left-0 w-[340px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[9999] overflow-hidden backdrop-blur-sm"
              >
                {resultsContent(false)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {mobileModalOpen && (
            <motion.div
              key="mobile-search-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Wyszukiwanie"
              className="fixed inset-0 z-[200] md:hidden flex flex-col bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="flex flex-1 min-h-0 flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Pasek wyszukiwania + Anuluj */}
                <div className="flex items-center gap-3 shrink-0 mb-5">
                  <div className="relative flex-1 min-w-0">
                    <Search
                      size={18}
                      strokeWidth={2}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-gold pointer-events-none"
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
                      placeholder="Szukaj…"
                      className="w-full h-12 pl-11 pr-11 rounded-2xl border-0 bg-slate-100 dark:bg-slate-800 text-[16px] text-uj-navy dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-500 shadow-none outline-none ring-0 transition-shadow duration-200 focus:ring-2 focus:ring-accent-gold/40 focus:ring-offset-0 dark:focus:ring-accent-gold/35 caret-accent-gold"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                      <AnimatePresence>
                        {query.length > 0 && (
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => {
                              setQuery('')
                              setResults({ users: [], posts: [], places: [] })
                              mobileInputRef.current?.focus()
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-accent-gold hover:bg-accent-gold/10 transition-colors"
                            aria-label="Wyczyść zapytanie"
                          >
                            <X size={18} strokeWidth={2.25} />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    onClick={closeMobileModal}
                    className="shrink-0 py-2 pl-1 pr-0 text-[15px] font-medium text-uj-navy dark:text-slate-300 hover:text-accent-gold dark:hover:text-accent-gold transition-colors duration-200 [-webkit-tap-highlight-color:transparent]"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  >
                    Anuluj
                  </motion.button>
                </div>

                {/* Tagi (pills) */}
                <div className="-mx-4 mb-6 shrink-0">
                  <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch]">
                    {(
                      [
                        { id: 'all' as const, label: '#Wszystko' },
                        { id: 'users' as const, label: '#Ludzie' },
                        {
                          id: 'events' as const,
                          label: '#Wydarzenia',
                          action: 'navigate-events' as const,
                        },
                        { id: 'places' as const, label: '#Miejsca' },
                        { id: 'wpi' as const, label: '#WPiA' },
                      ] as const
                    ).map((pill) => {
                      const isActive =
                        pill.id !== 'events' &&
                        mobilePill === pill.id
                      const base =
                        'shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-all duration-200 border [-webkit-tap-highlight-color:transparent]'
                      const inactive =
                        'border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-uj-navy dark:text-slate-300 active:scale-[0.98]'
                      const active =
                        'border-accent-gold/50 bg-accent-gold/12 text-accent-gold shadow-[0_0_20px_-4px_rgba(255,160,0,0.35)]'
                      if (pill.id === 'events') {
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            className={`${base} ${inactive}`}
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
                          className={`${base} ${isActive ? active : inactive}`}
                          onClick={() => {
                            setMobilePill(pill.id)
                            setTimeout(() => mobileInputRef.current?.focus(), 0)
                          }}
                        >
                          {pill.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 -mx-1">
                  {query.length === 0 && (
                    <section className="px-1 pb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-uj-navy dark:text-slate-400 flex items-center gap-2">
                          <Clock size={15} className="text-accent-gold shrink-0" strokeWidth={2} />
                          Ostatnio wyszukiwane
                        </h3>
                        {searchHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={clearHistory}
                            className="text-[13px] font-medium text-slate-600 dark:text-slate-500 hover:text-accent-gold transition-colors"
                          >
                            Wyczyść
                          </button>
                        )}
                      </div>
                      {searchHistory.length === 0 ? (
                        <p className="text-[14px] text-slate-500 dark:text-slate-500 pl-0.5">
                          Brak ostatnich wyszukiwań.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {searchHistory.map((h) => (
                            <li key={h}>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuery(h)
                                  setTimeout(() => mobileInputRef.current?.focus(), 0)
                                }}
                                className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left bg-slate-100/80 dark:bg-slate-800/60 border border-transparent hover:border-accent-gold/30 dark:hover:border-accent-gold/25 transition-colors [-webkit-tap-highlight-color:transparent]"
                              >
                                <Clock
                                  size={15}
                                  className="text-accent-gold/90 shrink-0"
                                  strokeWidth={2}
                                />
                                <span className="truncate text-[15px] text-uj-navy dark:text-slate-200">
                                  {h}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

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
                        {resultsContent(true)}
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
