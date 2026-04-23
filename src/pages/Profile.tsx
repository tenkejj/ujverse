import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, UserX } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Comment, Post, Profile as ProfileT } from '../types'
import { supabase } from '../supabaseClient'
import { useEvents } from '../hooks/useEvents'
import { useProfileSocialData } from '../hooks/useProfileSocialData'
import FacultyAccent from '../components/profile/FacultyAccent'
import ProfileHero from '../components/profile/ProfileHero'
import ProfileIdentity from '../components/profile/ProfileIdentity'
import ProfileTabs from '../components/profile/ProfileTabs'
import type { ProfileTab } from '../components/profile/profileTabs.types'
import ProfileTabPanel from '../components/profile/ProfileTabPanel'
import ProfileSkeleton from '../components/profile/ProfileSkeleton'
import ProfileActionButton from '../components/profile/ProfileActionButton'
import ProfileFab from '../components/profile/ProfileFab'
import { useShowInlineAction } from '../components/profile/profileScroll'
import { BadgeDockDesktop, BadgeDockMobile } from '../components/profile/BadgeDock'
import FollowListsModal, { type FollowModalTab } from '../components/FollowListsModal'
import PostsPanel from '../components/profile/panels/PostsPanel'
import MediaPanel from '../components/profile/panels/MediaPanel'
import RepliesPanel, { type ReplyRow } from '../components/profile/panels/RepliesPanel'
import EventsPanel from '../components/profile/panels/EventsPanel'
import { PROFILE_MOBILE } from '../styles/mobile-theme'

