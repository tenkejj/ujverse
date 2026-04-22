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
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
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
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
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
    <div className="divide-y divide-[#0f172a]/10 overflow-hidden rounded-2xl border border-[#0f172a]/10 bg-card dark:divide-white/10 dark:border-white/10">
      {unifiedList.map((uc, idx) => {
        const postId = uc.id
        return (
          <PostCard
            key={postId}
            variant="stacked"
            content={uc}
            index={idx}
            currentUserId={currentUserId}
            myProfile={myProfile}
            displayName={displayName}
            isPop={heartPopPostId === postId}
            isCommentsOpen={expandedComments.has(postId)}
            comments={commentsByPost[postId] ?? []}
            commentInputValue={commentInput[postId] ?? ''}
            isCommentSubmitting={Boolean(commentSubmitting[postId])}
            onToggleLike={() => onToggleLike(postId)}
            onToggleComments={() => onToggleComments(postId)}
            onSubmitComment={() => onSubmitComment(postId)}
            onCommentInputChange={(v) => onCommentInputChange(postId, v)}
            onDeletePost={() => onDeletePost(postId)}
            onDeleteComment={(cId) => onDeleteComment(cId, postId)}
            onNavigateToPost={onNavigateToPost ? () => onNavigateToPost(postId) : undefined}
            onNavigateToUser={onNavigateToUser}
          />
        )
      })}
    </div>
  )
}
