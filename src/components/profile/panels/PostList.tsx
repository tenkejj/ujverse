import type { Comment, Post, Profile } from '../../../types'
import { DataService } from '../../../services/DataService'
import PostCard from '../../PostCard'

type Props = {
  list: Post[]
  currentUserId: string
  myProfile: Profile | null
  displayName: string
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  commentsLoadingByPost: Record<string, boolean>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onToggleCommentLike: (postId: string, comment: Comment) => void
  onReplyToComment: (postId: string, comment: Comment) => void
  onCancelReply: (postId: string) => void
  commentReplyTargetByPost: Record<string, { commentId: number; username: string } | null>
  commentLikeLoadingByPost: Record<string, Record<number, boolean>>
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost?: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
}

export default function PostList({
  list,
  currentUserId,
  myProfile,
  displayName,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  commentsLoadingByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onToggleCommentLike,
  onReplyToComment,
  onCancelReply,
  commentReplyTargetByPost,
  commentLikeLoadingByPost,
  onDeletePost,
  onDeleteComment,
  onNavigateToPost,
  onNavigateToUser,
}: Props) {
  if (list.length === 0) return null
  const unifiedList = DataService.toUnifiedPosts(list, {
    likesCountByPost,
    likedPostIds,
    commentsCountByPost,
  })
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/50 divide-y divide-zinc-200 dark:divide-white/10">
      {unifiedList.map((uc, idx) => {
        const postId = uc.id
        return (
          <div key={postId}>
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
              onNavigateToPost={onNavigateToPost ? () => onNavigateToPost(postId) : undefined}
              onNavigateToUser={onNavigateToUser}
            />
          </div>
        )
      })}
    </div>
  )
}
