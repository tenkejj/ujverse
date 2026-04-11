import { useRef, useState, useEffect, useCallback, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  X,
  Loader2,
  UserRound,
  MessageSquareText,
  MapPin,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile, Post } from '../types'
import UserAvatar from './UserAvatar'
import { getDeptAbbreviation } from '../lib/departments'
import { useEvents, compareOfficialThenDate } from '../hooks/useEvents'
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

  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightIndexRef = useRef(-1)

  const hasResults =
    results.users.length > 0 || results.posts.length > 0 || results.places.length > 0
  const searched = !isSearching && query.length >= 2
  const resultCount = results.users.length + results.posts.length + results.places.length

  const popularNow = useMemo(() => {
    const now = Date.now()
    const upcoming = [...allEvents]
      .filter((e) => e.date.getTime() >= now)
      .sort(compareOfficialThenDate)
    if (upcoming.length > 0) return upcoming.slice(0, 6)
    return [...allEvents].sort(compareOfficialThenDate).slice(0, 6)
  }, [allEvents])

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
    'w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left transition-colors duration-200'

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

  const resultsContentMobile = () => {
    const tTitle = 'text-uj-navy dark:text-slate-200'
    const tMuted = 'text-slate-600 dark:text-slate-400'
    const tHint = 'text-slate-600 dark:text-slate-500'
    const tQuote = 'text-uj-navy dark:text-slate-300'
    const sectionIconCls = 'text-brand-gold dark:text-brand-gold-bright shrink-0'
    const sectionDivider = 'border-border-app'

    return (
      <div onPointerDown={(e) => e.stopPropagation()}>
        {isSearching && (
          <div className={`flex items-center gap-2.5 px-4 py-4 text-[13px] ${tMuted}`}>
            <Loader2 size={14} className="animate-spin text-brand-gold dark:text-brand-gold-bright shrink-0" />
            Szukam…
          </div>
        )}

        {!isSearching && query.length === 1 && (
          <div className={`px-4 py-3 text-[12px] ${tHint}`}>Wpisz co najmniej 2 znaki…</div>
        )}

        {!isSearching && searched && !hasResults && (
          <div className={`px-4 py-5 text-center text-[13px] ${tHint}`}>
            Brak wyników dla <span className={`font-semibold ${tQuote}`}>"{query}"</span>
          </div>
        )}

        {!isSearching && results.users.length > 0 && (
          <div className="px-2 pt-2">
            <div
              className={`flex items-center gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest ${tHint}`}
            >
              <UserRound size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
              Użytkownicy
            </div>
            {results.users.map((user, i) => (
              <motion.button
                key={user.id}
                type="button"
                onClick={() => handleNavigateUser(user.id)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                className={`${resultItemBase} bg-slate-50 dark:bg-white/[0.03] border border-slate-200/90 dark:border-brand-gold/20 hover:bg-brand-gold/[0.08] dark:hover:bg-brand-gold/10 active:bg-brand-gold/[0.12] dark:active:bg-brand-gold/15`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/40 bg-accent-gold/15 text-accent-gold">
                  <UserRound size={18} strokeWidth={2} />
                </span>
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

        {!isSearching && results.posts.length > 0 && (
          <div
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
                  className={`${resultItemBase} bg-slate-50 dark:bg-white/[0.03] border border-slate-200/90 dark:border-brand-gold/20 hover:bg-brand-gold/[0.08] dark:hover:bg-brand-gold/10 active:bg-brand-gold/[0.12] dark:active:bg-brand-gold/15`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/45 bg-accent-gold/12 text-accent-gold">
                    <MessageSquareText size={18} strokeWidth={2} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${tTitle}`}>{authorName}</span>
                    <span className={`block text-sm line-clamp-1 mt-0.5 ${tMuted}`}>{post.content ?? ''}</span>
                  </span>
                </motion.button>
              )
            })}
          </div>
        )}

        {!isSearching && results.places.length > 0 && (
          <div
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
                  className={`${resultItemBase} bg-slate-50 dark:bg-white/[0.03] border border-brand-gold/25 dark:border-accent-gold/25 hover:bg-brand-gold/[0.08] dark:hover:bg-accent-gold/10 active:bg-brand-gold/[0.12] dark:active:bg-accent-gold/15`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-gold/45 bg-accent-gold/12 text-accent-gold">
                    <MapPin size={18} strokeWidth={2} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${tTitle}`}>
                      {place.location.trim() || place.title}
                    </span>
                    <span className={`block text-xs line-clamp-1 mt-0.5 ${tHint}`}>
                      {place.location.trim() && place.title !== place.location.trim() ? place.title : 'Wydarzenie'}
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

  const renderDesktopPopularColumn = () => {
    const tTitle = 'text-fg-primary dark:text-slate-200'
    const tHint = 'text-slate-500 dark:text-slate-500'
    const sectionIconCls = 'text-brand-gold dark:text-brand-gold-bright shrink-0'
    const sectionDivider = 'border-slate-200 dark:border-border-app'
    return (
      <div className="min-w-0 flex flex-col rounded-xl border border-slate-200/80 dark:border-border-app bg-bg-card/60 overflow-hidden max-h-[min(70vh,520px)] lg:max-h-none lg:flex-1">
        <div
          className={`shrink-0 flex items-center gap-2 px-3 py-2 border-b ${sectionDivider} text-[10px] font-bold uppercase tracking-widest ${tHint}`}
        >
          <TrendingUp size={14} strokeWidth={2.25} className={sectionIconCls} aria-hidden />
          Popularne teraz
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1.5">
          {popularNow.length === 0 ? (
            <p className={`text-[12px] px-1 py-2 ${tHint}`}>Brak wydarzeń.</p>
          ) : (
            popularNow.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={handleNavigatePlace}
                className={`w-full text-left rounded-lg px-2 py-2 transition-colors ${desktopRowHover}`}
              >
                <span className={`block text-[12px] font-semibold leading-snug line-clamp-2 ${tTitle}`}>
                  {ev.title}
                </span>
                <span className={`block text-[10px] mt-0.5 ${tHint}`}>
                  {ev.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                  {ev.location ? ` · ${ev.location}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  const renderDesktopResultsGrid = () => {
    const tTitle = 'text-fg-primary dark:text-slate-200'
    const tMuted = 'text-fg-secondary dark:text-slate-400'
    const tHint = 'text-slate-500 dark:text-slate-500'
    const tQuote = 'text-fg-primary dark:text-slate-300'
    const sectionIconCls = 'text-brand-gold dark:text-brand-gold-bright shrink-0'
    const sectionDivider = 'border-slate-200 dark:border-border-app'
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
            className="min-w-0 flex flex-col rounded-xl border border-slate-200/80 dark:border-border-app bg-bg-card/80 overflow-hidden max-h-[min(55vh,420px)] lg:max-h-none"
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
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-1">
              {results.users.map((user) => {
                const idx = flatIdx++
                const hi = highlightIndex === idx
                return (
                  <button
                    key={user.id}
                    type="button"
                    data-search-result-index={idx}
                    role="option"
                    aria-selected={hi}
                    onClick={() => handleNavigateUser(user.id)}
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
                  </button>
                )
              })}
              {results.users.length === 0 && (
                <p className={`text-[12px] px-2 py-3 ${tHint}`}>Brak dopasowań w ludziach.</p>
              )}
            </div>
          </div>

          <div
            className="min-w-0 flex flex-col rounded-xl border border-slate-200/80 dark:border-border-app bg-bg-card/80 overflow-hidden max-h-[min(55vh,420px)] lg:max-h-none"
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
              <div className="space-y-1">
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
                    <button
                      key={postId}
                      type="button"
                      data-search-result-index={idx}
                      role="option"
                      aria-selected={hi}
                      onClick={() => handleNavigatePost(postId)}
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
                    </button>
                  )
                })}
              </div>
              {results.places.length > 0 && (
                <div className={`space-y-1 pt-1 border-t ${sectionDivider}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${tHint} px-1 pb-1`}>Miejsca</div>
                  {results.places.map((place) => {
                    const idx = flatIdx++
                    const hi = highlightIndex === idx
                    return (
                      <button
                        key={place.id}
                        type="button"
                        data-search-result-index={idx}
                        role="option"
                        aria-selected={hi}
                        onClick={handleNavigatePlace}
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
                      </button>
                    )
                  })}
                </div>
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
        className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-fr lg:items-stretch">
          {query.length === 0 && (
            <p
              className={`lg:col-span-2 text-[13px] ${tHint} px-1 py-2 hidden lg:block`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Wyniki wyszukiwania pojawią się tutaj — zacznij wpisywać powyżej.
            </p>
          )}
          {mainStatuses}
          {resultsTwoColumns}
        </div>
        <div className="w-full lg:w-[min(240px,100%)] shrink-0 min-h-0 flex flex-col" onPointerDown={(e) => e.stopPropagation()}>
          {renderDesktopPopularColumn()}
        </div>
      </div>
    )
  }

  const kbdClass =
    'inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md border border-slate-200/90 dark:border-slate-600 bg-slate-100/90 dark:bg-slate-800/90 text-[10px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums'

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
              className="fixed inset-0 z-[200] hidden md:flex flex-col bg-bg-app/88 dark:bg-bg-app/90 backdrop-blur-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={() => closeDesktopOverlay()}
            >
              <motion.div
                className="relative flex flex-1 min-h-0 flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] max-w-6xl mx-auto w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="relative w-full max-w-2xl mx-auto shrink-0">
                  <AnimatePresence>
                    {query.trim().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className="pointer-events-none absolute -inset-x-4 top-full mt-1 h-16 rounded-full bg-brand-gold/25 dark:bg-brand-gold-bright/20 blur-3xl"
                        aria-hidden
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="relative flex-1 min-w-0">
                      <Search
                        size={18}
                        strokeWidth={2}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-gold dark:text-brand-gold-bright pointer-events-none"
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
                        placeholder="Szukaj użytkowników, wpisów, miejsc…"
                        className="w-full h-12 pl-11 pr-24 rounded-2xl border border-slate-200/90 dark:border-border-app bg-white dark:bg-white/[0.06] text-[15px] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm outline-none ring-0 transition-shadow duration-200 focus:border-brand-gold/45 focus:ring-2 focus:ring-brand-gold/25 dark:focus:ring-brand-gold-bright/25 caret-brand-gold dark:caret-brand-gold-bright"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                                desktopInputRef.current?.focus()
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-gold dark:hover:text-brand-gold-bright hover:bg-brand-gold/10 transition-colors"
                              aria-label="Wyczyść zapytanie"
                            >
                              <X size={18} strokeWidth={2.25} />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 shrink-0">
                      <span className={`${kbdClass} gap-0.5`} title="Zamknij">
                        Esc
                      </span>
                      {resultCount > 0 && !isSearching && query.length >= 2 && (
                        <>
                          <kbd className={kbdClass} aria-hidden>
                            ↑
                          </kbd>
                          <kbd className={kbdClass} aria-hidden>
                            ↓
                          </kbd>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col mt-6 overflow-hidden">
                  {query.length === 0 && (
                    <section className="max-w-2xl mx-auto w-full mb-6 shrink-0">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-400 flex items-center gap-2">
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
                        <p className="text-[14px] text-slate-500 dark:text-slate-500">Brak ostatnich wyszukiwań.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {searchHistory.map((h) => (
                            <li key={h}>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuery(h)
                                  window.setTimeout(() => desktopInputRef.current?.focus(), 0)
                                }}
                                className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left bg-slate-100/80 dark:bg-slate-800/50 border border-transparent hover:border-accent-gold/30 dark:hover:border-accent-gold/25 transition-colors"
                              >
                                <Clock size={15} className="text-accent-gold/90 shrink-0" strokeWidth={2} />
                                <span className="truncate text-[15px] text-slate-800 dark:text-slate-200">{h}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}

                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{renderDesktopResultsGrid()}</div>
                </div>

                <button
                  type="button"
                  onClick={closeDesktopOverlay}
                  className="absolute top-[max(1rem,env(safe-area-inset-top))] right-5 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/80 dark:hover:bg-white/10 dark:text-slate-400 transition-colors"
                  aria-label="Zamknij wyszukiwanie"
                >
                  <X size={22} strokeWidth={2} />
                </button>
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
              className="fixed inset-0 z-[200] md:hidden flex flex-col bg-bg-app/93 dark:bg-bg-app/93 backdrop-blur-2xl"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: '50% 0%' }}
            >
              <motion.div
                className="flex flex-1 min-h-0 flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center gap-3 shrink-0 mb-5">
                  <div className="relative flex-1 min-w-0">
                    <Search
                      size={18}
                      strokeWidth={2}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-gold dark:text-brand-gold-bright pointer-events-none"
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
                      className="w-full h-12 pl-11 pr-11 rounded-2xl border border-transparent bg-slate-100 dark:bg-slate-800 text-[16px] text-uj-navy dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-500 shadow-none outline-none ring-0 transition-shadow duration-200 focus:border-brand-gold/35 focus:ring-2 focus:ring-brand-gold/35 focus:ring-offset-0 dark:focus:ring-brand-gold-bright/30 caret-brand-gold dark:caret-brand-gold-bright"
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
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-brand-gold dark:hover:text-brand-gold-bright hover:bg-brand-gold/10 transition-colors"
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
                    className="shrink-0 py-2 pl-1 pr-0 text-[15px] font-medium text-uj-navy dark:text-slate-300 hover:text-brand-gold dark:hover:text-brand-gold-bright transition-colors duration-200 [-webkit-tap-highlight-color:transparent]"
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  >
                    Anuluj
                  </motion.button>
                </div>

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
                      const isActive = pill.id !== 'events' && mobilePill === pill.id
                      const base =
                        'shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-all duration-200 border [-webkit-tap-highlight-color:transparent]'
                      const inactive =
                        'border-slate-200/90 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/90 text-uj-navy dark:text-slate-300 active:scale-[0.98]'
                      const active =
                        'border-brand-gold/50 bg-brand-gold/12 text-brand-gold dark:text-brand-gold-bright shadow-[0_0_20px_-4px_rgba(201,162,39,0.38)]'
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
                                <Clock size={15} className="text-accent-gold/90 shrink-0" strokeWidth={2} />
                                <span className="truncate text-[15px] text-uj-navy dark:text-slate-200">{h}</span>
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
