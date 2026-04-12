import { BookOpen, CalendarDays, Filter, GraduationCap, Link2 as LinkIcon, Mail, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Comment, Post, Profile } from '../types'
import type { UJEvent } from '../data/mockEvents'
import { useAnnouncements } from '../hooks/useAnnouncements'
import { useEvents } from '../hooks/useEvents'
import ComposeBox from './ComposeBox'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import PostCard from './PostCard'
import DepartmentFilter from './DepartmentFilter'
import AcademicAnnouncementsWidget from './AcademicAnnouncementsWidget'
import CompactEventRow from './CompactEventRow'
import EmptyState from './EmptyState'
import AnnouncementPills from './AnnouncementPills'
import MobileQuickAccessBar from './MobileQuickAccessBar'
import {
  sectionTitleCls,
  sideAsideTrackCls,
  sideCardCls,
  sideMutedCls,
  sideHeaderLinkCls,
  sidePanelHoverFocus,
  sideInnerRowCls,
  widgetGoldCls,
} from '../lib/sidePanelStyles'

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
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>

  // Handlers
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
  onNavigateToEvents: () => void
  /** Mobile: otwiera arkusz compose (FAB). */
  onMobileComposeTap?: () => void
}

const UJ_ESSENTIAL_LINKS = [
  { label: 'USOSweb', href: 'https://usosweb.uj.edu.pl', Icon: GraduationCap, tag: 'Studia' },
  { label: 'Platforma PEGAZ', href: 'https://pegaz.uj.edu.pl', Icon: BookOpen, tag: 'E-learning' },
  { label: 'Poczta studencka', href: 'https://outlook.office.com/mail/', Icon: Mail, tag: 'Poczta' },
] as const

