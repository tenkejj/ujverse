import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import type { Comment, Post, Profile } from '../types'
import { GroupService } from '../services/GroupService'
import { getChannelDescription } from '../lib/channelPresentation'
import { usePosts } from '../hooks/useContent'
import PostCard from './PostCard'
import EmptyState from './EmptyState'
import ZoneHeader from './ZoneHeader'

type Props = {
  groupSlug: string
  myProfile: Profile | null
  displayName: string
  currentUserId: string
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  commentsLoadingByPost: Record<string, boolean>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>
  commentReplyTargetByPost: Record<string, { commentId: number; username: string } | null>
  commentLikeLoadingByPost: Record<string, Record<number, boolean>>
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onToggleCommentLike: (postId: string, comment: Comment) => void
  onReplyToComment: (postId: string, comment: Comment) => void
  onCancelReply: (postId: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
  onPostsLoaded?: (postIds: string[]) => void
}

/** Widok strefy: hero + klejona lista postów (jak profil). */
export default function GroupCard({
  groupSlug,
  myProfile,
  displayName,
  currentUserId,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  commentsLoadingByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  commentReplyTargetByPost,
  commentLikeLoadingByPost,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  onDeletePost,
  onDeleteComment,
  onNavigateToPost,
  onNavigateToUser,
  onPostsLoaded,
}: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [groupName, setGroupName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    void (async () => {
      const { posts: next, group, error: fetchError } =
        await GroupService.fetchPostsForSlug(groupSlug)
      if (!alive) return
      if (fetchError) {
        setError(fetchError.message)
        setPosts([])
        setGroupName('')
      } else {
        setPosts(next)
        setGroupName(group?.name ?? groupSlug)
        const ids = next.map((p) => p.id).filter((id): id is string => id != null)
        onPostsLoaded?.(ids)
      }
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [groupSlug, onPostsLoaded])

  const unifiedPosts = usePosts({
    posts,
    likesCountByPost,
    likedPostIds,
    commentsCountByPost,
  })

  const title = useMemo(() => groupName || groupSlug, [groupName, groupSlug])
  const description = useMemo(
    () => getChannelDescription(groupSlug, groupName),
    [groupSlug, groupName],
  )
  const postCountLabel = useMemo(() => {
    if (loading) return null
    const n = posts.length
    if (n === 0) return 'Brak wpisów'
    if (n === 1) return '1 wpis'
    if (n >= 2 && n <= 4) return `${n} wpisy`
    return `${n} wpisów`
  }, [loading, posts.length])

  return (
    <div className="flex flex-col gap-6">
      <ZoneHeader
        slug={groupSlug}
        title={title}
        description={description}
        postCountLabel={postCountLabel}
      />

      {/* Lista wpisów */}
      <section aria-label={`Wpisy w strefie ${title}`} className="min-h-48">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 rounded-full border-[3px] border-[#1e293b]/30 border-t-[#1e293b] animate-spin dark:border-brand-gold/30 dark:border-t-brand-gold-bright" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-5 py-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/25 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/40 px-4 py-8 dark:border-white/10 dark:bg-zinc-950/20">
            <EmptyState
              icon={MessageCircle}
              title="Jeszcze cisza w tej strefie"
              subtitle="Opublikuj wpis z odpowiednim tagiem — pojawi się tu automatycznie."
            />
          </div>
        )}

        {!loading && !error && unifiedPosts.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-transparent">
            <div className="divide-y divide-zinc-200 dark:divide-white/10">
              <AnimatePresence mode="sync">
                {unifiedPosts.map((uc, idx) => {
                  const postId = uc.id
                  return (
                    <motion.div
                      key={postId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.28) }}
                    >
                      <PostCard
                        variant="feed"
                        content={uc}
                        index={idx}
                        currentUserId={currentUserId}
                        myProfile={myProfile}
                        displayName={displayName}
                        isPop={heartPopPostId === postId}
                        isCommentsOpen={expandedComments.has(postId)}
                        comments={commentsByPost[postId] ?? []}
                        commentsLoading={Boolean(commentsLoadingByPost[postId])}
                        commentInputValue={commentInput[postId] ?? ''}
                        isCommentSubmitting={Boolean(commentSubmitting[postId])}
                        onToggleLike={() => onToggleLike(postId)}
                        onToggleComments={() => onToggleComments(postId)}
                        onSubmitComment={() => onSubmitComment(postId)}
                        onCommentInputChange={(v) => onCommentInputChange(postId, v)}
                        onToggleCommentLike={(comment) => onToggleCommentLike(postId, comment)}
                        onReplyToComment={(comment) => onReplyToComment(postId, comment)}
                        onCancelReply={() => onCancelReply(postId)}
                        replyTarget={commentReplyTargetByPost[postId] ?? null}
                        commentLikeLoadingById={commentLikeLoadingByPost[postId] ?? {}}
                        onDeletePost={() => onDeletePost(postId)}
                        onDeleteComment={(cId) => onDeleteComment(cId, postId)}
                        onNavigateToPost={() => onNavigateToPost(postId)}
                        onNavigateToUser={onNavigateToUser}
                      />
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
