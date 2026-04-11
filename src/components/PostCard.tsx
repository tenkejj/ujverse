import { useState, type MouseEvent } from 'react'
import ReactDOM from 'react-dom'
import { Heart, MessageCircle, Share2, Trash2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from '../lib/appToast'
import type { Comment, Post, Profile } from '../types'
import { relativeTime } from '../lib/utils'
import { getDeptAbbreviation } from '../lib/departments'
import UserAvatar from './UserAvatar'
import CommentThread from './CommentThread'
import ConfirmModal from './ConfirmModal'

function LightboxPortal({ src, onClose }: { src: string; onClose: () => void }) {
  const portal = document.getElementById('lightbox-portal')
  if (!portal) return null
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
        aria-label="Zamknij"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-none"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    portal,
  )
}

type Props = {
  post: Post
  index: number
  currentUserId: string
  myProfile: Profile | null
  displayName: string
  likeCount: number
  isLiked: boolean
  isPop: boolean
  commentCount: number
  isCommentsOpen: boolean
  comments: Comment[]
  commentInputValue: string
  isCommentSubmitting: boolean
  onToggleLike: () => void
  onToggleComments: () => void
  onSubmitComment: () => void
  onCommentInputChange: (value: string) => void
  onDeletePost: () => void
  onDeleteComment: (commentId: number) => void
  onNavigateToPost?: () => void
  onNavigateToUser?: (userId: string) => void
  /** card: pojedyncza karta | flat: bez ramki | stacked: wpis na liście (linie z parent divide-y) */
  variant?: 'card' | 'flat' | 'stacked'
}

