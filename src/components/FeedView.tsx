import {
  MessageCircle,
  Filter,
  CalendarDays,
  Link as LinkIcon,
  GraduationCap,
  BookOpen,
  Mail,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Comment, Post, Profile } from '../types'
import ComposeBox from './ComposeBox'
import PostCard from './PostCard'
import DepartmentFilter from './DepartmentFilter'
import EmptyState from './EmptyState'
import UserAvatar from './UserAvatar'
import { UJ_DEPARTMENTS, DEPT_SHORT, getDeptAbbreviation } from '../lib/departments'

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
}

const UPCOMING_EVENTS = [
  { date: '14 Maj', title: 'Juwenalia UJ 2026', tag: 'Wydarzenie' },
  { date: '22 Maj', title: 'Dni Wydziału WPiA 2026', tag: 'Wydział' },
  { date: '5 Cze', title: 'Rekrutacja 2026 – info', tag: 'Ogłoszenie' },
]

const UJ_ESSENTIAL_LINKS = [
  { label: 'USOSweb', href: 'https://usosweb.uj.edu.pl', Icon: GraduationCap },
  { label: 'Platforma PEGAZ', href: 'https://pegaz.uj.edu.pl', Icon: BookOpen },
  { label: 'Poczta studencka', href: 'https://outlook.office.com/mail/', Icon: Mail },
] as const

const sideCardCls =
  'bg-bg-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-lg dark:shadow-black/20 p-4'

const sectionLabelCls =
  'text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-3 block'

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
}: Props) {
  const feedContent = (
    <div className="space-y-6">
      {postsLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-[3px] border-uj-blue border-t-transparent animate-spin" />
        </div>
      )}

      {!postsLoading && postsError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100">
          Błąd: {postsError}
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

      <AnimatePresence mode="popLayout">
        {!postsLoading && !postsError && posts.map((post, idx) => {
          const postId = String(post?.id ?? `fallback-${idx}`)
          return (
            <motion.div
              key={postId}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
              layout
            >
              <PostCard
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
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-6">

      {/* ── LEFT SIDEBAR (desktop only) ─────────────────────────────── */}
      <aside className="hidden lg:flex lg:col-span-3 flex-col gap-3 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">

        {/* Mini profile widget */}
        <div className={sideCardCls}>
          <div className="flex items-center gap-3">
            <UserAvatar
              profile={myProfile}
              name={displayName}
              className="h-11 w-11 shrink-0"
              textSize="text-base"
            />
            <div className="min-w-0">
              <p className="font-bold text-[14px] text-slate-900 dark:text-blue-50 truncate leading-snug">
                {displayName}
              </p>
              {myProfile?.department ? (
                <span className="text-[10px] text-uj-orange font-bold uppercase tracking-wider bg-uj-orange/10 px-1.5 py-0.5 rounded-full border border-uj-orange/20 leading-none mt-0.5 inline-block">
                  {getDeptAbbreviation(myProfile.department)}
                </span>
              ) : (
                <p className="text-[12px] text-slate-400 dark:text-gray-500 mt-0.5">Ustaw wydział</p>
              )}
            </div>
          </div>
        </div>

        {/* Vertical department filter */}
        <div className={sideCardCls}>
          <span className={sectionLabelCls}>Wydziały</span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onDepartmentChange('')}
              className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                selectedDepartment === ''
                  ? 'bg-uj-blue text-white'
                  : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Wszystkie
            </button>
            {UJ_DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => onDepartmentChange(dept)}
                className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  selectedDepartment === dept
                    ? 'bg-uj-blue text-white font-semibold'
                    : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {DEPT_SHORT[dept] ?? dept}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── CENTER COLUMN ───────────────────────────────────────────── */}
      <div className="lg:col-span-6 space-y-3">
        {/* ComposeBox — desktop only */}
        <div className="hidden md:block">
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
        <div className="lg:hidden">
          <DepartmentFilter selected={selectedDepartment} onChange={onDepartmentChange} />
        </div>

        {feedContent}
      </div>

      {/* ── RIGHT SIDEBAR (desktop only) ────────────────────────────── */}
      <aside className="hidden lg:flex lg:col-span-3 flex-col gap-3 sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">

        {/* Niezbędnik UJ — szybkie linki */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-bg-card shadow-sm dark:shadow-lg dark:shadow-black/20">
          <div className="flex items-center gap-2">
            <LinkIcon size={14} className="text-slate-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Niezbędnik UJ
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {UJ_ESSENTIAL_LINKS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg p-2 -mx-2 transition-all cursor-pointer"
              >
                <Icon size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Upcoming events widget */}
        <div className={sideCardCls}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={13} className="text-uj-orange shrink-0" />
            <span className={`${sectionLabelCls} mb-0`}>Wydarzenia UJ</span>
          </div>
          <div className="space-y-3">
            {UPCOMING_EVENTS.map((ev) => (
              <div key={ev.title} className="flex items-start gap-3">
                <div className="shrink-0 text-center min-w-[36px]">
                  <span className="block text-[10px] font-bold text-uj-orange leading-none uppercase tracking-wide">
                    {ev.date.split(' ')[1]}
                  </span>
                  <span className="block text-[15px] font-extrabold text-slate-800 dark:text-blue-50 leading-tight">
                    {ev.date.split(' ')[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-slate-700 dark:text-gray-200 leading-snug truncate">
                    {ev.title}
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">{ev.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-slate-300 dark:text-gray-600 text-center px-2">
          UJverse &copy; {new Date().getFullYear()} &middot; dla społeczności UJ
        </p>
      </aside>

    </div>
  )
}
