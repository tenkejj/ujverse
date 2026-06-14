import { CalendarDays, Filter, MessageCircle } from 'lucide-react'
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Comment, Post, Profile } from '../types'
import type { UJEvent } from '../data/mockEvents'
import { useAnnouncements, usePosts } from '../hooks/useContent'
import { useEvents } from '../hooks/useEvents'
import ComposeBox from './ComposeBox'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import PostCard from './PostCard'
import FeedFilters from './FeedFilters'
import AcademicAnnouncementsWidget from './AcademicAnnouncementsWidget'
import GroupNav from './GroupNav'
import CompactEventRow from './CompactEventRow'
import EmptyState from './EmptyState'
import FeedSkeleton from './FeedSkeleton'
import Niezbednik from './Niezbednik'
import CalendarMiniWidget from './calendar/CalendarMiniWidget'
import MobileDashboard from './mobile/MobileDashboard'
import BaseCard from './ui/BaseCard'
import {
  sectionTitleCls,
  sideHeaderLinkCls,
  sidePanelHoverFocus,
  widgetGoldCls,
} from '../lib/sidePanelStyles'

const ChatAssistant = lazy(() => import('./chat/ChatAssistant'))

type Props = {
  myProfile: Profile | null
  displayName: string
  currentUserId: string

  // Compose state
  isComposing: boolean
  createBody: string
  createImageFile: File | null
  createImagePreview: string | null
  createLoading: boolean
  createError: string | null
  onBodyChange: (v: string) => void
  onImageFileChange: (f: File | null) => void
  onComposeOpen: () => void
  onComposeReset: () => void
  onCreatePost: () => void

  // Posts
  posts: Post[]
  postsLoading: boolean
  postsError: string | null

  // Infinite scroll (React Query)
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onFetchNextPage?: () => void

  // Filter
  selectedDepartment: string
  onDepartmentChange: (dept: string) => void

  // Likes
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null

  // Comments
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  commentsLoadingByPost: Record<string, boolean>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>

  // Handlers
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onToggleCommentLike: (postId: string, comment: Comment) => void
  onReplyToComment: (postId: string, comment: Comment) => void
  onCancelReply: (postId: string) => void
  commentReplyTargetByPost: Record<string, { commentId: number; username: string } | null>
  commentLikeLoadingByPost: Record<string, Record<number, boolean>>
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
  onNavigateToEvents: () => void
  /** Otwiera profil po `username` (np. z modala uczestników wydarzenia). */
  onNavigateToProfileHandle?: (handle: string) => void
}

const unifiedCardGapCls = 'gap-4'

