import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Filter,
  GraduationCap,
  Link2 as LinkIcon,
  Mail,
  MessageCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Comment, Post, Profile } from '../types'
import { formatEventDateParts, type UJEvent } from '../data/mockEvents'
import { useEvents } from '../hooks/useEvents'
import ComposeBox from './ComposeBox'
import CreateEventModal from './CreateEventModal'
import EventModal from './EventModal'
import PostCard from './PostCard'
import DepartmentFilter from './DepartmentFilter'
import EmptyState from './EmptyState'
import { UJ_DEPARTMENTS, DEPT_SHORT } from '../lib/departments'

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
}

const UJ_ESSENTIAL_LINKS = [
  { label: 'USOSweb', href: 'https://usosweb.uj.edu.pl', Icon: GraduationCap, tag: 'Studia' },
  { label: 'Platforma PEGAZ', href: 'https://pegaz.uj.edu.pl', Icon: BookOpen, tag: 'E-learning' },
  { label: 'Poczta studencka', href: 'https://outlook.office.com/mail/', Icon: Mail, tag: 'Poczta' },
] as const

const widgetGoldCls = 'text-[#a48955] dark:text-brand-gold-bright'

const sideCardCls =
  'rounded-2xl border border-[#0f172a]/5 bg-card shadow-sm p-4 dark:border-white/5 dark:bg-bg-card/40 dark:backdrop-blur-md dark:shadow-none'

const sidePanelHoverFocus =
  'hover:bg-[#F0EDE4]/60 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48955]/35 dark:focus-visible:ring-brand-gold/35'

const deptFilterBtnBase =
  `w-full flex items-center text-left px-3 py-2.5 rounded-2xl border border-transparent text-sm transition-colors ${sidePanelHoverFocus}`

const deptFilterInactive =
  `${deptFilterBtnBase} font-medium text-[#1e293b] dark:text-slate-200`

const deptFilterActive =
  `${deptFilterBtnBase} font-bold text-[#a48955] dark:text-accent-interactive`

const sectionTitleCls = 'font-bold text-[10px] uppercase tracking-[0.2em] text-brand-gold'

const sectionLabelCls = `${sectionTitleCls} mb-3 block`

/** Podtytuły w panelach (tagi, kategorie) — czytelne w light i dark. */
const sideMutedCls = 'text-logo-navy/60 dark:text-slate-400'

/** Link „Zobacz wszystkie” — nieco jaśniejszy w dark mode. */
const sideMutedLinkCls =
  'text-logo-navy/60 dark:text-slate-300 group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright'

const sideRowCls =
  `group w-full flex items-start gap-3 rounded-2xl border border-[#0f172a]/5 bg-transparent p-3 cursor-pointer transition-colors dark:border-white/5 ${sidePanelHoverFocus}`

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
}: Props) {
  const { events, toggleRsvp, updateEvent } = useEvents()
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
      <aside className="hidden lg:flex lg:col-span-3 flex-col gap-3 sticky top-20 self-start max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar pt-1">

        <div className={sideCardCls}>
          <span className={sectionLabelCls}>Wydziały</span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onDepartmentChange('')}
              className={selectedDepartment === '' ? deptFilterActive : deptFilterInactive}
            >
              Wszystkie
            </button>
            {UJ_DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => onDepartmentChange(dept)}
                className={selectedDepartment === dept ? deptFilterActive : deptFilterInactive}
              >
                {DEPT_SHORT[dept] ?? dept}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="lg:col-span-6 flex flex-col gap-0">
        {/* ComposeBox — desktop only */}
        <div className="hidden md:block mb-3">
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

        {/* Horizontal dept filter — mobile only (desktop uses sidebar) */}
        <div className="lg:hidden mb-3">
          <DepartmentFilter selected={selectedDepartment} onChange={onDepartmentChange} />
        </div>

        {feedContent}
      </div>

      {/* ── RIGHT SIDEBAR (desktop only) ────────────────────────────── */}
      <aside className="hidden lg:flex lg:col-span-3 flex-col gap-3 sticky top-20 self-start max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar pt-1">

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
          <button
            type="button"
            onClick={onNavigateToEvents}
            className={`group w-full flex items-center gap-2 mb-3 rounded-xl -mx-1 px-1 py-1.5 text-left transition-colors ${sidePanelHoverFocus}`}
            aria-label="Przejdź do wszystkich wydarzeń"
          >
            <CalendarDays
              size={13}
              className={`${widgetGoldCls} shrink-0 transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
              strokeWidth={2}
            />
            <span className={`${sectionTitleCls} flex-1 min-w-0`}>Wydarzenia UJ</span>
            <span className={`text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${sideMutedLinkCls}`}>
              Zobacz wszystkie →
            </span>
          </button>
          <div className="space-y-2">
            {events.slice(0, 3).map((ev) => {
              const { monthLabel, dayNum } = formatEventDateParts(ev.date)
              const official = Boolean(ev.is_official)
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`${sideRowCls} text-left ${
                    official ? 'ring-1 ring-[#a48955]/25 bg-[#a48955]/[0.08] dark:ring-brand-gold/25 dark:bg-brand-gold/[0.06]' : ''
                  }`}
                >
                  <div className="shrink-0 text-center min-w-[36px]">
                    <span
                      className={`block text-[10px] font-bold ${widgetGoldCls} leading-none uppercase tracking-wide transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
                    >
                      {monthLabel}
                    </span>
                    <span className="block text-[15px] font-extrabold text-[#1e293b] dark:text-white leading-tight">
                      {dayNum}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-sm font-medium text-[#1e293b] dark:text-white leading-snug truncate min-w-0">
                        {ev.title}
                      </p>
                      {official ? (
                        <BadgeCheck
                          size={14}
                          className={`${widgetGoldCls} shrink-0 mt-0.5 transition-colors group-hover:text-[#7a6b45] dark:group-hover:text-brand-gold-bright`}
                          strokeWidth={2.5}
                          aria-label="Oficjalne UJ"
                        />
                      ) : null}
                    </div>
                    <span className={`text-xs ${sideMutedCls}`}>{ev.category}</span>
                  </div>
                </button>
              )
            })}
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
