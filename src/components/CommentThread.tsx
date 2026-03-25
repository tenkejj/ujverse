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
    <div className="animate-comment-in border-t border-slate-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-3">

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
              <div className="bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-3 py-2">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className={`text-xs font-bold text-slate-800 dark:text-blue-50 ${onNavigateToUser ? 'cursor-pointer hover:underline' : ''}`}
                    onClick={onNavigateToUser ? () => onNavigateToUser(c.user_id) : undefined}
                  >{cName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">{relativeTime(c.created_at)}</span>
                  {isOwnComment && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(c.id)}
                      className="ml-auto p-0.5 rounded-full text-slate-300 dark:text-gray-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      aria-label="Usuń komentarz"
                    >
                      <Trash2 size={11} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-slate-700 dark:text-gray-300 leading-relaxed">{c.content}</p>
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
        <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-gray-800 rounded-full pl-4 pr-1.5 py-1.5 focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:ring-2 focus-within:ring-uj-blue/20 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() }
            }}
            placeholder="Dodaj komentarz…"
            maxLength={500}
            className="flex-1 bg-transparent text-[13px] text-slate-800 dark:text-blue-50 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none"
            aria-label={`Komentarz do posta ${postId}`}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!inputValue.trim() || isSubmitting}
            className="h-6 w-6 flex items-center justify-center rounded-full bg-gradient-to-br from-uj-blue to-[#0044cc] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all active:scale-90 shrink-0"
            aria-label="Wyślij komentarz"
          >
            <Send size={11} />
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
