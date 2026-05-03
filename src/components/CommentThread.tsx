import { useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import type { Comment, Profile } from '../types'
import CommentItem from './CommentItem'
import UserAvatar from './UserAvatar'
import ConfirmModal from './ConfirmModal'
import { Skeleton } from './ui/Skeleton'

const THREAD_GRID_BASE = 'grid w-full grid-cols-[36px_minmax(0,1fr)] gap-x-2'

/** Comment rows: stretch so reply spines / multi-line cards align cleanly. */
const THREAD_ROW_GRID = `${THREAD_GRID_BASE} items-stretch`

const COMPOSER_ROW_GRID = `${THREAD_GRID_BASE} items-start`

function CommentRowSkeleton() {
  return (
    <div className={`${THREAD_ROW_GRID}`}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-[56px] w-full rounded-2xl" />
      </div>
    </div>
  )
}

type Props = {
  postId: string
  comments: Comment[]
  /** User-triggered fetch; combined with empty list shows skeleton (realtime refetches omit this). */
  isCommentsLoading?: boolean
  currentUserId: string
  myProfile: Profile | null
  displayName: string
  inputValue: string
  isSubmitting: boolean
  onInputChange: (value: string) => void
  onSubmit: () => void
  onDeleteComment: (commentId: number) => void
  onToggleCommentLike: (comment: Comment) => void
  onReplyToComment: (comment: Comment) => void
  onCancelReply: () => void
  replyTarget: { commentId: number; username: string } | null
  commentLikeLoadingById?: Record<number, boolean>
  onNavigateToUser?: (userId: string) => void
}

export default function CommentThread({
  postId,
  comments,
  isCommentsLoading = false,
  currentUserId,
  myProfile,
  displayName,
  inputValue,
  isSubmitting,
  onInputChange,
  onSubmit,
  onDeleteComment,
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  replyTarget,
  commentLikeLoadingById = {},
  onNavigateToUser,
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const glassCardClass =
    'rounded-2xl border border-gray-200 bg-gray-50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950'
  const threadRowClass = THREAD_ROW_GRID

  const showCommentSkeleton = Boolean(isCommentsLoading && comments.length === 0)
  const commentsById = useMemo(() => {
    const m = new Map<number, Comment>()
    for (const c of comments) m.set(c.id, c)
    return m
  }, [comments])

  const commentsByParent = useMemo(() => {
    const grouped = new Map<number | null, Comment[]>()
    for (const c of comments) {
      const parent = c.parent_id ?? null
      const bucket = grouped.get(parent)
      if (bucket) bucket.push(c)
      else grouped.set(parent, [c])
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return grouped
  }, [comments])

  const rootComments = commentsByParent.get(null) ?? []

  return (
    <div className="px-4 pb-3 pt-2.5">
      <div className="mx-auto w-full space-y-2">
        <div className={COMPOSER_ROW_GRID}>
          <UserAvatar profile={myProfile} name={displayName} className="size-9 shrink-0" textSize="text-xs" />
          <div
            className={`${glassCardClass} flex min-h-10 items-center gap-2 py-1 px-3 transition-colors focus-within:border-[#0f172a]/25 dark:focus-within:border-white/15`}
          >
            {replyTarget && (
              <div className="flex items-center gap-2 rounded-full bg-[#1e293b]/10 px-2 py-1 text-[11px] text-gray-900 dark:text-zinc-100 dark:bg-white/10">
                <span className="truncate">Odpowiadasz @{replyTarget.username}</span>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="text-gray-400 dark:text-zinc-500 transition-colors hover:text-gray-600 dark:hover:text-zinc-200"
                  aria-label="Anuluj odpowiedź"
                >
                  <X size={12} strokeWidth={1.75} />
                </button>
              </div>
            )}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit()
                }
              }}
              placeholder={replyTarget ? `Odpowiedz @${replyTarget.username}…` : 'Dodaj komentarz…'}
              maxLength={500}
              className="flex-1 bg-transparent py-1.5 text-[13px] text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none"
              aria-label={`Komentarz do posta ${postId}`}
            />
            <div className="mr-4 flex shrink-0 items-center">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!inputValue.trim() || isSubmitting}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Wyślij komentarz"
              >
                <Send className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div className={`space-y-1 ${showCommentSkeleton ? 'min-h-[200px]' : ''}`}>
          {showCommentSkeleton && (
            <div className="space-y-2" aria-busy aria-live="polite">
              <CommentRowSkeleton />
              <CommentRowSkeleton />
              <CommentRowSkeleton />
            </div>
          )}

          {!showCommentSkeleton &&
            rootComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                replyTarget={replyTarget}
                commentLikeLoadingById={commentLikeLoadingById}
                currentUserId={currentUserId}
                commentsById={commentsById}
                commentsByParent={commentsByParent}
                onNavigateToUser={onNavigateToUser}
                onDeleteRequest={(id) => setPendingDeleteId(id)}
                onToggleCommentLike={onToggleCommentLike}
                onReplyToComment={onReplyToComment}
                glassCardClass={glassCardClass}
                threadRowClass={threadRowClass}
              />
            ))}

          {!showCommentSkeleton && comments.length === 0 && (
            <p className="py-2 text-center text-xs text-gray-500 dark:text-zinc-400">
              Bądź pierwszą osobą, która skomentuje!
            </p>
          )}
        </div>
      </div>
      {pendingDeleteId !== null && (
        <ConfirmModal
          title="Usuń komentarz"
          message="Komentarz zostanie trwale usunięty. Tej operacji nie można cofnąć."
          confirmLabel="Usuń komentarz"
          onConfirm={() => onDeleteComment(pendingDeleteId)}
          onClose={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
