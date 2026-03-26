import {
  MessageCircle,
  Filter,
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

const sideCardCls =
  'rounded-2xl border border-border-app bg-slate-100 p-3 font-sans shadow-none dark:bg-bg-app'

const deptFilterBtnBase =
  'w-full flex items-center text-left px-3 py-2 rounded-lg text-[13px] font-sans transition-colors'

const deptFilterInactive =
  `${deptFilterBtnBase} font-medium text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5`

const deptFilterActive =
  `${deptFilterBtnBase} font-bold text-accent-interactive`

const sectionLabelCls =
  'text-[10px] font-sans font-bold uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-3 block'

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
    <div className="space-y-0">
      {!postsLoading && postsError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40 mb-3">
          Błąd: {postsError}
        </div>
      )}

      <div className="border border-border-app bg-bg-app shadow-none overflow-hidden">
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

        <AnimatePresence mode="sync">
          {!postsLoading && !postsError && posts.map((post, idx) => {
            const postId = String(post?.id ?? `fallback-${idx}`)
            return (
              <motion.div
                key={postId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className="m-0 p-0 last:[&_article]:border-b-0"
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
              <p className="font-bold text-[14px] text-fg-primary truncate leading-snug">
                {displayName}
              </p>
              {myProfile?.department ? (
                <span className="text-[10px] text-accent-interactive font-bold uppercase tracking-wider bg-accent-interactive/10 px-1.5 py-0.5 rounded-full border border-accent-interactive/25 leading-none mt-0.5 inline-block">
                  {getDeptAbbreviation(myProfile.department)}
                </span>
              ) : (
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">Ustaw wydział</p>
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
      <div className="lg:col-span-9 flex flex-col gap-0">
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

    </div>
  )
}