export default function FeedView({
  myProfile,
  displayName,
  currentUserId,
  isComposing,
  createBody,
  createImageFile,
  createImagePreview,
  createLoading,
  createError,
  onBodyChange,
  onImageFileChange,
  onComposeOpen,
  onComposeReset,
  onCreatePost,
  posts,
  postsLoading,
  postsError,
  hasNextPage = false,
  isFetchingNextPage = false,
  onFetchNextPage,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  commentsLoadingByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  commentReplyTargetByPost,
  commentLikeLoadingByPost,
  onDeletePost,
  onDeleteComment,
  selectedDepartment,
  onDepartmentChange,
  onNavigateToPost,
  onNavigateToUser,
  onNavigateToEvents,
  onNavigateToProfileHandle,
}: Props) {
  const { events, toggleRsvp, updateEvent } = useEvents()
  const {
    announcements: academicAnnouncements,
    loading: academicAnnouncementsLoading,
    error: academicAnnouncementsError,
  } = useAnnouncements(selectedDepartment)
  const unifiedPosts = usePosts({
    posts,
    likesCountByPost,
    likedPostIds,
    commentsCountByPost,
  })
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<UJEvent | null>(null)

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [events, selectedEventId],
  )

  /**
   * Sticky-island sync. Lewa wyspa (Komunikaty + Czat) trzymała stałe
   * `h-[600px]` + `h-[460px]`, więc na desktopie kończyła się w innym
   * miejscu niż prawa kolumna (Niezbędnik + Strefy + Wydarzenia UJ),
   * której wysokość wynika z naturalnej treści. Mierzymy więc renderowaną
   * wysokość prawego asiede `ResizeObserver`em i ustawiamy ją inline na
   * lewym aside; dzieci dzielą tę wysokość przez `flex-grow` w proporcji
   * 600:460 (zachowując dotychczasowy rytm wizualny).
   *
   * `useLayoutEffect` — sync musi nastąpić przed paintem, żeby nie było
   * FOUC z dziećmi o zerowej wysokości (basis-0 + grow). ResizeObserver
   * łapie też asynchronicznie ładowane treści po prawej (np. wydarzenia
   * z `useEvents`), więc nie potrzeba dodatkowych deps.
   */
  const leftAsideRef = useRef<HTMLElement | null>(null)
  const rightAsideRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const right = rightAsideRef.current
    const left = leftAsideRef.current
    if (!right || !left) return

    const sync = () => {
      const h = right.getBoundingClientRect().height
      if (h > 0) left.style.height = `${h}px`
    }

    sync()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(sync)
    observer.observe(right)
    return () => observer.disconnect()
  }, [])

  /**
   * Infinite-scroll sentinel. IntersectionObserver wywołuje `onFetchNextPage`
   * gdy `loadMoreRef` wjedzie w viewport (z 200px marginesem, żeby user nie
   * widział „przerwy" przy szybkim scrollu). `rootMargin: 200px 0px` to
   * pragmatyczny kompromis między prefetchem a niepotrzebną siecią.
   */
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!onFetchNextPage || !hasNextPage) return
    const node = loadMoreRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !isFetchingNextPage) {
          onFetchNextPage()
        }
      },
      { rootMargin: '200px 0px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onFetchNextPage, hasNextPage, isFetchingNextPage])

  const feedContent = (
    <div className="space-y-0">
      {!postsLoading && postsError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40 mb-3">
          Błąd: {postsError}
        </div>
      )}

      <div className="overflow-visible bg-transparent">
        {postsLoading && <FeedSkeleton count={4} />}

        {!postsLoading && !postsError && posts.length === 0 && (
          selectedDepartment ? (
            <EmptyState
              icon={Filter}
              title="Brak wpisów z tego wydziału"
              subtitle="Wybierz inny wydział lub dodaj pierwszy wpis z tej społeczności."
            />
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Brak wpisów"
              subtitle="Bądź pierwszy! Podziel się czymś ze społecznością UJ."
            />
          )
        )}

        {!postsLoading && !postsError && unifiedPosts.length > 0 && (
          <div className="w-full bg-transparent overflow-hidden divide-y divide-[#0f172a]/10 dark:divide-white/10">
            <AnimatePresence mode="sync">
              {unifiedPosts.map((uc, idx) => {
                const postId = uc.id
                return (
                  <motion.div
                    key={postId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                    className="w-full"
                  >
                    <PostCard
                      variant="stacked"
                      content={uc}
                      index={idx}
                      currentUserId={currentUserId}
                      myProfile={myProfile}
                      displayName={displayName}
                      isPop={heartPopPostId === postId}
                      isCommentsOpen={expandedComments.has(postId)}
                      comments={commentsByPost[postId] ?? []}
                      commentsLoading={Boolean(commentsLoadingByPost[postId])}
                      commentInputValue={commentInput[postId] ?? ''}
                      isCommentSubmitting={Boolean(commentSubmitting[postId])}
                      onToggleLike={() => onToggleLike(postId)}
                      onToggleComments={() => onToggleComments(postId)}
                      onSubmitComment={() => onSubmitComment(postId)}
                      onCommentInputChange={(v) => onCommentInputChange(postId, v)}
                      onToggleCommentLike={(comment) => onToggleCommentLike(postId, comment)}
                      onReplyToComment={(comment) => onReplyToComment(postId, comment)}
                      onCancelReply={() => onCancelReply(postId)}
                      replyTarget={commentReplyTargetByPost[postId] ?? null}
                      commentLikeLoadingById={commentLikeLoadingByPost[postId] ?? {}}
                      onDeletePost={() => onDeletePost(postId)}
                      onDeleteComment={(cId) => onDeleteComment(cId, postId)}
                      onNavigateToPost={() => onNavigateToPost(postId)}
                      onNavigateToUser={onNavigateToUser}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {!postsLoading && !postsError && unifiedPosts.length > 0 && (
          <>
            <div ref={loadMoreRef} aria-hidden className="h-1 w-full" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 rounded-full border-2 border-[#1e293b]/30 border-t-[#1e293b] animate-spin dark:border-brand-gold/30 dark:border-t-brand-gold-bright" />
              </div>
            )}
            {!hasNextPage && (
              <div className="pt-6 pb-3 text-center text-xs text-zinc-500 dark:text-zinc-500">
                Dotarłeś do końca tablicy.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(240px,320px)_minmax(0,920px)_minmax(240px,320px)] lg:items-start lg:justify-center lg:gap-6">

      {/*
        ── LEFT SIDEBAR (desktop only) ───────────────────────────────
        Top-anchored sticky: identyczna polityka klas jak prawy aside —
        `sticky top-4 self-start max-h-[calc(100vh-2rem)] pt-0`. Wcześniej
        lewy miał dodatkowy `pt-1 px-0.5 -mx-0.5 rounded-xl` + glass-track
        z `sideAsideTrackCls`, przez co cards startowały 4px niżej niż
        po prawej i wizualnie kolumna była niesymetryczna; usunięte żeby
        TOP i BOTTOM obu wysp leżały na tej samej linii.
        Wysokość lewego asiede jest synchronizowana z prawym przez
        `useLayoutEffect` + `ResizeObserver` (patrz `leftAsideRef`),
        żeby Komunikaty + Czat kończyły się dokładnie na poziomie
        ostatniej karty prawego asiede (Wydarzenia UJ). Dzieci dzielą
        tę wysokość przez `basis-0` + `grow-600/grow-460` zachowując
        oryginalną proporcję 600:460 z wcześniejszych stałych wysokości.
      */}
      <aside
        ref={leftAsideRef}
        className={`hidden lg:flex flex-col ${unifiedCardGapCls} sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-hidden custom-scrollbar pt-0`}
      >
        <div className="min-h-0 basis-0 grow-600">
          <AcademicAnnouncementsWidget
            announcements={academicAnnouncements}
            loading={academicAnnouncementsLoading}
            error={academicAnnouncementsError}
            heightClassName="h-full"
          />
        </div>
        <div className="min-h-0 basis-0 grow-460">
          <Suspense fallback={null}>
            <ChatAssistant
              myProfile={myProfile}
              displayName={displayName}
              heightClassName="h-full"
            />
          </Suspense>
        </div>
      </aside>

      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="flex min-w-0 w-full max-w-full flex-col items-stretch gap-4">
        <div className="mx-auto w-full max-w-2xl md:max-w-3xl lg:max-w-[900px] px-0">
          <div className="hidden md:flex w-full flex-col border border-zinc-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-950/50 overflow-hidden shadow-sm p-0">
            <ComposeBox
              myProfile={myProfile}
              displayName={displayName}
              isComposing={isComposing}
              body={createBody}
              imageFile={createImageFile}
              imagePreview={createImagePreview}
              isLoading={createLoading}
              error={createError}
              onBodyChange={onBodyChange}
              onImageFileChange={onImageFileChange}
              onOpen={onComposeOpen}
              onReset={onComposeReset}
              onSubmit={onCreatePost}
              embeddedInCard
            />
            <div className="h-[1px] w-full bg-zinc-200 dark:bg-white/10" />
            <div className="w-full py-3 bg-transparent dark:bg-black/20 border-x-0">
              <FeedFilters
                selectedDepartment={selectedDepartment}
                onDepartmentChange={onDepartmentChange}
              />
            </div>
            <div className="h-[1px] w-full bg-zinc-200 dark:bg-white/10" />
            <div className="w-full">
              {feedContent}
            </div>
          </div>

          <div className="w-full md:hidden">
            <MobileDashboard
              announcements={academicAnnouncements}
              announcementsLoading={academicAnnouncementsLoading}
            />
            <FeedFilters
              sticky
              selectedDepartment={selectedDepartment}
              onDepartmentChange={onDepartmentChange}
            />
            {feedContent}
          </div>
        </div>
      </div>

      {/*
        ── RIGHT SIDEBAR (desktop) ───────────────────────────────────
        Top-anchored sticky: identyczna polityka jak left rail — `top-4` +
        `self-start` + wewnętrzny `overflow-y-auto`. Wyspa kotwiczy się do
        górnej krawędzi viewportu i podąża z scrollem; nie zjeżdża do dna
        komórki gridu na wysokich viewportach.
      */}
      <aside
        ref={rightAsideRef}
        className={`hidden lg:flex flex-col ${unifiedCardGapCls} sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar pt-0`}
      >
        <Niezbednik />

        <CalendarMiniWidget className="shrink-0" />

        <GroupNav limit={3} className="shrink-0" />

        {/* Wydarzenia UJ */}
        <BaseCard variant="default" className="p-4 flex flex-col gap-4 shrink-0">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <CalendarDays size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
            <span className={`${sectionTitleCls} min-w-0 flex-1`}>Wydarzenia UJ</span>
            <button
              type="button"
              onClick={onNavigateToEvents}
              className={`shrink-0 rounded-lg px-1.5 py-1 text-xs font-medium ${sideHeaderLinkCls} ${sidePanelHoverFocus}`}
              aria-label="Przejdź do wszystkich wydarzeń"
            >
              Zobacz wszystkie →
            </button>
          </div>
          <div className="space-y-3">
            {events.slice(0, 3).map((ev) => (
              <CompactEventRow key={ev.id} event={ev} onSelect={() => setSelectedEventId(ev.id)} />
            ))}
          </div>
        </BaseCard>

        <p className="shrink-0 text-[11px] text-zinc-600 dark:text-zinc-400 text-center px-2 pb-1">
          UJverse &copy; {new Date().getFullYear()} &middot; dla społeczności UJ
        </p>
      </aside>

      <EventModal
        event={selectedEvent}
        currentUserId={currentUserId}
        onClose={() => setSelectedEventId(null)}
        onToggleRsvp={toggleRsvp}
        onEditRequest={(e) => {
          setEditTarget(e)
          setSelectedEventId(null)
        }}
        onNavigateToProfileHandle={
          onNavigateToProfileHandle
            ? (handle) => {
                setSelectedEventId(null)
                onNavigateToProfileHandle(handle)
              }
            : undefined
        }
      />

      <CreateEventModal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        onAdd={() => {}}
        editEvent={editTarget}
        onUpdate={updateEvent}
      />
    </div>
  )
}
