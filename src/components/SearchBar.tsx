import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Loader2, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile, Post } from '../types'
import UserAvatar from './UserAvatar'
import { getDeptAbbreviation } from '../lib/departments'

type Props = {
  onNavigateToUser: (userId: string) => void
  onNavigateToPost: (postId: string) => void
}

type Results = {
  users: Profile[]
  posts: Post[]
}

const resultItemCls =
  'w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-800/50 active:bg-slate-700 transition-colors text-left'

export default function SearchBar({ onNavigateToUser, onNavigateToPost }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>({ users: [], posts: [] })
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [mobileModalOpen, setMobileModalOpen] = useState(false)

  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const showDropdown = isOpen && (query.length >= 2 || isSearching)
  const hasResults = results.users.length > 0 || results.posts.length > 0
  const searched = !isSearching && query.length >= 2

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults({ users: [], posts: [] })
    setIsOpen(false)
    setIsSearching(false)
  }, [])

  const closeMobileModal = useCallback(() => {
    setMobileModalOpen(false)
    clearSearch()
  }, [clearSearch])

  const handleNavigateUser = useCallback((userId: string) => {
    setMobileModalOpen(false)
    clearSearch()
    onNavigateToUser(userId)
  }, [clearSearch, onNavigateToUser])

  const handleNavigatePost = useCallback((postId: string) => {
    setMobileModalOpen(false)
    clearSearch()
    onNavigateToPost(postId)
  }, [clearSearch, onNavigateToPost])

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

  // Focus mobile input when modal opens
  useEffect(() => {
    if (mobileModalOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 80)
    }
  }, [mobileModalOpen])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ users: [], posts: [] })
      setIsOpen(query.length > 0)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setIsOpen(true)

    const timer = setTimeout(async () => {
      const [usersRes, postsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, department')
          .ilike('full_name', `%${query}%`)
          .limit(5),
        supabase
          .from('posts')
          .select('*, profiles(id, full_name, avatar_url)')
          .ilike('content', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      setResults({
        users: (usersRes.data ?? []) as Profile[],
        posts: (postsRes.data ?? []) as Post[],
      })
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Shared results content — stopPropagation on pointerdown prevents the
  // click-outside handler from clearing results before the click fires.
  const resultsContent = (
    <div onPointerDown={(e) => e.stopPropagation()}>
      {isSearching && (
        <div className="flex items-center gap-2.5 px-4 py-4 text-slate-400 text-[13px]">
          <Loader2 size={14} className="animate-spin text-uj-orange shrink-0" />
          Szukam…
        </div>
      )}

      {!isSearching && query.length === 1 && (
        <div className="px-4 py-3 text-[12px] text-slate-500">
          Wpisz co najmniej 2 znaki…
        </div>
      )}

      {!isSearching && searched && !hasResults && (
        <div className="px-4 py-5 text-center text-[13px] text-slate-500">
          Brak wyników dla{' '}
          <span className="text-slate-300 font-semibold">"{query}"</span>
        </div>
      )}

      {/* Users section */}
      {!isSearching && results.users.length > 0 && (
        <div className="px-2 pt-2">
          <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Użytkownicy
          </p>
          {results.users.map((user, i) => (
            <motion.button
              key={user.id}
              type="button"
              onClick={() => handleNavigateUser(user.id)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: i * 0.04 }}
              className={resultItemCls}
            >
              <UserAvatar
                profile={user}
                name={user.full_name ?? 'U'}
                className="h-9 w-9 shrink-0"
                textSize="text-sm"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-200 truncate">
                  {user.full_name ?? 'Użytkownik'}
                </span>
                {user.department && (
                  <span className="block text-xs text-slate-500 truncate mt-0.5">
                    {getDeptAbbreviation(user.department)}
                  </span>
                )}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Posts section */}
      {!isSearching && results.posts.length > 0 && (
        <div className={`px-2 pb-2 ${results.users.length > 0 ? 'mt-1 border-t border-slate-800 pt-2' : 'pt-2'}`}>
          <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: (offset + i) * 0.04 }}
                className={resultItemCls}
              >
                <UserAvatar
                  profile={author}
                  name={authorName}
                  className="h-9 w-9 shrink-0"
                  textSize="text-sm"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-200 truncate">
                    {authorName}
                  </span>
                  <span className="block text-sm text-slate-400 line-clamp-1 mt-0.5">
                    {post.content ?? ''}
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

  return (
    <>
      <div ref={containerRef} className="relative flex items-center">

        {/* Mobile: icon-only button */}
        <button
          type="button"
          onClick={() => setMobileModalOpen(true)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-gray-400 hover:text-uj-orange hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
          aria-label="Szukaj"
        >
          <Search size={17} />
        </button>

        {/* Desktop: fixed-width input with dropdown */}
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
              onFocus={() => { if (query.length >= 2) setIsOpen(true) }}
              onKeyDown={(e) => { if (e.key === 'Escape') clearSearch() }}
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

          {/* Desktop dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full mt-2 left-0 w-[340px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[9999] overflow-hidden backdrop-blur-sm"
              >
                {resultsContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile fullscreen search modal — Portal to document.body */}
      {mobileModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-slate-800 shrink-0">
            <button
              type="button"
              onClick={closeMobileModal}
              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all shrink-0"
              aria-label="Zamknij wyszukiwarkę"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-uj-orange pointer-events-none" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') closeMobileModal() }}
                placeholder="Szukaj użytkowników, wpisów..."
                className="w-full h-10 pl-8 pr-8 rounded-full bg-slate-800 border border-slate-700 text-[14px] text-white placeholder-slate-500 focus:outline-none focus:border-uj-orange/50 focus:ring-1 focus:ring-uj-orange/20 transition-all"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label="Wyczyść"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Results scrollable area */}
          <div className="flex-1 overflow-y-auto">
            {query.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <Search size={40} strokeWidth={1.5} className="mb-3 opacity-30" />
                <p className="text-[14px]">Wpisz co chcesz znaleźć…</p>
              </div>
            )}
            {query.length > 0 && resultsContent}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
