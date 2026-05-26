import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Calendar, FileText, LayoutGrid, Megaphone, Search, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useContentSearch } from '../hooks/useContentSearch'
import type { Comment, Post, Profile } from '../types'
import type { EventMeta, UnifiedContent } from '../types/content'
import type { SearchHit, SearchUserHit } from '../types/search'
import EventCard from './events/EventCard'
import { DataService } from '../services/DataService'
import PostCard from './PostCard'
import SearchResultRow from './search/SearchResultRow'
import SearchUserResultRow from './search/SearchUserResultRow'
import SearchDashboard from './search/SearchDashboard'
import HorizontalPillScroller from './ui/HorizontalPillScroller'
import type { DashboardScope } from './search/SearchDashboard'
import {
  loadSearchHistory,
  pushHistoryEntry,
  removeHistoryEntry,
  clearAllHistory,
} from '../lib/searchHistory'

type SearchFilter = 'all' | 'post' | 'komunikat' | 'user' | 'event'
type ContentFilter = Exclude<SearchFilter, 'all'>

type SearchPageItem =
  | { kind: 'user'; hit: SearchUserHit }
  | { kind: 'content'; hit: SearchHit }
  | { kind: 'event'; content: UnifiedContent<EventMeta> }

type Props = {
  onNavigateToUser: (userId: string) => void
  onNavigateToEvents?: (openEventId?: string) => void

  // sharedPostProps — tożsame z SinglePostView, żeby renderować pełne PostCard
  // dla post-hitów z Meilisearch (likes/komentarze/usuwanie współdzielą stan App.tsx).
  myProfile: Profile | null
  displayName: string
  currentUserId: string
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  commentsLoadingByPost: Record<string, boolean>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>
  commentReplyTargetByPost: Record<string, { commentId: number; username: string } | null>
  commentLikeLoadingByPost: Record<string, Record<number, boolean>>
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onToggleCommentLike: (postId: string, comment: Comment) => void
  onReplyToComment: (postId: string, comment: Comment) => void
  onCancelReply: (postId: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost?: (postId: string) => void
}

const FILTER_TABS: ReadonlyArray<{
  id: SearchFilter
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'all', label: 'Wszystko', icon: LayoutGrid },
  { id: 'post', label: 'Posty', icon: FileText },
  { id: 'komunikat', label: 'Komunikaty', icon: Megaphone },
  { id: 'user', label: 'Użytkownicy', icon: Users },
  { id: 'event', label: 'Wydarzenia', icon: Calendar },
]

const SUGGESTIBLE_FILTERS: ReadonlyArray<ContentFilter> = ['user', 'post', 'komunikat', 'event']

const SCOPE_PLACEHOLDER: Record<DashboardScope | 'event', string> = {
  post: 'Szukaj wśród wpisów studentów…',
  komunikat: 'Szukaj wśród oficjalnych komunikatów…',
  event: 'Szukaj wydarzeń, koncertów, targów...',
}

const DEFAULT_PLACEHOLDER = 'Szukaj wpisów, komunikatów, wydarzeń i użytkowników...'

