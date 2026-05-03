import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MessageCircle, Trash2 } from 'lucide-react'
import type { Comment } from '../types'
import { getDeptAbbreviation } from '../lib/departments'
import { relativeTime } from '../lib/utils'
import {
  INTERACTION_BAR_ROW,
  DEPT_BADGE_SPAN_CLASS,
  interactionMotionTap,
  secondaryInteractionButtonClass,
  likeActionButtonClass,
  heartLikedIconClass,
} from '../lib/interactionBar'
import UserAvatar from './UserAvatar'

/** One fixed inset for all direct/indirect replies under a root comment (no staircase). */
const FLAT_REPLY_INDENT = 'ml-10'

const REPLIES_SPRING = { type: 'spring' as const, stiffness: 320, damping: 34 }

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
          className="inline cursor-pointer font-medium text-blue-500 transition-colors hover:text-blue-400 hover:underline dark:text-brand-gold-bright dark:hover:text-brand-gold-bright"
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
  commentsById: Map<number, Comment>
  commentsByParent: Map<number | null, Comment[]>
  onNavigateToUser?: (userId: string) => void
  onDeleteRequest: (id: number) => void
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

  const cName = comment.profiles?.full_name || 'Użytkownik'
  const dept = comment.profiles?.department ?? null
  const deptAbbrev = dept ? getDeptAbbreviation(dept) : null
  const isOwnComment = comment.user_id === currentUserId
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

  const repliesListClassName = ['flex min-w-0 flex-col gap-y-1.5', depth === 0 ? FLAT_REPLY_INDENT : '']
    .filter(Boolean)
    .join(' ')

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

        <div className={`${glassCardClass} min-w-0 self-stretch px-3 pt-1.5 pb-1`}>
          <div className="flex items-center gap-2 pr-4">
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
            {isOwnComment ? (
              <button
                type="button"
                onClick={() => onDeleteRequest(comment.id)}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                aria-label="Usuń komentarz"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
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
                      className="inline cursor-pointer font-medium text-blue-500 transition-colors hover:text-blue-400 hover:underline dark:text-brand-gold-bright dark:hover:text-brand-gold-bright"
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
          <div className={`${INTERACTION_BAR_ROW} mt-0.5 -mx-1 flex flex-row items-center flex-nowrap gap-1`}>
            <div className="flex min-w-0 items-center gap-1">
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
                      : 'transition-colors shrink-0 text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-200'
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
                      : 'shrink-0 text-gray-400 dark:text-zinc-500 transition-colors group-hover:text-gray-600 dark:group-hover:text-zinc-200'
                  }
                />
              </motion.button>
            </div>

            {hasChildren ? (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                aria-expanded={isExpanded}
                className="ml-auto inline-flex min-w-0 items-center truncate text-right text-xs font-medium leading-none text-gray-500 dark:text-zinc-400 transition-colors duration-200 hover:text-gray-600 dark:hover:text-zinc-200 hover:underline"
              >
                {isExpanded ? 'Ukryj odpowiedzi' : `Pokaż odpowiedzi (${directReplyCount})`}
              </button>
            ) : null}
          </div>
        </div>
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
    </div>
  )
}
