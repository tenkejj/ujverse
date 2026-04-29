import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, UserX } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Comment, Post, Profile as ProfileT } from '../types'
import { supabase } from '../supabaseClient'
import { useEvents } from '../hooks/useEvents'
import { useProfileData } from '../hooks/useProfileData'
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
import RepliesPanel, { type ReplyThread } from '../components/profile/panels/RepliesPanel'
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

  const [userReplies, setUserReplies] = useState<ReplyThread[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)

  const fetchRepliesWithPostContext = useCallback(async (profileId: string): Promise<ReplyThread[]> => {
    type JoinedProfile = {
      id?: string | null
      full_name?: string | null
      username?: string | null
      avatar_url?: string | null
    }

    const normalizeJoinedProfile = (value: unknown): JoinedProfile | null => {
      if (!value) return null
      if (Array.isArray(value)) return (value[0] as JoinedProfile | undefined) ?? null
      return value as JoinedProfile
    }

    const buildAuthor = (profile: JoinedProfile | null, userId: unknown) => {
      const rawUserId = typeof userId === 'string' ? userId.trim() : String(userId ?? '').trim()
      const normalizedHandle = profile?.username?.trim().replace(/^@+/, '') || null
      return {
        display_name: profile?.full_name?.trim() || normalizedHandle || rawUserId.slice(0, 8),
        handle: normalizedHandle,
        avatar_url: profile?.avatar_url ?? null,
      }
    }

    const toCountMap = (rows: Array<Record<string, unknown>> | null | undefined, key: string) => {
      const counts: Record<string, number> = {}
      for (const row of rows ?? []) {
        const id = String(row[key] ?? '')
        if (!id) continue
        counts[id] = (counts[id] ?? 0) + 1
      }
      return counts
    }

    const toBoolMap = (rows: Array<Record<string, unknown>> | null | undefined, key: string) => {
      const flags: Record<string, boolean> = {}
      for (const row of rows ?? []) {
        const id = String(row[key] ?? '')
        if (!id) continue
        flags[id] = true
      }
      return flags
    }

    const asCount = (value: unknown) => {
      const num = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(num) ? Math.max(0, num) : 0
    }

    const fetchRows = async (table: string, key: string, ids: number[]) => {
      if (!ids.length) return []
      const { data, error } = await supabase.from(table).select(key).in(key, ids)
      if (error) return null
      return ((data ?? []) as unknown) as Array<Record<string, unknown>>
    }

    const { data, error } = await supabase
      .from('comments')
      .select(
        'id, post_id, user_id, content, body, created_at, image_url, media_urls, attachments, profiles:user_id(id, full_name, username, avatar_url), post:posts(id, user_id, content, created_at, image_url, media_urls, attachments, profiles:user_id(id, full_name, username, avatar_url))',
      )
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    if (!error && data?.length) {
      const postIds = Array.from(
        new Set(
          data
            .map((comment) => Number(comment.post_id))
            .filter((postId) => Number.isFinite(postId) && postId > 0),
        ),
      )
      const replyIds = Array.from(
        new Set(
          data
            .map((comment) => Number(comment.id))
            .filter((commentId) => Number.isFinite(commentId) && commentId > 0),
        ),
      )

      const [
        likesRows,
        commentsRows,
        repostRows,
        viewsRows,
        myLikesRows,
        myRepostsRows,
        replyLikesRows,
        replyCommentsRows,
        replyRepostsRows,
        replyViewsRows,
        myReplyLikesRows,
        myReplyRepostsRows,
      ] =
        await Promise.all([
          fetchRows('likes', 'post_id', postIds),
          fetchRows('comments', 'post_id', postIds),
          fetchRows('reposts', 'post_id', postIds),
          fetchRows('views', 'post_id', postIds),
          supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds)
            .then(({ data: rows, error: queryError }) =>
              queryError ? null : ((rows ?? []) as Array<Record<string, unknown>>),
            ),
          supabase
            .from('reposts')
            .select('post_id')
            .eq('user_id', currentUserId)
            .in('post_id', postIds)
            .then(({ data: rows, error: queryError }) =>
              queryError ? null : ((rows ?? []) as Array<Record<string, unknown>>),
            ),
          fetchRows('comment_likes', 'comment_id', replyIds),
          fetchRows('comment_replies', 'parent_comment_id', replyIds),
          fetchRows('comment_reposts', 'comment_id', replyIds),
          fetchRows('comment_views', 'comment_id', replyIds),
          supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', currentUserId)
            .in('comment_id', replyIds)
            .then(({ data: rows, error: queryError }) =>
              queryError ? null : ((rows ?? []) as Array<Record<string, unknown>>),
            ),
          supabase
            .from('comment_reposts')
            .select('comment_id')
            .eq('user_id', currentUserId)
            .in('comment_id', replyIds)
            .then(({ data: rows, error: queryError }) =>
              queryError ? null : ((rows ?? []) as Array<Record<string, unknown>>),
            ),
        ])

      const likesByPost = toCountMap(likesRows, 'post_id')
      const commentsByPost = toCountMap(commentsRows, 'post_id')
      const repostsByPost = toCountMap(repostRows, 'post_id')
      const viewsByPost = toCountMap(viewsRows, 'post_id')
      const likedByPost = toBoolMap(myLikesRows, 'post_id')
      const repostedByPost = toBoolMap(myRepostsRows, 'post_id')
      const likesByReply = toCountMap(replyLikesRows, 'comment_id')
      const commentsByReply = toCountMap(replyCommentsRows, 'parent_comment_id')
      const repostsByReply = toCountMap(replyRepostsRows, 'comment_id')
      const viewsByReply = toCountMap(replyViewsRows, 'comment_id')
      const likedByReply = toBoolMap(myReplyLikesRows, 'comment_id')
      const repostedByReply = toBoolMap(myReplyRepostsRows, 'comment_id')

      return data.map((comment) => {
        const postJoin = Array.isArray(comment.post) ? (comment.post[0] ?? null) : comment.post
        const postId = String(comment.post_id ?? '')
        const postAuthor = normalizeJoinedProfile(postJoin?.profiles)
        const replyAuthor = normalizeJoinedProfile(comment.profiles)
        const replyId = String(comment.id ?? '')

        return {
          id: Number(comment.id),
          post_id: postId,
          post: {
            id: String(postJoin?.id ?? postId),
            created_at: String(postJoin?.created_at ?? comment.created_at ?? ''),
            content: (postJoin?.content as string | null | undefined) ?? null,
            media_url: (postJoin?.image_url as string | null | undefined) ?? null,
            media_urls: (postJoin?.media_urls as string[] | null | undefined) ?? null,
            attachments: (postJoin?.attachments as unknown[] | null | undefined) ?? null,
            author: buildAuthor(postAuthor, postJoin?.user_id),
            stats: {
              likes_count: likesByPost[postId] ?? 0,
              comments_count: commentsByPost[postId] ?? 0,
              views_count: viewsByPost[postId] ?? 0,
              reposts_count: repostsByPost[postId] ?? 0,
            },
            user_interactions: {
              has_liked: Boolean(likedByPost[postId]),
              has_reposted: Boolean(repostedByPost[postId]),
            },
          },
          reply: {
            id: replyId,
            created_at: String(comment.created_at ?? ''),
            content:
              (comment.content as string | null | undefined) ??
              (comment.body as string | null | undefined) ??
              null,
            media_url: (comment.image_url as string | null | undefined) ?? null,
            media_urls: (comment.media_urls as string[] | null | undefined) ?? null,
            attachments: (comment.attachments as unknown[] | null | undefined) ?? null,
            author: buildAuthor(replyAuthor, comment.user_id),
            stats: {
              likes_count: likesByReply[replyId] ?? asCount((comment as Record<string, unknown>).likes_count),
              comments_count:
                commentsByReply[replyId] ?? asCount((comment as Record<string, unknown>).comments_count),
              views_count: viewsByReply[replyId] ?? asCount((comment as Record<string, unknown>).views_count),
              reposts_count:
                repostsByReply[replyId] ?? asCount((comment as Record<string, unknown>).reposts_count),
            },
            user_interactions: {
              has_liked:
                Boolean(likedByReply[replyId]) ||
                Boolean((comment as Record<string, unknown>).has_liked),
              has_reposted:
                Boolean(repostedByReply[replyId]) ||
                Boolean((comment as Record<string, unknown>).has_reposted),
            },
          },
        }
      }) as ReplyThread[]
    }

    // Fallback when PostgREST relation metadata/FK is unavailable for comments -> posts join.
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select('*, profiles:user_id(id, full_name, username, avatar_url)')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })

    console.log('Replies data:', commentsData)
    console.log('Replies error:', commentsError)

    if (commentsError || !commentsData?.length) {
      return []
    }

    const postIds = Array.from(
      new Set(
        commentsData
          .map((comment) => Number(comment.post_id))
          .filter((postId) => Number.isFinite(postId) && postId > 0),
      ),
    )

    let postsById = new Map<
      number,
      {
        id: string
        content: string | null
        user_id: string
        image_url?: string | null
        media_urls?: string[] | null
        attachments?: unknown[] | null
        profiles: {
          id?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
        } | null
      }
    >()
    if (postIds.length) {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, profiles:user_id(id, full_name, username, avatar_url)')
        .in('id', postIds)

      console.log('Replies posts data:', postsData)
      console.log('Replies posts error:', postsError)

      if (postsData?.length) {
        postsById = new Map(
          postsData.map((post) => [
            Number(post.id),
            {
              id: String(post.id),
              content: (post.content as string | null | undefined) ?? null,
              user_id: String(post.user_id ?? ''),
              image_url: (post.image_url as string | null | undefined) ?? null,
              media_urls: (post.media_urls as string[] | null | undefined) ?? null,
              attachments: (post.attachments as unknown[] | null | undefined) ?? null,
              profiles: normalizeJoinedProfile(post.profiles),
            },
          ]),
        )
      }
    }

    return commentsData.map((comment) => {
      const postId = String(comment.post_id ?? '')
      const post = postsById.get(Number(comment.post_id)) ?? null
      const postAuthor = post?.profiles ?? null
      const replyAuthor = normalizeJoinedProfile(comment.profiles)
      return {
        id: Number(comment.id),
        post_id: postId,
        post: {
          id: String(post?.id ?? postId),
          created_at: String(comment.created_at ?? ''),
          content: post?.content ?? null,
          media_url: post?.image_url ?? null,
          media_urls: post?.media_urls ?? null,
          attachments: post?.attachments ?? null,
          author: buildAuthor(postAuthor, post?.user_id),
          stats: {
            likes_count: asCount((post as unknown as Record<string, unknown>)?.likes_count),
            comments_count: asCount((post as unknown as Record<string, unknown>)?.comments_count),
            views_count: asCount((post as unknown as Record<string, unknown>)?.views_count),
            reposts_count: asCount((post as unknown as Record<string, unknown>)?.reposts_count),
          },
          user_interactions: {
            has_liked: Boolean((post as unknown as Record<string, unknown>)?.has_liked),
            has_reposted: Boolean((post as unknown as Record<string, unknown>)?.has_reposted),
          },
        },
        reply: {
          id: String(comment.id ?? ''),
          created_at: String(comment.created_at ?? ''),
          content:
            (comment.content as string | null | undefined) ??
            (comment.body as string | null | undefined) ??
            '',
          media_url: (comment.image_url as string | null | undefined) ?? null,
          media_urls: (comment.media_urls as string[] | null | undefined) ?? null,
          attachments: (comment.attachments as unknown[] | null | undefined) ?? null,
          author: buildAuthor(replyAuthor, comment.user_id),
          stats: {
            likes_count: asCount((comment as Record<string, unknown>).likes_count),
            comments_count: asCount((comment as Record<string, unknown>).comments_count),
            views_count: asCount((comment as Record<string, unknown>).views_count),
            reposts_count: asCount((comment as Record<string, unknown>).reposts_count),
          },
          user_interactions: {
            has_liked: Boolean((comment as Record<string, unknown>).has_liked),
            has_reposted: Boolean((comment as Record<string, unknown>).has_reposted),
          },
        },
      }
    }) as ReplyThread[]
  }, [currentUserId])

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
  const { profile: currentUserProfile } = useProfileData({
    userId: currentUserId,
    initialProfile: myProfile,
  })
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
      const data = await fetchRepliesWithPostContext(displayedUserId)
      if (cancelled) return
      setRepliesLoading(false)
      setUserReplies(data)
    })()
    return () => {
      cancelled = true
    }
  }, [displayedUserId, fetchRepliesWithPostContext])

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
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
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
