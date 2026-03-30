import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, MessageCircle, Settings, UserX } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { Comment, Post, Profile } from '../types'
import { getDeptAbbreviation } from '../lib/departments'
import UserAvatar from './UserAvatar'
import PostCard from './PostCard'
import EmptyState from './EmptyState'

type Props = {
  userId: string
  currentUserId: string
  onBack: () => void
  onOpenProfileModal: () => void
  onNavigateToPost?: (postId: string) => void
  onNavigateToUser?: (userId: string) => void

  // Shared post interaction props
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
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-white/5 p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full w-1/3" />
          <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded-full w-3/4" />
          <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded-full w-1/2" />
        </div>
      </div>
    </div>
  )
}

export default function UserProfileView({
  userId,
  currentUserId,
  onBack,
  onOpenProfileModal,
  onNavigateToPost,
  onNavigateToUser,
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
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const isOwnProfile = userId === currentUserId

  const fetchData = useCallback(async () => {
    setLoading(true)
    setNotFound(false)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profileData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setProfile(profileData as Profile)

    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setPosts((postsData ?? []) as Post[])
    setLoading(false)
  }, [userId])

  useEffect(() => { void fetchData() }, [fetchData])

  const profileName = profile?.full_name || 'Użytkownik'

  return (
    <div className="space-y-3">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors -ml-1 mb-1"
      >
        <ArrowLeft size={18} />
        Wróć
      </button>

      {/* Loading state */}
      {loading && (
        <>
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-white/5 px-5 py-6 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-full w-1/3" />
                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-full w-1/5" />
                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-full w-2/3 mt-3" />
              </div>
            </div>
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {/* Not found */}
      {!loading && notFound && (
        <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
          <UserX size={48} strokeWidth={1.5} className="text-slate-300 dark:text-white/20" />
          <p className="text-[15px] font-semibold text-slate-500 dark:text-gray-400">Nie znaleziono użytkownika</p>
        </div>
      )}

      {/* Profile content */}
      {!loading && !notFound && profile && (
        <>
          {/* Profile header card */}
          <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-white/5 border-t-2 border-t-uj-blue/10 dark:border-t-uj-orange/20 shadow-uj-soft dark:shadow-none px-5 py-8">
            <div className="flex flex-col items-center text-center gap-2">
              <UserAvatar
                profile={profile}
                name={profileName}
                className="h-20 w-20"
                textSize="text-2xl"
              />
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-blue-50 leading-tight mt-1">{profileName}</h2>

              {profile.department && (
                <span className="text-[10px] text-accent-interactive font-bold uppercase tracking-wider bg-accent-interactive/10 px-2 py-0.5 rounded-full border border-accent-interactive/25 leading-none">
                  {getDeptAbbreviation(profile.department)}
                </span>
              )}

              {profile.bio ? (
                <p className="mt-1 text-[14px] text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line max-w-sm">{profile.bio}</p>
              ) : (
                <p className="mt-1 text-[13px] text-slate-400 dark:text-gray-500 italic">Brak opisu.</p>
              )}

              {isOwnProfile && (
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="mt-2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs font-semibold text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-600 shadow-sm transition-all"
                >
                  <Settings size={12} /> Edytuj profil
                </button>
              )}
            </div>
          </div>

          {/* Posts header */}
          <div className="flex items-center gap-2 px-1 pt-1">
            <h3 className="text-sm font-bold text-slate-700 dark:text-gray-300">Wpisy</h3>
            <span className="text-xs text-slate-400 dark:text-gray-500 bg-slate-200 dark:bg-gray-700 rounded-full px-2 py-0.5">{posts.length}</span>
          </div>

          {/* Empty posts */}
          {posts.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="Brak wpisów"
              subtitle="Ten użytkownik nie opublikował jeszcze żadnych postów"
            />
          )}

          {/* Post list */}
          {posts.map((post, idx) => {
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
                onNavigateToPost={onNavigateToPost ? () => onNavigateToPost(postId) : undefined}
                onNavigateToUser={onNavigateToUser}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
