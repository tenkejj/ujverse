import { useState, type MouseEvent } from 'react'
import ReactDOM from 'react-dom'
import { Heart, MessageCircle, Share2, Trash2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from '../lib/appToast'
import type { Comment, Profile } from '../types'
import type { PostMeta, UnifiedContent } from '../types/content'
import { relativeTime } from '../lib/utils'
import { getDeptAbbreviation } from '../lib/departments'
import UserAvatar from './UserAvatar'
import CommentThread from './CommentThread'
import ConfirmModal from './ConfirmModal'
import BaseCard from './ui/BaseCard'

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
  /** Ujednolicona treść posta (z `DataService.toUnifiedPosts`). */
  content: UnifiedContent<PostMeta>
  index: number
  currentUserId: string
  myProfile: Profile | null
  displayName: string
  isPop: boolean
  isCommentsOpen: boolean
  comments: Comment[]
  /** Initial fetch for this thread (realtime refetches do not set this). */
  commentsLoading?: boolean
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
  content,
  index,
  currentUserId,
  myProfile,
  displayName,
  isPop,
  isCommentsOpen,
  comments,
  commentsLoading = false,
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

  const postId = content.id || `fallback-${index}`
  const body = content.body
  const { imageUrl, likeCount, commentCount, isLiked, authorUserId, department } = content.metadata
  const createdAt = content.timestamp
  const authorName = content.author.displayName
  const authorId = authorUserId
  const isOwn = authorUserId === currentUserId
  const authorProfile: Profile = {
    id: content.author.id,
    full_name: content.author.displayName,
    avatar_url: content.author.avatarUrl ?? null,
    department,
  }

  const handleArticleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onNavigateToPost) return
    const t = e.target as HTMLElement
    if (t.closest('button, a, textarea, input')) return
    if (t.closest('img')) return
    onNavigateToPost()
  }

  const innerBody = (
    <>
      <div
        className={`p-6 ${onNavigateToPost ? 'cursor-pointer' : ''}`}
        onClick={handleArticleClick}
      >
        <div className="flex gap-3">
          <div className="flex flex-col items-center shrink-0">
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                if (onNavigateToUser && authorId) onNavigateToUser(authorId)
              }}
            >
              <UserAvatar
                profile={authorProfile}
                name={authorName}
                className="h-10 w-10"
                textSize="text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`font-bold text-fg-primary text-base leading-tight ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onNavigateToUser && authorId) onNavigateToUser(authorId)
                  }}
                >
                  {authorName}
                </span>
                {department && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#1e293b] bg-[#1e293b]/[0.08] px-1.5 py-0.5 rounded-full border border-[#1e293b] leading-none dark:text-accent-interactive dark:bg-accent-interactive/10 dark:border-accent-interactive/25">
                    {getDeptAbbreviation(department)}
                  </span>
                )}
                {createdAt && (
                  <span className="text-xs text-fg-secondary ml-auto">{relativeTime(createdAt)}</span>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteOpen(true)
                    }}
                    className="p-1 rounded-full text-slate-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    aria-label="Usuń post"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                )}
              </div>

              <p className="mt-1.5 text-[15px] font-normal text-fg-primary dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {body}
              </p>
            </div>

            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mt-3 w-full h-auto max-h-[500px] object-contain cursor-pointer"
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageOpen(true)
                }}
              />
            )}

            <div className="flex items-center mt-3 -mx-1 gap-1.5">
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComments()
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className={`group inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 py-2 transition-colors ${
                  isCommentsOpen
                    ? 'text-[#1e293b] bg-[#1e293b]/10 dark:text-accent-interactive dark:bg-accent-interactive/15'
                    : 'text-fg-primary/60 dark:text-slate-400 hover:text-[#1e293b] hover:bg-[#1e293b]/10 dark:hover:text-accent-interactive dark:hover:bg-white/5 [&_svg]:group-hover:text-[#1e293b] dark:[&_svg]:group-hover:text-accent-interactive'
                }`}
                aria-label="Komentarze"
              >
                <MessageCircle size={16} strokeWidth={isCommentsOpen ? 2.25 : 1.75} className="shrink-0" />
                {typeof commentCount === 'number' && commentCount >= 0 && (
                  <span className="text-fg-secondary text-sm leading-none tabular-nums">{commentCount}</span>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLike()
                }}
                disabled={!content.id}
                className={`group relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 py-2 transition-colors disabled:opacity-50 ${
                  isLiked
                    ? 'text-[#1e293b] bg-[#1e293b]/15 dark:text-accent-interactive'
                    : 'text-fg-primary/60 dark:text-slate-400 hover:text-[#1e293b] hover:bg-[#1e293b]/10 [&_svg]:group-hover:text-[#1e293b] dark:hover:text-accent-interactive dark:hover:bg-white/5 dark:[&_svg]:group-hover:text-accent-interactive'
                }`}
                aria-label={isLiked ? 'Usuń polubienie' : 'Polub'}
              >
                {isPop && (
                  <span className="absolute inset-0 rounded-full bg-[#1e293b]/35 dark:bg-accent-interactive/35 animate-like-ripple pointer-events-none" />
                )}
                <motion.span
                  animate={isPop ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="flex"
                >
                  <Heart
                    size={16}
                    strokeWidth={1.75}
                    className={`transition-colors shrink-0 ${isLiked ? 'fill-[#1e293b] stroke-[#1e293b] dark:fill-accent-interactive dark:stroke-accent-interactive' : ''}`}
                  />
                </motion.span>
                {typeof likeCount === 'number' && likeCount >= 0 && (
                  <span className="text-fg-secondary text-sm leading-none tabular-nums">{likeCount}</span>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const url = `${window.location.origin}?post=${postId}`
                  navigator.clipboard
                    .writeText(url)
                    .then(() => {
                      toast.success('Link skopiowany!')
                    })
                    .catch(() => {
                      toast.error('Nie udało się skopiować linku.')
                    })
                }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-fg-primary/60 dark:text-slate-400 hover:text-[#1e293b] dark:hover:text-accent-interactive hover:bg-[#1e293b]/10 dark:hover:bg-white/5 transition-colors"
                aria-label="Udostępnij"
              >
                <Share2 size={16} strokeWidth={1.75} className="shrink-0" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

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
            isCommentsLoading={commentsLoading}
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
    </>
  )

  if (isFlat || isStacked) {
    // Stacked / flat używają kontenerów nadrzędnych (divide-y), BaseCard nie pasuje —
    // utrzymujemy istniejący transparentny wrapper z klasami hover.
    return (
      <article
        key={postId}
        className={
          isFlat
            ? 'bg-transparent rounded-none border-0 shadow-none overflow-visible transition-colors'
            : 'bg-transparent rounded-none border-0 shadow-none ring-0 ring-inset ring-transparent transition-[background-color,box-shadow] duration-150 hover:bg-[#0f172a]/[0.02] hover:shadow-[inset_0_0_0_1px_rgb(30_41_59/0.18)] dark:hover:bg-white/[0.04] dark:hover:shadow-[inset_0_0_0_1px_rgb(201_162_39/0.2)] overflow-hidden'
        }
      >
        {innerBody}
      </article>
    )
  }

  return (
    <BaseCard
      as="article"
      variant="default"
      flush
      interactive={Boolean(onNavigateToPost)}
      className="overflow-hidden"
    >
      {innerBody}
    </BaseCard>
  )
}
