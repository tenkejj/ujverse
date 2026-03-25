import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { Comment, Post, Profile } from '../types'
import PostCard from './PostCard'

type Props = {
  postId: string
  onBack: () => void

  // sharedPostProps
  myProfile: Profile | null
  displayName: string
  currentUserId: string
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToUser?: (userId: string) => void
}

export default function SinglePostView({
  postId,
  onBack,
  myProfile,
  displayName,
  currentUserId,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onDeletePost,
  onDeleteComment,
  onNavigateToUser,
}: Props) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*, profiles(id, full_name, avatar_url, department)')
        .eq('id', Number(postId))
        .single()

      if (cancelled) return

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Nie znaleziono wpisu.')
        setLoading(false)
        return
      }

      setPost(data as Post)
      setLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [postId])

  // Auto-expand comments when arriving at this view
  useEffect(() => {
    if (!expandedComments.has(postId)) {
      void onToggleComments(postId)
    }
  // Run only on mount for this postId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="p-2 w-fit rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
        aria-label="Wróć"
      >
        <ArrowLeft size={18} strokeWidth={2} />
      </button>

      {loading && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/5 p-6 space-y-3 animate-pulse">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full w-1/3" />
              <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-full w-2/3" />
              <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-full w-1/2" />
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-2xl px-4 py-3 border border-red-100 dark:border-red-800/40">
          {error}
        </div>
      )}

      {!loading && !error && post && (
        <PostCard
          post={post}
          index={0}
          currentUserId={currentUserId}
          myProfile={myProfile}
          displayName={displayName}
          likeCount={likesCountByPost[postId] ?? 0}
          isLiked={Boolean(likedPostIds[postId])}
          isPop={heartPopPostId === postId}
          commentCount={commentsCountByPost[postId] ?? 0}
          isCommentsOpen={expandedComments.has(postId)}
          comments={commentsByPost[postId] ?? []}
          commentInputValue={commentInput[postId] ?? ''}
          isCommentSubmitting={Boolean(commentSubmitting[postId])}
          onToggleLike={() => onToggleLike(postId)}
          onToggleComments={() => onToggleComments(postId)}
          onSubmitComment={() => onSubmitComment(postId)}
          onCommentInputChange={(v) => onCommentInputChange(postId, v)}
          onDeletePost={() => { onDeletePost(postId); onBack() }}
          onDeleteComment={(cId) => onDeleteComment(cId, postId)}
          onNavigateToUser={onNavigateToUser}
        />
      )}
    </div>
  )
}
