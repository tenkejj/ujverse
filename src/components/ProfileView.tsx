import { MessageCircle, Settings } from 'lucide-react'
import type { Comment, Post, Profile } from '../types'
import { getDeptAbbreviation } from '../lib/departments'
import UserAvatar from './UserAvatar'
import PostCard from './PostCard'

type Props = {
  myProfile: Profile | null
  displayName: string
  currentUserId: string
  onOpenProfileModal: () => void
  onNavigateToUser?: (userId: string) => void

  // Posts
  posts: Post[]
  postsLoading: boolean

  // Likes
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null

  // Comments
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>

  // Handlers
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
}

export default function ProfileView({
  myProfile,
  displayName,
  currentUserId,
  onOpenProfileModal,
  onNavigateToUser,
  posts,
  postsLoading,
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
}: Props) {
  const myPosts = posts.filter((p) => p.user_id === currentUserId)

  return (
    <>
      {/* Profile card */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-white/5 border-t-2 border-t-uj-blue/10 dark:border-t-uj-orange/20 shadow-uj-soft dark:shadow-none px-5 py-6">
        <div className="flex items-start gap-4">
          <UserAvatar
            profile={myProfile}
            name={displayName}
            className="h-16 w-16 shrink-0 border-4 border-white dark:border-dark-card shadow-md"
            textSize="text-xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-blue-50 leading-tight truncate">{displayName}</h2>
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs font-semibold text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-600 shadow-sm transition-all"
              >
                <Settings size={12} /> Edytuj profil
              </button>
            </div>

            {myProfile?.department && (
              <span className="inline-block mt-1 text-[10px] text-uj-orange font-bold uppercase tracking-wider bg-uj-orange/10 px-2 py-0.5 rounded-full border border-uj-orange/20 leading-none">
                {getDeptAbbreviation(myProfile.department)}
              </span>
            )}

            {myProfile?.bio ? (
              <p className="mt-2 text-[14px] text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{myProfile.bio}</p>
            ) : (
              <p className="mt-2 text-[13px] text-slate-400 dark:text-gray-500 italic">
                Brak opisu — kliknij „Edytuj profil", aby dodać bio.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Own posts section */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">Twoje wpisy</h3>
        <span className="text-xs text-slate-400 dark:text-gray-500 bg-slate-200 dark:bg-gray-700 rounded-full px-2 py-0.5">{myPosts.length}</span>
      </div>

      {postsLoading && (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 rounded-full border-[3px] border-uj-blue border-t-transparent animate-spin" />
        </div>
      )}

      {!postsLoading && myPosts.length === 0 && (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <MessageCircle size={36} className="mb-3 opacity-20" />
          <p className="text-sm">Nie masz jeszcze żadnych wpisów.</p>
        </div>
      )}

      {!postsLoading && myPosts.map((post, idx) => {
        const postId = String(post?.id ?? `fallback-${idx}`)
        return (
          <PostCard
            key={postId}
            post={post}
            index={idx}
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
            onDeletePost={() => onDeletePost(postId)}
            onDeleteComment={(cId) => onDeleteComment(cId, postId)}
            onNavigateToUser={onNavigateToUser}
          />
        )
      })}
    </>
  )
}
