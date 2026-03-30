import { useState } from 'react'
import ReactDOM from 'react-dom'
import { Heart, MessageCircle, Share2, Trash2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md"
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
        className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl"
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
}: Props) {
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

  return (
    <article
      key={postId}
      className="bg-white dark:bg-bg-card/80 rounded-2xl border border-slate-200 dark:border-border-app shadow-sm dark:shadow-lg dark:shadow-black/25 hover:border-slate-300 dark:hover:border-[#252a4a] transition-all duration-200 hover:scale-[1.005] md:hover:scale-[1.01] active:scale-[0.99] overflow-hidden"
    >
      {/* Post body */}
      <div className="px-4 pt-4 pb-1">
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
            {isCommentsOpen && (
              <div className="w-px flex-1 mt-1.5 bg-gradient-to-b from-uj-blue/30 via-uj-blue/10 to-transparent min-h-[24px]" />
            )}
          </div>

          {/* Right column */}
          <div className="flex-1 min-w-0 pb-3">

            {/* Clickable content area — navigates to SinglePostView */}
            <div
              onClick={onNavigateToPost}
              className={onNavigateToPost ? 'cursor-pointer' : undefined}
            >
              {/* Author row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-bold text-slate-900 dark:text-blue-50 text-[14px] leading-tight ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onNavigateToUser && authorId) onNavigateToUser(authorId)
                  }}
                >{authorName}</span>
                {author?.department && (
                  <span className="text-[9px] text-uj-orange font-bold uppercase tracking-wider bg-uj-orange/10 px-1.5 py-0.5 rounded-full border border-uj-orange/20 leading-none">
                    {getDeptAbbreviation(author.department)}
                  </span>
                )}
                {createdAt && (
                  <span className="text-xs text-slate-400 dark:text-gray-500 ml-auto">{relativeTime(createdAt)}</span>
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
              <p className="mt-1.5 text-[15px] font-normal text-slate-600 dark:text-slate-200 leading-relaxed whitespace-pre-line">{content}</p>
            </div>

            {/* Image — outside nav wrapper so click opens lightbox, not SinglePostView */}
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mt-3 w-full h-auto max-h-[500px] object-contain rounded-xl cursor-pointer"
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
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  isCommentsOpen
                    ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'text-slate-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50/80 dark:hover:bg-blue-900/20'
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
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                className={`relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[13px] font-medium transition-all disabled:opacity-50 ${
                  isLiked
                    ? 'text-uj-orange bg-uj-orange/10'
                    : 'text-slate-400 dark:text-gray-500 hover:text-uj-orange hover:bg-uj-orange/10'
                }`}
                aria-label={isLiked ? 'Usuń polubienie' : 'Polub'}
              >
                {isPop && (
                  <span className="absolute inset-0 rounded-full bg-rose-300/40 animate-like-ripple pointer-events-none" />
                )}
                <motion.span
                  animate={isPop ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="flex"
                >
                  <Heart
                    size={15}
                    strokeWidth={1.75}
                    className={`transition-colors ${isLiked ? 'fill-uj-orange stroke-uj-orange' : ''}`}
                  />
                </motion.span>
                {likeCount > 0 && <span className="tabular-nums leading-none">{likeCount}</span>}
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
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 text-[13px] transition-all"
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
