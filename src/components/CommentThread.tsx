import { useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import type { Comment, Profile } from '../types'
import { relativeTime } from '../lib/utils'
import UserAvatar from './UserAvatar'
import ConfirmModal from './ConfirmModal'

type Props = {
  postId: string
  comments: Comment[]
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

  return (
    <div className="animate-comment-in px-4 pb-4 pt-3 space-y-3">

      {/* Comment list */}
      {comments.map((c) => {
        const cName = c.profiles?.full_name || 'Użytkownik'
        const isOwnComment = c.user_id === currentUserId
        return (
          <div key={c.id} className="flex gap-2.5">
            <div
              className={onNavigateToUser ? 'cursor-pointer shrink-0 mt-0.5' : 'shrink-0 mt-0.5'}
              onClick={onNavigateToUser ? () => onNavigateToUser(c.user_id) : undefined}
            >
              <UserAvatar profile={c.profiles} name={cName} className="h-7 w-7" textSize="text-xs" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span
                    className={`text-xs font-bold text-fg-primary dark:text-white ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={onNavigateToUser ? () => onNavigateToUser(c.user_id) : undefined}
                  >{cName}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{relativeTime(c.created_at)}</span>
                  {isOwnComment && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(c.id)}
                      className="ml-auto rounded-full p-0.5 text-slate-600 transition-colors hover:text-red-500"
                      aria-label="Usuń komentarz"
                    >
                      <Trash2 size={11} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed text-fg-primary dark:text-slate-200">{c.content}</p>
              </div>
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {comments.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-1">Bądź pierwszą osobą, która skomentuje!</p>
      )}

      {/* Comment input */}
      <div className="flex gap-2.5 items-center pt-1">
        <UserAvatar profile={myProfile} name={displayName} className="h-7 w-7 shrink-0" textSize="text-xs" />
        <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-100 py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-[#1e293b]/50 dark:border-white/10 dark:bg-[#01020a]">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
            }}
            placeholder="Dodaj komentarz…"
            maxLength={500}
            className="flex-1 bg-transparent text-[13px] text-fg-primary placeholder:text-fg-secondary focus:outline-none dark:text-white dark:placeholder:text-slate-400"
            aria-label={`Komentarz do posta ${postId}`}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!inputValue.trim() || isSubmitting}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1e293b] dark:text-accent-interactive transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:opacity-30 active:scale-90"
            aria-label="Wyślij komentarz"
          >
            <Send size={14} strokeWidth={2} />
          </button>
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
