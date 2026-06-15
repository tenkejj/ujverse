import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Heart, MessageCircle, MoreHorizontal, Trash2 } from 'lucide-react'
import type { Comment } from '../types'
import { getDeptAbbreviation } from '../lib/departments'
import { relativeTime } from '../lib/utils'
import { supabase } from '../supabaseClient'
import { toast } from '../lib/appToast'
import {
  INTERACTION_BAR_ROW,
  DEPT_BADGE_SPAN_CLASS,
  interactionMotionTap,
  secondaryInteractionButtonClass,
  likeActionButtonClass,
  heartLikedIconClass,
} from '../lib/interactionBar'
import UserAvatar from './UserAvatar'
import ReportModal from './ReportModal'

/** One fixed inset for all direct/indirect replies under a root comment (no staircase). */
const FLAT_REPLY_INDENT = 'ml-10'

const REPLIES_SPRING = { type: 'spring' as const, stiffness: 320, damping: 34 }

/** Single box model for every comment row (no per-author / reply branching). */
function CommentCardFrame({
  glassCardClass,
  children,
}: {
  glassCardClass: string
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 w-full self-stretch box-border ${glassCardClass}`}>
      <div className="min-w-0 w-full box-border p-2.5">{children}</div>
    </div>
  )
}

function parentReplyTag(parent: Comment) {
  const raw = parent.profiles?.username || parent.profiles?.full_name || 'użytkownik'
  const label = raw.trim().replace(/^@+/, '') || 'użytkownik'
  return label
}

function hasAnyMention(text: string): boolean {
  return /@[A-Za-z0-9_.-]+/.test(text)
}

function renderInlineMentions(
  text: string,
  parentMention: string | null,
  parentUserId: string | null,
  onNavigateToUser?: (userId: string) => void,
) {
  if (!text) return null
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g)
  return parts.map((part, index) => {
    const isMention = /^@[A-Za-z0-9_.-]+$/.test(part)
    if (!isMention) return <span key={`text-${index}`}>{part}</span>
    const canNavigateToParent =
      Boolean(onNavigateToUser) && Boolean(parentMention) && Boolean(parentUserId) && part === parentMention
    if (canNavigateToParent) {
      return (
        <button
          key={`mention-${index}`}
          type="button"
          onClick={() => onNavigateToUser?.(parentUserId as string)}
          className="inline cursor-pointer font-medium text-blue-500 hover:text-blue-400 hover:underline dark:text-brand-gold-bright dark:hover:text-brand-gold-bright"
        >
          {part}
        </button>
      )
    }
    return (
      <span
        key={`mention-${index}`}
        className="font-medium text-blue-500 dark:text-brand-gold-bright"
      >
        {part}
      </span>
    )
  })
}

type Props = {
  comment: Comment
  depth: number
  replyTarget: { commentId: number; username: string } | null
  commentLikeLoadingById?: Record<number, boolean>
  currentUserId: string
  isAdmin?: boolean
  commentsById: Map<number, Comment>
  commentsByParent: Map<number | null, Comment[]>
  onNavigateToUser?: (userId: string) => void
  onDeleteRequest: (comment: Comment) => void
  onToggleCommentLike: (comment: Comment) => void
  onReplyToComment: (comment: Comment) => void
  glassCardClass: string
  threadRowClass: string
}

export default function CommentItem({
  comment,
  depth,
  replyTarget,
  commentLikeLoadingById = {},
  currentUserId,
  isAdmin = false,
  commentsById,
  commentsByParent,
  onNavigateToUser,
  onDeleteRequest,
  onToggleCommentLike,
  onReplyToComment,
  glassCardClass,
  threadRowClass,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isReportSubmitting, setIsReportSubmitting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const cName = comment.profiles?.full_name || 'Użytkownik'
  const dept = comment.profiles?.department ?? null
  const deptAbbrev = dept ? getDeptAbbreviation(dept) : null
  const isOwnComment = comment.user_id === currentUserId
  const canDeleteComment = isOwnComment || isAdmin
  const canReportComment = !isOwnComment && Boolean(currentUserId)
  const hasCommentMenu = canDeleteComment || canReportComment
  const commentLikes = Math.max(0, Number(comment.likes_count ?? 0))
  const canLikeComment = Boolean(comment.can_like ?? !comment.is_reply)
  const isCommentLikeLoading = Boolean(commentLikeLoadingById[comment.id])
  const children = commentsByParent.get(comment.id) ?? []
  const hasChildren = children.length > 0
  const directReplyCount = children.length

  const parentId = comment.parent_id ?? null
  const parentComment =
    typeof parentId === 'number' && Number.isFinite(parentId) ? commentsById.get(parentId) : undefined
  const parentTagLabel = parentComment ? parentReplyTag(parentComment) : null
  const parentMention = parentTagLabel ? `@${parentTagLabel}` : null
  const shouldPrefixParentMention = Boolean(parentMention && parentComment && !hasAnyMention(comment.content))

  const avatarClass = 'size-9'
  const commentCardLightClass = `${glassCardClass} bg-gray-100 border-gray-200 dark:bg-bg-card dark:border-border-app`

  const repliesListClassName = ['flex min-w-0 flex-col gap-y-1.5', depth === 0 ? FLAT_REPLY_INDENT : '']
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!isMenuOpen) return
    const handleOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', handleOutsideClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  const handleReportComment = async (reason: string, details: string) => {
    if (!currentUserId) {
      toast.error('Musisz być zalogowany, aby zgłosić komentarz')
      return
    }
    setIsReportSubmitting(true)
    const { error } = await supabase.from('reports').insert({
      comment_id: comment.id,
      reporter_id: currentUserId,
      reason,
      details: details || null,
    })
    setIsReportSubmitting(false)
    if (error) {
      toast.error('Nie udało się wysłać zgłoszenia')
      return
    }
    toast.success('Zgłoszenie wysłane')
    setIsReportModalOpen(false)
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-y-1.5">
      <div className={`${threadRowClass} animate-comment-in w-full min-w-0`}>
        <div className="flex w-9 shrink-0 justify-center self-center">
          <div
            className={onNavigateToUser ? 'shrink-0 cursor-pointer' : 'shrink-0'}
            onClick={onNavigateToUser ? () => onNavigateToUser(comment.user_id) : undefined}
          >
            <UserAvatar profile={comment.profiles} name={cName} className={avatarClass} textSize="text-xs" />
          </div>
        </div>

        <CommentCardFrame glassCardClass={commentCardLightClass}>
            <div className="flex min-h-8 items-center gap-2 pr-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span
                  className={`truncate text-xs font-bold leading-none text-gray-900 dark:text-zinc-100 ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                  onClick={onNavigateToUser ? () => onNavigateToUser(comment.user_id) : undefined}
                >
                  {cName}
                </span>
                {deptAbbrev ? <span className={DEPT_BADGE_SPAN_CLASS}>{deptAbbrev}</span> : null}
                <span className="text-[10px] leading-none text-gray-500 dark:text-zinc-400">
                  {relativeTime(comment.created_at)}
                </span>
              </div>
              {hasCommentMenu ? (
                <div ref={menuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((current) => !current)}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-200 shrink-0"
                    aria-label="Więcej opcji komentarza"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white/85 p-1 backdrop-blur-md backdrop-saturate-150 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.35)] z-50 dark:border-white/10 dark:bg-bg-card/95 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]">
                      {canReportComment && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false)
                            setIsReportModalOpen(true)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
                        >
                          <Flag size={16} />
                          Zgłoś komentarz
                        </button>
                      )}
                      {canDeleteComment && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false)
                            onDeleteRequest(comment)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
                        >
                          <Trash2 size={16} />
                          Usuń komentarz
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-0.5 text-[13px] leading-snug text-gray-900 dark:text-zinc-100">
              <span>
                {shouldPrefixParentMention ? (
                  <span className="mr-1 inline-flex items-baseline align-baseline">
                    {onNavigateToUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (parentComment) onNavigateToUser(parentComment.user_id)
                        }}
                        className="inline cursor-pointer font-medium text-blue-500 hover:text-blue-400 hover:underline dark:text-brand-gold-bright dark:hover:text-brand-gold-bright"
                      >
                        {parentMention}
                      </button>
                    ) : (
                      <span className="inline font-medium text-blue-500 dark:text-brand-gold-bright">
                        {parentMention}
                      </span>
                    )}
                  </span>
                ) : null}
                {renderInlineMentions(
                  comment.content,
                  parentMention,
                  parentComment?.user_id ?? null,
                  onNavigateToUser,
                )}
              </span>
            </div>
            <div className={`${INTERACTION_BAR_ROW} mt-0.5 flex flex-row items-center flex-nowrap`}>
              <div className="flex min-w-0 items-center gap-x-4">
                <motion.button
                  type="button"
                  disabled={!canLikeComment || isCommentLikeLoading}
                  onClick={() => onToggleCommentLike(comment)}
                  {...interactionMotionTap}
                  className={`${likeActionButtonClass(Boolean(comment.is_liked))} disabled:cursor-not-allowed disabled:opacity-45`}
                  aria-label={comment.is_liked ? 'Usuń polubienie komentarza' : 'Polub komentarz'}
                >
                  <Heart
                    size={16}
                    strokeWidth={1.75}
                    className={
                      comment.is_liked
                        ? heartLikedIconClass
                        : 'shrink-0 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-200'
                    }
                  />
                  <span className="text-gray-500 dark:text-zinc-400 text-sm leading-none tabular-nums">
                    {commentLikes}
                  </span>
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => onReplyToComment(comment)}
                  {...interactionMotionTap}
                  className={secondaryInteractionButtonClass(replyTarget?.commentId === comment.id)}
                  aria-label="Odpowiedz na komentarz"
                >
                  <MessageCircle
                    size={16}
                    strokeWidth={replyTarget?.commentId === comment.id ? 2.25 : 1.75}
                    className={
                      replyTarget?.commentId === comment.id
                        ? 'shrink-0 text-gray-600 dark:text-zinc-200'
                        : 'shrink-0 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-200'
                    }
                  />
                </motion.button>
              </div>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setIsExpanded((v) => !v)}
                  aria-expanded={isExpanded}
                  className="ml-auto inline-flex items-center whitespace-nowrap text-right text-xs font-medium leading-tight text-gray-500 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:underline"
                >
                  {isExpanded ? 'Ukryj odpowiedzi' : `Pokaż odpowiedzi (${directReplyCount})`}
                </button>
              ) : null}
            </div>
        </CommentCardFrame>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren ? (
          <motion.div
            key={`replies-${comment.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={REPLIES_SPRING}
            className="min-w-0 overflow-hidden"
          >
            <div className={repliesListClassName}>
              {children.map((child) => (
                <CommentItem
                  key={child.id}
                  comment={child}
                  depth={depth + 1}
                  replyTarget={replyTarget}
                  commentLikeLoadingById={commentLikeLoadingById}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  commentsById={commentsById}
                  commentsByParent={commentsByParent}
                  onNavigateToUser={onNavigateToUser}
                  onDeleteRequest={onDeleteRequest}
                  onToggleCommentLike={onToggleCommentLike}
                  onReplyToComment={onReplyToComment}
                  glassCardClass={glassCardClass}
                  threadRowClass={threadRowClass}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ReportModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onConfirm={handleReportComment}
        title="Zgłoś komentarz"
        confirmLabel="Zgłoś"
        isSubmitting={isReportSubmitting}
      />
    </div>
  )
}
