import { MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../../EmptyState'

export type ReplyRow = {
  id: number
  content: string
  created_at: string
  post_id: string
  post:
    | { id: string; content: string | null; user_id: string }
    | { id: string; content: string | null; user_id: string }[]
    | null
}

function normalizePostJoin(
  post: ReplyRow['post'],
): { id: string; content: string | null; user_id: string } | null {
  if (!post) return null
  return Array.isArray(post) ? (post[0] ?? null) : post
}

type Props = {
  replies: ReplyRow[]
  loading: boolean
  isOwn: boolean
  replyAuthorHandle?: string | null
  onNavigateToPost?: (postId: string) => void
}

export default function RepliesPanel({
  replies,
  loading,
  isOwn,
  replyAuthorHandle = null,
  onNavigateToPost,
}: Props) {
  const navigate = useNavigate()

  const navigateToPost = (postId: string) => {
    if (onNavigateToPost) {
      onNavigateToPost(postId)
      return
    }
    navigate(`/post/${postId}`)
  }

  const normalizedHandle = replyAuthorHandle?.trim()
  const handleLabel = normalizedHandle ? `@${normalizedHandle}` : 'użytkownika'

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
        const post = normalizePostJoin(row.post)
        const preview = post?.content?.trim() || '(wpis usunięty lub niedostępny)'
        const postAuthor = post?.user_id ? `@${post.user_id.slice(0, 8)}` : 'nieznany autor'
        const canOpenPost = Boolean(post?.id)
        return (
          <li
            key={row.id}
            className="rounded-2xl border border-[#0f172a]/10 bg-card/80 p-4 backdrop-blur-md dark:border-white/10"
          >
            <div className="space-y-3 border-l-2 border-border-app pl-4">
              <p className="text-xs font-medium tracking-wide text-fg-secondary/90 dark:text-slate-400">
                Odpowiedź użytkownika {handleLabel}
              </p>
              <button
                type="button"
                disabled={!canOpenPost}
                onClick={() => post?.id && navigateToPost(String(post.id))}
                className="w-full text-left disabled:cursor-default"
              >
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg-primary transition-opacity hover:opacity-90 dark:text-white">
                  {row.content}
                </p>
              </button>
              <button
                type="button"
                disabled={!canOpenPost}
                onClick={() => post?.id && navigateToPost(String(post.id))}
                className="w-full rounded-xl border border-border-app/70 bg-muted/40 p-3 text-left backdrop-blur-sm transition-colors hover:bg-muted/55 disabled:cursor-default dark:bg-white/5 dark:hover:bg-white/10"
              >
                <p className="text-xs font-semibold text-fg-secondary dark:text-slate-300">
                  Oryginalny wpis - {postAuthor}
                </p>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-fg-secondary dark:text-slate-300">
                  {preview}
                </p>
              </button>
              {canOpenPost ? (
                <button
                  type="button"
                  onClick={() => post?.id && navigateToPost(String(post.id))}
                  className="text-xs font-semibold text-[var(--profile-accent)] hover:opacity-85"
                >
                  Zobacz wpis
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
