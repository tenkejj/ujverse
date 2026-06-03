import { CalendarDays, Filter, MessageCircle } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
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
import Niezbednik from './Niezbednik'
import MobileDashboard from './mobile/MobileDashboard'
import BaseCard from './ui/BaseCard'
import {
  sectionTitleCls,
  sideAsideTrackCls,
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

  const feedContent = (
    <div className="space-y-0">
      {!postsLoading && postsError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40 mb-3">
          Błąd: {postsError}
        </div>
      )}

      <div className="overflow-visible bg-transparent">
        {postsLoading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-[3px] border-uj-blue border-t-transparent animate-spin" />
          </div>
        )}

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
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:items-start lg:gap-4">

      {/* ── LEFT SIDEBAR (desktop only) ─────────────────────────────── */}
      <aside
        className={`hidden lg:flex lg:col-span-3 lg:min-w-[13rem] h-fit flex-col ${unifiedCardGapCls} sticky top-20 self-start custom-scrollbar pt-1 px-0.5 -mx-0.5 rounded-xl ${sideAsideTrackCls}`}
      >
        <AcademicAnnouncementsWidget
          announcements={academicAnnouncements}
          loading={academicAnnouncementsLoading}
          error={academicAnnouncementsError}
        />
        <Suspense fallback={null}>
          <ChatAssistant />
        </Suspense>
      </aside>

      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="lg:col-span-6 flex min-w-0 w-full max-w-full flex-col items-stretch gap-4">
        <div className="mx-auto w-full max-w-2xl px-0">
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

      {/* ── RIGHT SIDEBAR (desktop) — sticky bez scrolla kolumny; scroll tylko w liście Stref ── */}
      <aside
        className={`hidden lg:flex lg:col-span-3 lg:min-w-[13rem] flex-col ${unifiedCardGapCls} sticky top-20 self-start pt-0`}
      >
        <Niezbednik />

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
