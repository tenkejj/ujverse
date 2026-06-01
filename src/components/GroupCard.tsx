import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import type { Comment, Post, Profile } from '../types'
import { GroupService } from '../services/GroupService'
import { getChannelDescription, getChannelIcon } from '../lib/channelPresentation'
import { usePosts } from '../hooks/useContent'
import PostCard from './PostCard'
import EmptyState from './EmptyState'

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
  const Icon = useMemo(() => getChannelIcon(groupSlug), [groupSlug])
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
      {/* Hero strefy */}
      <header
        className={[
          'relative overflow-hidden rounded-2xl border border-zinc-200/80',
          'bg-gradient-to-br from-white via-zinc-50/90 to-zinc-100/50',
          'px-6 py-7 sm:px-8 sm:py-8',
          'dark:border-white/10 dark:from-zinc-950/90 dark:via-zinc-950/70 dark:to-black/40',
        ].join(' ')}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#1e293b]/5 blur-2xl dark:bg-brand-gold/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#1e293b]/15 to-transparent dark:via-brand-gold/25"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <span
            className={[
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              'bg-[#1e293b]/8 text-[#1e293b] ring-1 ring-[#1e293b]/10',
              'dark:bg-brand-gold/12 dark:text-brand-gold-bright dark:ring-brand-gold/20',
            ].join(' ')}
          >
            <Icon size={26} strokeWidth={1.5} aria-hidden />
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1e293b] dark:text-zinc-50 sm:text-[1.65rem]">
                {title}
              </h1>
              {postCountLabel && (
                <span
                  className={[
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                    'bg-[#1e293b]/8 text-[#1e293b]/90',
                    'dark:bg-brand-gold/12 dark:text-brand-gold-bright',
                  ].join(' ')}
                >
                  {postCountLabel}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xl">
              {description}
            </p>
            <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Tag: <span className="text-[#1e293b]/80 dark:text-brand-gold-bright/90">#{groupSlug}</span>
            </p>
          </div>
        </div>
      </header>

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