function capitalizeFirst(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = {
  myProfile: ProfileT | null
  displayName: string
  currentUserId: string
  viewedHandle?: string | null
  onBack?: () => void
  onNavigateToPost?: (postId: string) => void
  joinedAtLabel?: string | null
  onOpenProfileModal: () => void
  onNavigateToUser?: (userId: string) => void
  onNavigateToProfileHandle?: (handle: string) => void
  /** Klik w kartę wydarzenia na profilu → zakładka Wydarzenia w aplikacji. */
  onNavigateToEvents?: () => void
  onAvatarUpdate?: (url: string) => void
  onBannerUpdate?: (url: string) => void

  posts: Post[]
  postsLoading: boolean

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

export default function Profile({
  myProfile,
  displayName,
  currentUserId,
  viewedHandle = null,
  onBack,
  onNavigateToPost,
  joinedAtLabel,
  onOpenProfileModal,
  onNavigateToUser,
  onNavigateToProfileHandle,
  onNavigateToEvents,
  onAvatarUpdate,
  onBannerUpdate,
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
  const { allEvents } = useEvents()
  const normalizedViewedHandle = viewedHandle?.trim().toLowerCase() ?? null
  const myHandle = myProfile?.username?.trim().toLowerCase() ?? null
  const isOwn = !normalizedViewedHandle || (myHandle !== null && normalizedViewedHandle === myHandle)

  const [otherProfile, setOtherProfile] = useState<ProfileT | null>(null)
  const [otherPosts, setOtherPosts] = useState<Post[]>([])
  const [otherLoading, setOtherLoading] = useState(false)
  const [otherNotFound, setOtherNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const [followingBtnHovered, setFollowingBtnHovered] = useState(false)
  const [followModalOpen, setFollowModalOpen] = useState(false)
  const [followModalTab, setFollowModalTab] = useState<FollowModalTab>('followers')

  const [userReplies, setUserReplies] = useState<ReplyRow[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)

  const fetchOtherUser = useCallback(async (handle: string) => {
    setOtherLoading(true)
    setOtherNotFound(false)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', handle)
      .single()

    if (profileError || !profileData) {
      setOtherNotFound(true)
      setOtherProfile(null)
      setOtherPosts([])
      setOtherLoading(false)
      return
    }

    setOtherProfile(profileData as ProfileT)

    const { data: postsData } = await supabase
      .from('posts')
      .select('*, user_id, profiles(id, full_name, username, avatar_url, department)')
      .eq('user_id', profileData.id)
      .order('created_at', { ascending: false })

    setOtherPosts((postsData ?? []) as Post[])
    setOtherLoading(false)
  }, [])

  useEffect(() => {
    if (!isOwn && normalizedViewedHandle) void fetchOtherUser(normalizedViewedHandle)
  }, [isOwn, normalizedViewedHandle, fetchOtherUser])

  useEffect(() => {
    setActiveTab('posts')
  }, [normalizedViewedHandle, isOwn])

  const profileForDisplay: ProfileT | null = isOwn ? myProfile : otherProfile
  const titleName = isOwn
    ? myProfile?.full_name || displayName
    : otherProfile?.full_name || 'Użytkownik'

  const displayedUserId = isOwn ? currentUserId : (otherProfile?.id ?? '')

  const userPosts = isOwn ? posts.filter((p) => p.user_id === currentUserId) : otherPosts
  const mediaPosts = userPosts.filter((p) => Boolean(p.image_url?.trim()))
  const attendingEvents = allEvents.filter((e) => e.isAttending)

  const showPostsLoading = isOwn ? postsLoading : otherLoading

  const socialTargetUserId = isOwn ? currentUserId : (otherProfile?.id ?? null)
  const {
    isFollowing,
    followActionLoading,
    followersCount,
    followingCount,
    followStatsLoading,
    toggleFollow,
    refreshFollowStats,
  } = useProfileSocialData({
    currentUserId,
    viewedUserId: socialTargetUserId,
    isOwn,
  })

  useEffect(() => {
    if (!displayedUserId) return
    let cancelled = false
    ;(async () => {
      setRepliesLoading(true)
      const { data, error } = await supabase
        .from('comments')
        .select('id, content, created_at, post_id, posts(id, content, user_id)')
        .eq('user_id', displayedUserId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      setRepliesLoading(false)
      if (error || !data) {
        setUserReplies([])
        return
      }
      setUserReplies(data as ReplyRow[])
    })()
    return () => {
      cancelled = true
    }
  }, [displayedUserId])

  const normalizedUsername = profileForDisplay?.username?.trim().toLowerCase() ?? ''
  const hasPublicUsername = normalizedUsername.length > 0
  const handleLabel = hasPublicUsername ? `@${normalizedUsername}` : ''

  const joinedLabel = (() => {
    if (isOwn) {
      if (joinedAtLabel?.trim()) return capitalizeFirst(joinedAtLabel.trim())
      return null
    }
    const ca = profileForDisplay?.created_at
    if (!ca) return null
    return capitalizeFirst(
      new Date(ca).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }),
    )
  })()

  const showInline = useShowInlineAction()

  const actionKind = isOwn ? 'edit' : isFollowing ? 'following' : 'follow'

  const handleActionClick = () => {
    if (isOwn) onOpenProfileModal()
    else void toggleFollow()
  }

  const openFollowModal = (tab: FollowModalTab) => {
    setFollowModalTab(tab)
    setFollowModalOpen(true)
  }

  const inlineAction = showInline ? (
    <ProfileActionButton
      variant="inline"
      kind={actionKind}
      onClick={handleActionClick}
      loading={isOwn ? false : followActionLoading}
      hovering={followingBtnHovered}
      onHoverChange={setFollowingBtnHovered}
    />
  ) : null

  const badgeDockProps = {
    department: profileForDisplay?.department,
    joinedAt: profileForDisplay?.created_at,
    repliesCount: userReplies.length,
    attendingEventsCount: attendingEvents.length,
    isOwn,
  }

  if (!isOwn && otherLoading) {
    return (
      <div className="space-y-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg-primary dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}
        <ProfileSkeleton />
      </div>
    )
  }

  if (!isOwn && otherNotFound) {
    return (
      <div className="space-y-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg-primary dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}
        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
          <UserX size={48} strokeWidth={1.5} className="text-slate-300 dark:text-white/20" />
          <p className="text-[15px] font-semibold text-slate-500 dark:text-gray-400">
            Nie znaleziono użytkownika
          </p>
        </div>
      </div>
    )
  }

  return (
    <FacultyAccent department={profileForDisplay?.department}>
      <div className="space-y-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg-primary dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}

        <motion.section
          initial="hidden"
          animate="show"
          variants={PROFILE_MOBILE.motion.staggerContainer}
          className={PROFILE_MOBILE.card.glassClass}
        >
          <ProfileHero
            profile={profileForDisplay}
            displayName={titleName}
            isOwn={isOwn}
            currentUserId={currentUserId}
            onAvatarUpdate={onAvatarUpdate}
            onBannerUpdate={onBannerUpdate}
            inlineAction={inlineAction}
            badgeDockDesktop={<BadgeDockDesktop {...badgeDockProps} />}
            badgeDockMobile={<BadgeDockMobile {...badgeDockProps} />}
          />

          <ProfileIdentity
            profile={profileForDisplay}
            titleName={titleName}
            handleLabel={handleLabel}
            hasPublicUsername={hasPublicUsername}
            isOwn={isOwn}
            joinedLabel={joinedLabel}
            followersCount={followersCount}
            followingCount={followingCount}
            followStatsLoading={followStatsLoading}
            onOpenFollowModal={openFollowModal}
          />

          <div className="mt-4 pb-4 sm:pb-6">
            <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
        </motion.section>

        <ProfileTabPanel activeTab={activeTab}>
          {activeTab === 'posts' && (
            <PostsPanel
              loading={showPostsLoading}
              isOwn={isOwn}
              list={userPosts}
              currentUserId={currentUserId}
              myProfile={myProfile}
              displayName={displayName}
              likesCountByPost={likesCountByPost}
              likedPostIds={likedPostIds}
              heartPopPostId={heartPopPostId}
              commentsCountByPost={commentsCountByPost}
              commentsByPost={commentsByPost}
              expandedComments={expandedComments}
              commentInput={commentInput}
              commentSubmitting={commentSubmitting}
              onToggleLike={onToggleLike}
              onToggleComments={onToggleComments}
              onSubmitComment={onSubmitComment}
              onCommentInputChange={onCommentInputChange}
              onDeletePost={onDeletePost}
              onDeleteComment={onDeleteComment}
              onNavigateToPost={onNavigateToPost}
              onNavigateToUser={onNavigateToUser}
            />
          )}

          {activeTab === 'media' && (
            <MediaPanel
              loading={showPostsLoading}
              isOwn={isOwn}
              list={mediaPosts}
              currentUserId={currentUserId}
              myProfile={myProfile}
              displayName={displayName}
              likesCountByPost={likesCountByPost}
              likedPostIds={likedPostIds}
              heartPopPostId={heartPopPostId}
              commentsCountByPost={commentsCountByPost}
              commentsByPost={commentsByPost}
              expandedComments={expandedComments}
              commentInput={commentInput}
              commentSubmitting={commentSubmitting}
              onToggleLike={onToggleLike}
              onToggleComments={onToggleComments}
              onSubmitComment={onSubmitComment}
              onCommentInputChange={onCommentInputChange}
              onDeletePost={onDeletePost}
              onDeleteComment={onDeleteComment}
              onNavigateToPost={onNavigateToPost}
              onNavigateToUser={onNavigateToUser}
            />
          )}

          {activeTab === 'replies' && (
            <RepliesPanel
              replies={userReplies}
              loading={repliesLoading}
              isOwn={isOwn}
              onNavigateToPost={onNavigateToPost}
            />
          )}

          {activeTab === 'events' && (
            <EventsPanel
              events={attendingEvents}
              isOwn={isOwn}
              onNavigateToEvents={onNavigateToEvents}
            />
          )}
        </ProfileTabPanel>
      </div>

      <ProfileFab
        kind={actionKind}
        onClick={handleActionClick}
        loading={isOwn ? false : followActionLoading}
      />
      {followModalOpen && socialTargetUserId ? (
        <FollowListsModal
          open={followModalOpen}
          onClose={() => setFollowModalOpen(false)}
          profileUserId={socialTargetUserId}
          currentUserId={currentUserId}
          initialTab={followModalTab}
          onCountsChange={refreshFollowStats}
          onNavigateToProfileHandle={onNavigateToProfileHandle}
        />
      ) : null}
    </FacultyAccent>
  )
}