export default function PostCard({
  post,
  index,
  currentUserId,
  myProfile,
  displayName,
  likeCount,
  isLiked,
  isPop,
  commentCount,
  isCommentsOpen,
  comments,
  commentInputValue,
  isCommentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onDeletePost,
  onDeleteComment,
  onNavigateToPost,
  onNavigateToUser,
  variant = 'card',
}: Props) {
  const isFlat = variant === 'flat'
  const isStacked = variant === 'stacked'
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isImageOpen, setIsImageOpen] = useState(false)

  const postId = String(post?.id ?? `fallback-${index}`)
  const content = post?.content ?? ''
  const imageUrl = post?.image_url ?? null
  const createdAt = post?.created_at
  const author = post?.profiles
  const authorName = author?.full_name || 'Użytkownik'
  const authorId = post?.user_id || (post?.profiles as { id?: string } | null)?.id
  const isOwn = post?.user_id === currentUserId

  const handleArticleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onNavigateToPost) return
    const t = e.target as HTMLElement
    if (t.closest('button, a, textarea, input')) return
    if (t.closest('img')) return
    onNavigateToPost()
  }

  return (
    <article
      key={postId}
      className={
        isFlat
          ? 'bg-transparent rounded-none border-0 shadow-none overflow-visible transition-colors'
          : isStacked
            ? 'bg-transparent rounded-none border-0 shadow-none ring-0 ring-inset ring-transparent transition-[background-color,box-shadow] duration-150 hover:bg-[#0f172a]/[0.02] hover:shadow-[inset_0_0_0_1px_rgb(164_137_85/0.14)] dark:hover:bg-white/[0.04] dark:hover:shadow-[inset_0_0_0_1px_rgb(201_162_39/0.2)] overflow-hidden'
            : 'bg-card rounded-2xl border border-[#0f172a]/5 dark:border-white/10 shadow-sm dark:shadow-lg dark:shadow-black/25 transition-[border-color,box-shadow] duration-200 hover:shadow-[0_4px_20px_-4px_rgb(15_23_42/0.07)] dark:hover:border-brand-gold/20 dark:hover:shadow-xl active:shadow-sm overflow-hidden'
      }
    >
      {/* Post body */}
      <div
        className={`p-4 ${onNavigateToPost ? 'cursor-pointer' : ''}`}
        onClick={handleArticleClick}
      >
        <div className="flex gap-3">

          {/* Left column: avatar + optional thread line */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                const finalId = post?.user_id || (post?.profiles as { id?: string } | null)?.id
                if (onNavigateToUser && finalId) onNavigateToUser(finalId)
              }}
            >
              <UserAvatar profile={author} name={authorName} className="h-10 w-10" textSize="text-sm" />
            </div>
          </div>

          {/* Right column */}
          <div className="flex-1 min-w-0">

            <div>
              {/* Author row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-bold text-fg-primary text-[14px] leading-tight ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onNavigateToUser && authorId) onNavigateToUser(authorId)
                  }}
                >{authorName}</span>
                {author?.department && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#a48955] bg-[#1e293b]/[0.08] px-1.5 py-0.5 rounded-full border border-[#1e293b]/20 leading-none dark:text-accent-interactive dark:bg-accent-interactive/10 dark:border-accent-interactive/25">
                    {getDeptAbbreviation(author.department)}
                  </span>
                )}
                {createdAt && (
                  <span className="text-xs text-fg-secondary ml-auto">{relativeTime(createdAt)}</span>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteOpen(true) }}
                    className="p-1 rounded-full text-slate-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    aria-label="Usuń post"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                )}
              </div>

              {/* Content */}
              <p className="mt-1.5 text-[15px] font-normal text-fg-primary dark:text-slate-200 leading-relaxed whitespace-pre-line">{content}</p>
            </div>

            {/* Image — stopPropagation opens lightbox, not SinglePostView */}
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mt-3 w-full h-auto max-h-[500px] object-contain cursor-pointer"
                loading="lazy"
                onClick={(e) => { e.stopPropagation(); setIsImageOpen(true) }}
              />
            )}

            {/* Action bar */}
            <div className="flex items-center mt-3 -mx-1.5 gap-0.5">

              {/* Comments button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleComments() }}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                  isCommentsOpen
                    ? 'text-accent-interactive bg-accent-interactive/10 dark:bg-accent-interactive/15'
                    : 'text-fg-primary/50 dark:text-slate-400 hover:text-accent-interactive hover:bg-accent-interactive/5 dark:hover:bg-accent-interactive/10 [&_svg]:group-hover:text-accent-interactive'
                }`}
                aria-label="Komentarze"
              >
                <MessageCircle
                  size={15}
                  strokeWidth={isCommentsOpen ? 2.5 : 1.75}
                  className="transition-all"
                />
                {commentCount > 0 && <span className="tabular-nums leading-none">{commentCount}</span>}
              </button>

              {/* Like button */}
              <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleLike() }}
                disabled={!post?.id}
                className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[13px] font-medium transition-colors disabled:opacity-50 ${
                  isLiked
                    ? 'text-accent-interactive bg-accent-interactive/15'
                    : 'text-fg-primary/50 dark:text-slate-400 hover:text-accent-interactive hover:bg-accent-interactive/10 [&_svg]:group-hover:text-accent-interactive'
                }`}
                aria-label={isLiked ? 'Usuń polubienie' : 'Polub'}
              >
                {isPop && (
                  <span className="absolute inset-0 rounded-full bg-accent-interactive/35 animate-like-ripple pointer-events-none" />
                )}
                <motion.span
                  animate={isPop ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="flex"
                >
                  <Heart
                    size={15}
                    strokeWidth={1.75}
                    className={`transition-colors ${isLiked ? 'fill-accent-interactive stroke-accent-interactive' : ''}`}
                  />
                </motion.span>
                {likeCount > 0 && (
                  <span className="tabular-nums leading-none text-accent-interactive">{likeCount}</span>
                )}
              </motion.button>

              {/* Share */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const url = `${window.location.origin}?post=${postId}`
                  navigator.clipboard.writeText(url).then(() => {
                    toast.success('Link skopiowany!')
                  }).catch(() => {
                    toast.error('Nie udało się skopiować linku.')
                  })
                }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-fg-primary/45 dark:text-slate-500 hover:text-accent-interactive dark:hover:text-accent-interactive hover:bg-[#F0EDE4]/70 dark:hover:bg-white/5 text-[13px] transition-colors"
                aria-label="Udostępnij"
              >
                <Share2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments thread */}
      {isCommentsOpen && (
        <div
          className={
            isFlat
              ? 'border-t border-white/10'
              : 'border-t border-[#0f172a]/10 dark:border-white/10'
          }
        >
          <CommentThread
            postId={postId}
            comments={comments}
            currentUserId={currentUserId}
            myProfile={myProfile}
            displayName={displayName}
            inputValue={commentInputValue}
            isSubmitting={isCommentSubmitting}
            onInputChange={onCommentInputChange}
            onSubmit={onSubmitComment}
            onDeleteComment={onDeleteComment}
            onNavigateToUser={onNavigateToUser}
          />
        </div>
      )}

      {confirmDeleteOpen && (
        <ConfirmModal
          title="Usuń wpis"
          message="Tej operacji nie można cofnąć. Wpis zostanie trwale usunięty."
          confirmLabel="Usuń wpis"
          onConfirm={onDeletePost}
          onClose={() => setConfirmDeleteOpen(false)}
        />
      )}

      {isImageOpen && imageUrl && (
        <LightboxPortal src={imageUrl} onClose={() => setIsImageOpen(false)} />
      )}
    </article>
  )
}