const sideRowCls = `group w-full flex cursor-pointer items-start gap-3 transition-colors ${sideInnerRowCls} ${sidePanelHoverFocus}`

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
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onDeletePost,
  onDeleteComment,
  selectedDepartment,
  onDepartmentChange,
  onNavigateToPost,
  onNavigateToUser,
  onNavigateToEvents,
  onMobileComposeTap,
}: Props) {
  const { events, toggleRsvp, updateEvent } = useEvents()
  const {
    announcements: academicAnnouncements,
    loading: academicAnnouncementsLoading,
    error: academicAnnouncementsError,
  } = useAnnouncements()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<UJEvent | null>(null)

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [events, selectedEventId],
  )

  const feedContent = (
    <div className="space-y-3">
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

        {!postsLoading && !postsError && posts.length > 0 && (
          <div className="rounded-2xl border border-[#0f172a]/10 bg-card overflow-hidden shadow-sm divide-y divide-[#0f172a]/10 dark:border-white/10 dark:divide-white/10">
            <AnimatePresence mode="sync">
              {posts.map((post, idx) => {
                const postId = String(post?.id ?? `fallback-${idx}`)
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
                      post={post}
                      index={idx}
                      currentUserId={currentUserId}
                      myProfile={myProfile}
                      displayName={displayName}
                      likeCount={likesCountByPost[postId] ?? 0}
                      isLiked={Boolean(likedPostIds[postId])}
                      isPop={heartPopPostId === postId}
                      commentCount={commentsCountByPost[postId] ?? 0}
                      isCommentsOpen={expandedComments.has(postId)}
                      comments={commentsByPost[postId] ?? []}
                      commentInputValue={commentInput[postId] ?? ''}
                      isCommentSubmitting={Boolean(commentSubmitting[postId])}
                      onToggleLike={() => onToggleLike(postId)}
                      onToggleComments={() => onToggleComments(postId)}
                      onSubmitComment={() => onSubmitComment(postId)}
                      onCommentInputChange={(v) => onCommentInputChange(postId, v)}
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
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">

      {/* ── LEFT SIDEBAR (desktop only) ─────────────────────────────── */}
      <aside
        className={`hidden lg:flex lg:col-span-3 lg:min-w-[13rem] flex-col gap-3 sticky top-20 self-start max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar pt-1 px-0.5 -mx-0.5 rounded-xl ${sideAsideTrackCls}`}
      >
        <AcademicAnnouncementsWidget
          selectedDepartment={selectedDepartment}
          announcements={academicAnnouncements}
          loading={academicAnnouncementsLoading}
          error={academicAnnouncementsError}
        />
      </aside>

      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="lg:col-span-6 flex min-w-0 w-full max-w-full flex-col items-stretch gap-0 overflow-x-hidden">
        <div className="mx-auto w-full max-w-md -mx-4 space-y-2 px-4 pt-5 md:mx-0 md:max-w-none md:space-y-0 md:px-0 md:pt-0">
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => onMobileComposeTap?.()}
              className="m-0 w-full rounded-2xl border border-zinc-200/90 bg-white py-2.5 pl-4 pr-3 text-left shadow-lg transition-[background-color,border-color,box-shadow] hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-none focus-visible:border-[#C5A059]/55 focus-visible:ring-2 focus-visible:ring-[#C5A059]/20 dark:border-white/5 dark:bg-zinc-900/40 dark:shadow-none dark:backdrop-blur-md dark:hover:bg-zinc-900/55 dark:active:bg-zinc-900/65 dark:focus-visible:border-brand-gold/50 dark:focus-visible:ring-brand-gold/25"
            >
              <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-400">
                Co słychać na uczelni?
              </span>
            </button>
            <div className="mt-6 space-y-4">
              <MobileQuickAccessBar
                items={[
                  { label: 'USOS', href: 'https://usosweb.uj.edu.pl', Icon: GraduationCap },
                  { label: 'PEGAZ', href: 'https://pegaz.uj.edu.pl', Icon: BookOpen },
                  { label: 'POCZTA', href: 'https://outlook.office.com/mail/', Icon: Mail },
                ]}
              />
              <AnnouncementPills
                selectedDepartment={selectedDepartment}
                announcements={academicAnnouncements}
                loading={academicAnnouncementsLoading}
              />
            </div>
          </div>

          <div className="mb-3 hidden md:block">
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
            />
          </div>

          <div className="mb-2 m-0 w-full min-w-0 max-w-full p-0 md:mb-3">
            <DepartmentFilter selected={selectedDepartment} onChange={onDepartmentChange} />
          </div>

          {feedContent}
        </div>
      </div>

      {/* ── RIGHT SIDEBAR (desktop only) ────────────────────────────── */}
      <aside
        className={`hidden lg:flex lg:col-span-3 lg:min-w-[13rem] flex-col gap-3 sticky top-20 self-start max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar pt-1 px-0.5 -mx-0.5 rounded-xl ${sideAsideTrackCls}`}
      >
        {/* Niezbędnik UJ — szybkie linki (layout jak Wydarzenia UJ) */}
        <div className={sideCardCls}>
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
            <span className={sectionTitleCls}>Niezbędnik UJ</span>
          </div>
          <div className="space-y-2">
            {UJ_ESSENTIAL_LINKS.map(({ label, href, Icon, tag }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={sideRowCls}
              >
                <div className="shrink-0 flex items-center justify-center min-w-[36px] min-h-[36px]">
                  <Icon
                    size={18}
                    className={`${widgetGoldCls} shrink-0 transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
                    strokeWidth={2}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1e293b] dark:text-white leading-snug truncate">
                    {label}
                  </p>
                  <span className={`text-xs ${sideMutedCls}`}>{tag}</span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Upcoming events widget */}
        <div className={sideCardCls}>
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <CalendarDays size={13} className={`${widgetGoldCls} shrink-0`} strokeWidth={2} />
            <span className={`${sectionTitleCls} min-w-0 flex-1`}>Wydarzenia UJ</span>
            <button
              type="button"
              onClick={onNavigateToEvents}
              className={`shrink-0 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors ${sideHeaderLinkCls} ${sidePanelHoverFocus}`}
              aria-label="Przejdź do wszystkich wydarzeń"
            >
              Zobacz wszystkie →
            </button>
          </div>
          <div className="space-y-2">
            {events.slice(0, 3).map((ev) => (
              <CompactEventRow key={ev.id} event={ev} onSelect={() => setSelectedEventId(ev.id)} />
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-logo-navy/50 dark:text-slate-400 text-center px-2">
          UJverse &copy; {new Date().getFullYear()} &middot; dla społeczności UJ
        </p>
      </aside>

      <EventModal
        event={selectedEvent}
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
