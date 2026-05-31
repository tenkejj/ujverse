import { useEffect, useRef, useState, type MouseEvent } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Flag, Heart, MessageCircle, MoreHorizontal, Trash2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Comment, Profile } from '../types'
import type { PostMeta, UnifiedContent } from '../types/content'
import { relativeTime } from '../lib/utils'
import { getDeptAbbreviation } from '../lib/departments'
import { supabase } from '../supabaseClient'
import { toast } from '../lib/appToast'
import UserAvatar from './UserAvatar'
import CommentThread from './CommentThread'
import ConfirmModal from './ConfirmModal'
import ReportModal from './ReportModal'
import BaseCard from './ui/BaseCard'
import {
  INTERACTION_BAR_ROW,
  DEPT_BADGE_SPAN_CLASS,
  interactionMotionTap,
  secondaryInteractionButtonClass,
  likeActionButtonClass,
  heartLikedIconClass,
} from '../lib/interactionBar'

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
  onToggleCommentLike: (comment: Comment) => void
  onReplyToComment: (comment: Comment) => void
  onCancelReply: () => void
  replyTarget: { commentId: number; username: string } | null
  commentLikeLoadingById?: Record<number, boolean>
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
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  replyTarget,
  commentLikeLoadingById,
  onDeletePost,
  onDeleteComment,
  onNavigateToPost,
  onNavigateToUser,
  variant = 'card',
}: Props) {
  const navigate = useNavigate()
  const isFlat = variant === 'flat'
  const isStacked = variant === 'stacked'
  /** null — zamknięty; owner — własny wpis; admin — usuwanie cudzego wpisu przez administratora */
  const [deleteModalIntent, setDeleteModalIntent] = useState<'owner' | 'admin' | null>(null)
  const [isImageOpen, setIsImageOpen] = useState(false)
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isReportSubmitting, setIsReportSubmitting] = useState(false)
  const postMenuRef = useRef<HTMLDivElement | null>(null)

  const postId = content.id || `fallback-${index}`
  const body = content.body
  const hasBody = Boolean(body.trim())
  const { imageUrl, likeCount, commentCount, isLiked, authorUserId, department, tags } =
    content.metadata
  const createdAt = content.timestamp
  const authorName = content.author.displayName
  const authorId = authorUserId
  const isOwn = authorUserId === currentUserId
  const isAdmin = myProfile?.role === 'admin'
  const canDeletePost = isOwn || isAdmin
  const canReportPost = !isOwn && Boolean(currentUserId)
  const hasHeaderMenu = canDeletePost || canReportPost
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

  useEffect(() => {
    if (!isPostMenuOpen) return
    const handleOutsideClick = (event: PointerEvent) => {
      if (!postMenuRef.current?.contains(event.target as Node)) {
        setIsPostMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPostMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', handleOutsideClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isPostMenuOpen])

  const handleReportPost = async (reason: string) => {
    if (!content.id) {
      toast.error('Nie udało się zgłosić posta')
      return
    }
    if (!currentUserId) {
      toast.error('Musisz być zalogowany, aby zgłosić post')
      return
    }
    setIsReportSubmitting(true)
    const { error } = await supabase.from('reports').insert({
      post_id: content.id,
      reporter_id: currentUserId,
      reason,
    })
    setIsReportSubmitting(false)
    if (error) {
      toast.error('Nie udało się wysłać zgłoszenia')
      return
    }
    toast.success('Zgłoszenie wysłane')
    setIsReportModalOpen(false)
  }

  const innerBody = (
    <>
      <div
        className={`px-6 pt-6 pb-4 ${onNavigateToPost ? 'cursor-pointer' : ''}`}
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
              <div className={`relative flex items-center gap-2 flex-wrap ${hasHeaderMenu ? 'pr-8' : ''}`}>
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
                  <span className={DEPT_BADGE_SPAN_CLASS}>{getDeptAbbreviation(department)}</span>
                )}
                {createdAt && (
                  <span className="text-xs text-gray-400 ml-auto">{relativeTime(createdAt)}</span>
                )}
                {hasHeaderMenu && (
                  <div
                    ref={postMenuRef}
                    className="absolute -right-2 top-1/2 -translate-y-1/2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setIsPostMenuOpen((current) => !current)}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 shrink-0"
                      aria-label="Więcej opcji"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {isPostMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border-app bg-bg-card shadow-uj-soft dark:shadow-none z-50 p-1 overflow-hidden">
                        {canReportPost && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsPostMenuOpen(false)
                              setIsReportModalOpen(true)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
                          >
                            <Flag size={16} />
                            Zgłoś post
                          </button>
                        )}
                        {canDeletePost && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsPostMenuOpen(false)
                              setDeleteModalIntent(isAdmin && !isOwn ? 'admin' : 'owner')
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
                          >
                            <Trash2 size={16} />
                            Usuń post
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {hasBody && (
                <p className="mt-1.5 text-[15px] font-normal text-fg-primary dark:text-zinc-100 leading-relaxed whitespace-pre-line">
                  {body}
                </p>
              )}

              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/search?q=%23${encodeURIComponent(tag)}`)
                      }}
                      className="rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-0.5 text-xs font-medium text-brand-gold transition-all duration-150 hover:border-brand-gold/60 hover:bg-brand-gold/25 hover:shadow-[0_0_0_2px_rgba(232,200,74,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-bright/45 dark:text-brand-gold-bright dark:hover:bg-brand-gold-bright/20"
                      aria-label={`Filtruj po tagu #${tag}`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className={`${hasBody ? 'mt-3' : 'mt-1.5'} w-full h-auto max-h-[500px] object-contain cursor-pointer`}
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageOpen(true)
                }}
              />
            )}

            <div className={`${INTERACTION_BAR_ROW} mt-2.5 -mx-1 pr-2`}>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLike()
                }}
                disabled={!content.id}
                {...interactionMotionTap}
                className={likeActionButtonClass(isLiked)}
                aria-label={isLiked ? 'Usuń polubienie' : 'Polub'}
              >
                {isPop && (
                  <span className="absolute inset-0 rounded-full bg-[#1e293b]/35 dark:bg-brand-gold-bright/25 animate-like-ripple pointer-events-none" />
                )}
                <motion.span
                  animate={isPop ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="flex"
                >
                  <Heart
                    size={16}
                    strokeWidth={1.75}
                    className={isLiked ? heartLikedIconClass : 'shrink-0'}
                  />
                </motion.span>
                {typeof likeCount === 'number' && likeCount >= 0 && (
                  <span className="text-gray-400 text-sm leading-none tabular-nums">{likeCount}</span>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComments()
                }}
                {...interactionMotionTap}
                className={secondaryInteractionButtonClass(isCommentsOpen)}
                aria-label="Komentarze"
              >
                <MessageCircle
                  size={16}
                  strokeWidth={isCommentsOpen ? 2.25 : 1.75}
                  className="shrink-0"
                />
                {typeof commentCount === 'number' && commentCount >= 0 && (
                  <span className="text-gray-400 text-sm leading-none tabular-nums">{commentCount}</span>
                )}
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
              : 'border-t border-black/10 dark:border-white/10'
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
            onToggleCommentLike={onToggleCommentLike}
            onReplyToComment={onReplyToComment}
            onCancelReply={onCancelReply}
            replyTarget={replyTarget}
            commentLikeLoadingById={commentLikeLoadingById}
            onNavigateToUser={onNavigateToUser}
          />
        </div>
      )}

      {deleteModalIntent !== null && (
        <ConfirmModal
          title="Usuń wpis"
          message={
            deleteModalIntent === 'admin'
              ? 'Czy na pewno chcesz usunąć ten post jako administrator? Tej operacji nie można cofnąć.'
              : 'Tej operacji nie można cofnąć. Wpis zostanie trwale usunięty.'
          }
          confirmLabel="Usuń wpis"
          onConfirm={onDeletePost}
          onClose={() => setDeleteModalIntent(null)}
        />
      )}

      <ReportModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onConfirm={handleReportPost}
        title="Zgłoś post"
        confirmLabel="Zgłoś"
        isSubmitting={isReportSubmitting}
      />

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
            ? 'bg-transparent rounded-none border-0 shadow-none overflow-visible'
            : 'bg-transparent rounded-none border-0 shadow-none ring-0 ring-inset ring-transparent hover:bg-black/1 dark:hover:bg-white/2 overflow-hidden'
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
