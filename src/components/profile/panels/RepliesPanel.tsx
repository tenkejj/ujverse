import { MessageCircle } from 'lucide-react'
import EmptyState from '../../EmptyState'

export type ReplyRow = {
  id: number
  content: string
  created_at: string
  post_id: string
  posts:
    | { id: string; content: string | null; user_id: string }
    | { id: string; content: string | null; user_id: string }[]
    | null
}

function normalizePostJoin(
  posts: ReplyRow['posts'],
): { id: string; content: string | null; user_id: string } | null {
  if (!posts) return null
  return Array.isArray(posts) ? (posts[0] ?? null) : posts
}

type Props = {
  replies: ReplyRow[]
  loading: boolean
  isOwn: boolean
  onNavigateToPost?: (postId: string) => void
}

export default function RepliesPanel({ replies, loading, isOwn, onNavigateToPost }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[var(--profile-accent)] border-t-transparent" />
      </div>
    )
  }

  if (replies.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Brak odpowiedzi"
        subtitle={
          isOwn
            ? 'Komentarze przy wpisach innych osób pojawią się tutaj.'
            : 'Ten użytkownik nie dodał jeszcze komentarzy.'
        }
      />
    )
  }

  return (
    <ul className="space-y-3">
      {replies.map((row) => {
        const post = normalizePostJoin(row.posts)
        const preview = post?.content?.trim() || '(wpis usunięty lub niedostępny)'
        return (
          <li
            key={row.id}
            className="rounded-2xl border border-[#0f172a]/10 bg-card p-4 dark:border-white/10"
          >
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg-primary dark:text-white">
              {row.content}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#0f172a]/08 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-500">
              <span>
                Na: <span className="text-fg-secondary line-clamp-2">{preview}</span>
              </span>
              {onNavigateToPost && post?.id && (
                <button
                  type="button"
                  onClick={() => onNavigateToPost(String(post.id))}
                  className="shrink-0 font-semibold text-[var(--profile-accent)] hover:opacity-85"
                >
                  Zobacz wpis
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