export default function SearchPageView({
  onNavigateToUser,
  onNavigateToEvents,
  myProfile,
  displayName,
  currentUserId,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  commentsLoadingByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  commentReplyTargetByPost,
  commentLikeLoadingByPost,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  onDeletePost,
  onDeleteComment,
  onNavigateToPost,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all')
  const [pendingFilter, setPendingFilter] = useState<ContentFilter | null>(null)
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory)
  const { content, users, events, isLoading, error } = useContentSearch(activeQuery)
  const [fullPostsById, setFullPostsById] = useState<Record<string, Post>>({})

  const queryFromUrl = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim() ?? '',
    [location.search],
  )

  useEffect(() => {
    setInputValue(queryFromUrl)
    setActiveQuery(queryFromUrl)
    setActiveFilter('all')
  }, [queryFromUrl])

  // Aplikujemy preseeded filter z Quick Scopes / Department shortcuts dopiero, gdy
  // użytkownik wpisze ≥2 znaki (lub URL wniesie taki query). Wtedy pigułki są widoczne,
  // a wyniki od razu zawężone do wybranego zakresu.
  useEffect(() => {
    if (pendingFilter && activeQuery.trim().length >= 2) {
      setActiveFilter(pendingFilter)
      setPendingFilter(null)
    }
  }, [activeQuery, pendingFilter])

  const safeUsers = Array.isArray(users) ? users : []
  const safeContent = Array.isArray(content) ? content : []
  const safeEvents = Array.isArray(events) ? events : []

  const postHitIds = useMemo<string[]>(
    () =>
      safeContent
        .filter((hit) => hit.type === 'post' && Boolean(hit.sourceId))
        .map((hit) => hit.sourceId),
    [safeContent],
  )

  // Batch dofetch pełnych Post[] dla post-hitów Meilisearch (search index zawiera
  // tylko zindeksowane pola). Pomijamy ID, które już mamy w cache — strony
  // wyszukiwania zazwyczaj rotują query, a większość post-hitów się zmienia.
  useEffect(() => {
    if (postHitIds.length === 0) return
    const missing = postHitIds.filter((id) => !(id in fullPostsById))
    if (missing.length === 0) return
    let cancelled = false
    void DataService.fetchPostsByIds(missing).then((rows) => {
      if (cancelled) return
      setFullPostsById((previous) => {
        const next = { ...previous }
        for (const row of rows) {
          if (row.id) next[String(row.id)] = row
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [postHitIds, fullPostsById])

  const unifiedPostsBySourceId = useMemo(() => {
    const map: Record<string, ReturnType<typeof DataService.toUnifiedPosts>[number]> = {}
    const fetched: Post[] = []
    for (const id of postHitIds) {
      const row = fullPostsById[id]
      if (row) fetched.push(row)
    }
    if (fetched.length === 0) return map
    const unified = DataService.toUnifiedPosts(fetched, {
      likesCountByPost,
      likedPostIds,
      commentsCountByPost,
    })
    for (const uc of unified) {
      if (uc.id) map[uc.id] = uc
    }
    return map
  }, [postHitIds, fullPostsById, likesCountByPost, likedPostIds, commentsCountByPost])

  const resultCounts = useMemo<Record<SearchFilter, number>>(() => ({
    all: safeUsers.length + safeContent.length + safeEvents.length,
    post: safeContent.filter((result) => result.type === 'post').length,
    komunikat: safeContent.filter((result) => result.type === 'komunikat').length,
    user: safeUsers.length,
    event: safeEvents.length,
  }), [safeUsers, safeContent, safeEvents])

  // Kolejność w "Wszystko": Profile → Posty → Komunikaty → Wydarzenia.
  const allItems = useMemo<SearchPageItem[]>(() => [
    ...safeUsers.map((hit) => ({ kind: 'user' as const, hit })),
    ...safeContent
      .filter((h) => h.type === 'post')
      .map((hit) => ({ kind: 'content' as const, hit })),
    ...safeContent
      .filter((h) => h.type === 'komunikat')
      .map((hit) => ({ kind: 'content' as const, hit })),
    ...safeEvents.map((eventContent) => ({ kind: 'event' as const, content: eventContent })),
  ], [safeUsers, safeContent, safeEvents])

  const filteredResults = useMemo<SearchPageItem[]>(() => {
    if (activeFilter === 'all') return allItems
    if (activeFilter === 'user') return allItems.filter((item) => item.kind === 'user')
    if (activeFilter === 'event') return allItems.filter((item) => item.kind === 'event')
    return allItems.filter(
      (item) => item.kind === 'content' && item.hit.type === activeFilter,
    )
  }, [activeFilter, allItems])

  const activeTab = useMemo(
    () => FILTER_TABS.find((tab) => tab.id === activeFilter) ?? FILTER_TABS[0],
    [activeFilter],
  )
  const ActiveTabIcon = activeTab.icon

  const suggestedFilter = useMemo<ContentFilter | null>(() => {
    const candidates = SUGGESTIBLE_FILTERS
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

  const handleOpenContent = useCallback((result: SearchHit) => {
    if (result.type === 'post') {
      navigate(`/thread/${encodeURIComponent(result.sourceId)}`)
      return
    }
    navigate('/')
  }, [navigate])

  const handleOpenEvent = useCallback(
    (eventId: string) => {
      if (onNavigateToEvents) {
        onNavigateToEvents(eventId)
        return
      }
      navigate('/events', { state: { openEventId: eventId } })
    },
    [navigate, onNavigateToEvents],
  )

  const handleClearInput = useCallback(() => {
    setInputValue('')
    setActiveQuery('')
    setPendingFilter(null)
    navigate('/search')
  }, [navigate])

  const handlePickHistory = useCallback((entry: string) => {
    setInputValue(entry)
    setActiveQuery(entry)
    navigate(`/search?q=${encodeURIComponent(entry)}`)
  }, [navigate])

  const handlePickScope = useCallback((scope: DashboardScope) => {
    setPendingFilter(scope)
    // Małe opóźnienie, żeby focus zadziałał po re-renderze inputa z nowym placeholderem.
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [])

  const handlePickDepartment = useCallback((dept: string) => {
    setInputValue(dept)
    setActiveQuery(dept)
    setPendingFilter('user')
    pushHistory(dept)
    navigate(`/search?q=${encodeURIComponent(dept)}`)
  }, [navigate, pushHistory])

  const hasAnyResults = resultCounts.all > 0
  const isEmptyState = activeQuery.trim().length < 2

  const inputPlaceholder = useMemo(() => {
    if (
      pendingFilter === 'post' ||
      pendingFilter === 'komunikat' ||
      pendingFilter === 'event'
    ) {
      return SCOPE_PLACEHOLDER[pendingFilter]
    }
    return DEFAULT_PLACEHOLDER
  }, [pendingFilter])

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
                ref={searchInputRef}
                id="search-page-query-input"
                type="search"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={inputPlaceholder}
                className="h-full w-full min-w-0 flex-1 bg-transparent pr-10 text-[15px] text-zinc-800 outline-none placeholder:truncate placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
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

          {activeQuery.trim().length >= 2 && hasAnyResults && (
            <HorizontalPillScroller
              className="mx-auto mt-5 max-w-2xl"
              scrollClassName="scrollbar-hide flex w-full min-w-0 flex-row flex-nowrap items-center justify-start gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pr-1 [-webkit-overflow-scrolling:touch] md:justify-center md:gap-2 md:overflow-visible"
              watchDeps={[activeFilter, activeQuery, resultCounts]}
              scrollLeftLabel="Przewiń filtry w lewo"
              scrollRightLabel="Przewiń filtry w prawo"
              scrollProps={{ role: 'tablist', 'aria-label': 'Filtr wyników wyszukiwania' }}
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
            </HorizontalPillScroller>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {isEmptyState ? (
              <SearchDashboard
                key="search-dashboard"
                history={searchHistory}
                pendingFilter={
                  pendingFilter === 'post' || pendingFilter === 'komunikat'
                    ? pendingFilter
                    : null
                }
                onPickHistory={handlePickHistory}
                onRemoveHistory={removeHistoryItem}
                onClearHistory={clearHistory}
                onPickScope={handlePickScope}
                onPickDepartment={handlePickDepartment}
              />
            ) : (
              <motion.div
                key="search-results"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                // Bez dashed chrome'u — pełne PostCardy mają już własne szkło.
                // Stany puste/loading/error otrzymują wewnętrzny mini-panel poniżej.
                className="mx-auto mt-6 w-full max-w-2xl"
              >
                {isLoading ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 text-center dark:border-white/15 dark:bg-black/20">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Szukam wyników dla „{activeQuery}”...
                    </p>
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 text-center dark:border-white/15 dark:bg-black/20">
                    <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                  </div>
                ) : !hasAnyResults ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-6 text-center dark:border-white/15 dark:bg-black/20">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Brak wyników dla „{activeQuery}”.
                    </p>
                  </div>
                ) : filteredResults.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/65 px-6 py-8 text-center dark:border-white/15 dark:bg-black/20">
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
                  <ul className="space-y-4">
                    {filteredResults.map((item, index) => {
                      if (item.kind === 'user') {
                        return (
                          <li key={`user-${item.hit.id}`}>
                            <SearchUserResultRow hit={item.hit} onOpen={onNavigateToUser} />
                          </li>
                        )
                      }

                      if (item.kind === 'event') {
                        return (
                          <li key={`event-${item.content.id}`}>
                            <EventCard
                              content={item.content}
                              onSelect={handleOpenEvent}
                            />
                          </li>
                        )
                      }

                      // Komunikaty — pełna karta jak w panelu „Komunikaty Akademickie”.
                      if (item.hit.type !== 'post') {
                        return (
                          <li key={item.hit.id}>
                            <SearchResultRow result={item.hit} onOpen={handleOpenContent} />
                          </li>
                        )
                      }

                      const postSourceId = item.hit.sourceId
                      const unified = unifiedPostsBySourceId[postSourceId]

                      if (!unified) {
                        // Dofetch w toku — utrzymujemy tę samą wysokość co PostCard
                        // (skeleton kompatybilny z BaseCard default).
                        return (
                          <li key={item.hit.id}>
                            <div className="animate-pulse rounded-2xl border border-zinc-200/70 bg-white/70 p-6 dark:border-white/10 dark:bg-zinc-950/40">
                              <div className="flex gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-white/10" />
                                <div className="flex-1 space-y-2 pt-1">
                                  <div className="h-3 w-1/3 rounded-full bg-zinc-200 dark:bg-white/10" />
                                  <div className="h-3 w-2/3 rounded-full bg-zinc-100 dark:bg-white/5" />
                                  <div className="h-3 w-1/2 rounded-full bg-zinc-100 dark:bg-white/5" />
                                </div>
                              </div>
                            </div>
                          </li>
                        )
                      }

                      return (
                        <li key={item.hit.id}>
                          <PostCard
                            content={unified}
                            index={index}
                            currentUserId={currentUserId}
                            myProfile={myProfile}
                            displayName={displayName}
                            isPop={heartPopPostId === postSourceId}
                            isCommentsOpen={expandedComments.has(postSourceId)}
                            comments={commentsByPost[postSourceId] ?? []}
                            commentsLoading={Boolean(commentsLoadingByPost[postSourceId])}
                            commentInputValue={commentInput[postSourceId] ?? ''}
                            isCommentSubmitting={Boolean(commentSubmitting[postSourceId])}
                            onToggleLike={() => onToggleLike(postSourceId)}
                            onToggleComments={() => onToggleComments(postSourceId)}
                            onSubmitComment={() => onSubmitComment(postSourceId)}
                            onCommentInputChange={(v) => onCommentInputChange(postSourceId, v)}
                            onToggleCommentLike={(comment) => onToggleCommentLike(postSourceId, comment)}
                            onReplyToComment={(comment) => onReplyToComment(postSourceId, comment)}
                            onCancelReply={() => onCancelReply(postSourceId)}
                            replyTarget={commentReplyTargetByPost[postSourceId] ?? null}
                            commentLikeLoadingById={commentLikeLoadingByPost[postSourceId] ?? {}}
                            onDeletePost={() => onDeletePost(postSourceId)}
                            onDeleteComment={(cId) => onDeleteComment(cId, postSourceId)}
                            onNavigateToPost={
                              onNavigateToPost ? () => onNavigateToPost(postSourceId) : undefined
                            }
                            onNavigateToUser={onNavigateToUser}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <aside className="hidden lg:col-span-3 lg:block" />
    </div>
  )
}
