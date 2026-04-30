import { useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import type { Comment, Profile } from '../types'
import { relativeTime } from '../lib/utils'
import UserAvatar from './UserAvatar'
import ConfirmModal from './ConfirmModal'
import { Skeleton } from './ui/Skeleton'

function CommentRowSkeleton() {
  return (
    <div className="flex gap-2.5">
      <Skeleton className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-[52px] w-full rounded-2xl" />
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
  onNavigateToUser,
}: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const showCommentSkeleton = Boolean(isCommentsLoading && comments.length === 0)

  return (
    <div className="px-4 pb-4 pt-3 space-y-3">
      {/* Composer first — stable position; list loads below without pushing the form down */}
      <div className="flex gap-2.5 items-center">
        <UserAvatar profile={myProfile} name={displayName} className="h-8 w-8 shrink-0" textSize="text-xs" />
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-100/90 py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-[#1e293b]/45 dark:border-white/12 dark:bg-white/3 dark:backdrop-blur-sm">
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
            placeholder="Dodaj komentarz…"
            maxLength={500}
            className="flex-1 bg-transparent py-2 text-[13px] text-fg-primary placeholder:text-fg-secondary focus:outline-none dark:text-white dark:placeholder:text-slate-400"
            aria-label={`Komentarz do posta ${postId}`}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!inputValue.trim() || isSubmitting}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-all text-[#1e293b] hover:bg-[#1e293b]/10 dark:text-accent-interactive dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
            aria-label="Wyślij komentarz"
          >
            <Send size={18} strokeWidth={2} className="shrink-0" />
          </button>
        </div>
      </div>

      {/* List region: reserved min-height while skeleton shows to reduce CLS */}
      <div className={`space-y-3 ${showCommentSkeleton ? 'min-h-[240px]' : ''}`}>
        {showCommentSkeleton && (
          <div className="space-y-3" aria-busy aria-live="polite">
            <CommentRowSkeleton />
            <CommentRowSkeleton />
            <CommentRowSkeleton />
          </div>
        )}

        {!showCommentSkeleton &&
          comments.map((c) => {
            const cName = c.profiles?.full_name || 'Użytkownik'
            const isOwnComment = c.user_id === currentUserId
            return (
              <div key={c.id} className="flex animate-comment-in gap-2.5">
                <div
                  className={onNavigateToUser ? 'mt-0.5 shrink-0 cursor-pointer' : 'mt-0.5 shrink-0'}
                  onClick={onNavigateToUser ? () => onNavigateToUser(c.user_id) : undefined}
                >
                  <UserAvatar profile={c.profiles} name={cName} className="h-7 w-7" textSize="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 backdrop-blur-sm dark:border-white/12 dark:bg-white/3">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span
                        className={`text-xs font-bold text-fg-primary dark:text-white ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                        onClick={onNavigateToUser ? () => onNavigateToUser(c.user_id) : undefined}
                      >
                        {cName}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {relativeTime(c.created_at)}
                      </span>
                      {isOwnComment && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(c.id)}
                          className="ml-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-200/80 hover:text-red-500 dark:hover:bg-white/10"
                          aria-label="Usuń komentarz"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-fg-primary dark:text-slate-200">{c.content}</p>
                  </div>
                </div>
              </div>
            )
          })}

        {!showCommentSkeleton && comments.length === 0 && (
          <p className="py-2 text-center text-xs text-slate-400">Bądź pierwszą osobą, która skomentuje!</p>
        )}
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
