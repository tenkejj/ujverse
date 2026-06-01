import type { Comment, Profile } from '../types'
import GroupCard from './GroupCard'
import GroupNav from './GroupNav'

type SharedPostHandlers = {
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

const unifiedCardGapCls = 'gap-4'

type Props = SharedPostHandlers & {
  groupSlug: string
}

export default function GroupView({ groupSlug, ...postHandlers }: Props) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-4">
      <div className="lg:col-span-6 lg:col-start-4 flex min-w-0 w-full max-w-full flex-col gap-4">
        <div className="lg:hidden">
          <GroupNav variant="rail" mode="trending" />
        </div>
        <GroupCard groupSlug={groupSlug} {...postHandlers} />
      </div>

      <aside
        className={`hidden lg:flex lg:col-span-3 flex-col ${unifiedCardGapCls} sticky top-20 self-start`}
      >
        <GroupNav variant="panel" mode="all" className="shrink-0" />
      </aside>
    </div>
  )
}
