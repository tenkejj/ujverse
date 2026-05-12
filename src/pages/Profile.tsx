import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MoreVertical, UserX } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Comment, Post, Profile as ProfileT } from '../types'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'
import { useEvents } from '../hooks/useEvents'
import { useProfileData } from '../hooks/useProfileData'
import { useProfileSocialData } from '../hooks/useProfileSocialData'
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
import type { Database } from '../types/database'

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
}: Props) {
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
  const { allEvents, externalEventsLoading } = useEvents()

  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [banActionLoading, setBanActionLoading] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement | null>(null)

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

    const asCount = (value: unknown) => {
      const num = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(num) ? Math.max(0, num) : 0
    }

    type SnapshotValue = {
      likes_count: number
      comments_count: number
      has_liked: boolean
    }
    type EngagementSnapshotRow =
      Database['public']['Functions']['get_replies_engagement_snapshot']['Returns'][number]

    const loadEngagementSnapshot = async (postIds: number[], replyIds: number[]) => {
      const postById: Record<string, SnapshotValue> = {}
      const replyById: Record<string, SnapshotValue> = {}
      const makeDefault = (): SnapshotValue => ({ likes_count: 0, comments_count: 0, has_liked: false })

      for (const id of postIds) postById[String(id)] = makeDefault()
      for (const id of replyIds) replyById[String(id)] = makeDefault()
      if (!postIds.length && !replyIds.length) return { postById, replyById }

      const { data, error } = await supabase.rpc('get_replies_engagement_snapshot', {
        p_post_ids: postIds,
        p_reply_ids: replyIds,
        p_viewer_id: currentUserId || null,
      })

      if (error) {
        console.error('[Profile] replies engagement snapshot', error)
        return { postById, replyById }
      }

      for (const row of ((data ?? []) as EngagementSnapshotRow[])) {
        const id = String(row.entity_id ?? '')
        if (!id) continue
        const normalized: SnapshotValue = {
          likes_count: asCount(row.likes_count),
          comments_count: asCount(row.comments_count),
          has_liked: Boolean(row.has_liked),
        }
        const type = String(row.entity_type ?? '').toLowerCase()
        if (type === 'post') {
          postById[id] = normalized
        } else if (type === 'reply') {
          replyById[id] = normalized
        }
      }

      return { postById, replyById }
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
      const { postById, replyById } = await loadEngagementSnapshot(postIds, replyIds)

      return data.map((comment) => {
        const postJoin = Array.isArray(comment.post) ? (comment.post[0] ?? null) : comment.post
        const postId = String(comment.post_id ?? '')
        const postAuthor = normalizeJoinedProfile(postJoin?.profiles)
        const replyAuthor = normalizeJoinedProfile(comment.profiles)
        const replyId = String(comment.id ?? '')
        const postSnapshot = postById[postId] ?? { likes_count: 0, comments_count: 0, has_liked: false }
        const replySnapshot = replyById[replyId] ?? { likes_count: 0, comments_count: 0, has_liked: false }

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
              likes_count: postSnapshot.likes_count,
              comments_count: postSnapshot.comments_count,
              views_count: 0,
              reposts_count: 0,
            },
            user_interactions: {
              has_liked: postSnapshot.has_liked,
              has_reposted: false,
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
              likes_count: replySnapshot.likes_count,
              comments_count: replySnapshot.comments_count,
              views_count: 0,
              reposts_count: 0,
            },
            user_interactions: {
              has_liked: replySnapshot.has_liked,
              has_reposted: false,
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
    const replyIds = Array.from(
      new Set(
        commentsData
          .map((comment) => Number(comment.id))
          .filter((commentId) => Number.isFinite(commentId) && commentId > 0),
      ),
    )
    const { postById, replyById } = await loadEngagementSnapshot(postIds, replyIds)

    let postsById = new Map<
      number,
      {
        id: string
        created_at?: string
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
      if (postsError) {
        console.error('[Profile] replies posts fallback', postsError)
      }

      if (postsData?.length) {
        postsById = new Map(
          postsData.map((post) => [
            Number(post.id),
            {
              id: String(post.id),
              created_at: String(post.created_at ?? ''),
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
      const replyId = String(comment.id ?? '')
      const post = postsById.get(Number(comment.post_id)) ?? null
      const postAuthor = post?.profiles ?? null
      const replyAuthor = normalizeJoinedProfile(comment.profiles)
      const postSnapshot = postById[postId] ?? { likes_count: 0, comments_count: 0, has_liked: false }
      const replySnapshot = replyById[replyId] ?? { likes_count: 0, comments_count: 0, has_liked: false }
      return {
        id: Number(comment.id),
        post_id: postId,
        post: {
          id: String(post?.id ?? postId),
          created_at: String(post?.created_at ?? comment.created_at ?? ''),
          content: post?.content ?? null,
          media_url: post?.image_url ?? null,
          media_urls: post?.media_urls ?? null,
          attachments: post?.attachments ?? null,
          author: buildAuthor(postAuthor, post?.user_id),
          stats: {
            likes_count: postSnapshot.likes_count,
            comments_count: postSnapshot.comments_count,
            views_count: 0,
            reposts_count: 0,
          },
          user_interactions: {
            has_liked: postSnapshot.has_liked,
            has_reposted: false,
          },
        },
        reply: {
          id: replyId,
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
            likes_count: replySnapshot.likes_count,
            comments_count: replySnapshot.comments_count,
            views_count: 0,
            reposts_count: 0,
          },
          user_interactions: {
            has_liked: replySnapshot.has_liked,
            has_reposted: false,
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

    const asProfile = profileData as ProfileT
    setOtherProfile(asProfile)

    if (asProfile.is_banned === true) {
      setOtherPosts([])
      setOtherLoading(false)
      return
    }

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

  const userPostsRaw = isOwn ? posts.filter((p) => p.user_id === currentUserId) : otherPosts
  const profileBanned = profileForDisplay?.is_banned === true
  const userPosts = profileBanned ? [] : userPostsRaw
  const mediaPosts = userPosts.filter((p) => Boolean(p.image_url?.trim()))

  const isCurrentUserAdmin = myProfile?.role === 'admin'
  const canShowAdminMenu = isCurrentUserAdmin && !isOwn && Boolean(otherProfile?.id)

  useEffect(() => {
    if (!adminMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = adminMenuRef.current
      if (el && !el.contains(e.target as Node)) setAdminMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [adminMenuOpen])

  const handleToggleBanViewedUser = useCallback(async () => {
    if (!otherProfile?.id || banActionLoading) return
    const nextBanned = !otherProfile.is_banned
    setBanActionLoading(true)
    const { error } = await supabase.from('profiles').update({ is_banned: nextBanned }).eq('id', otherProfile.id)
    setBanActionLoading(false)
    if (error) {
      console.error('[Profile] ban toggle', error)
      toast.error(error.message || 'Nie udało się zaktualizować statusu konta.')
      return
    }
    const viewedId = otherProfile.id
    setOtherProfile((prev) => (prev ? { ...prev, is_banned: nextBanned } : null))
    if (nextBanned) {
      setOtherPosts([])
    } else {
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, user_id, profiles(id, full_name, username, avatar_url, department)')
        .eq('user_id', viewedId)
        .order('created_at', { ascending: false })
      setOtherPosts((postsData ?? []) as Post[])
    }
    toast.success(nextBanned ? 'Użytkownik został zablokowany.' : 'Blokada konta została zniesiona.')
    setAdminMenuOpen(false)
  }, [otherProfile?.id, otherProfile?.is_banned, banActionLoading])
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

  const profileEvents = useMemo(() => {
    if (!displayedUserId) return []
    return allEvents
      .filter((ev) => ev.user_id === displayedUserId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [allEvents, displayedUserId])

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
    attendingEventsCount: profileEvents.length,
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
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
          <UserX size={48} strokeWidth={1.5} className="text-zinc-300 dark:text-white/20" />
          <p className="text-[15px] font-semibold text-zinc-500 dark:text-gray-400">
            Nie znaleziono użytkownika
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
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
            headerTrailing={
              canShowAdminMenu ? (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    type="button"
                    onClick={() => setAdminMenuOpen((open) => !open)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                    aria-expanded={adminMenuOpen}
                    aria-haspopup="menu"
                    aria-label="Menu moderacji"
                  >
                    <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  {adminMenuOpen ? (
                    <div
                      className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-border-app bg-bg-card py-1 shadow-lg backdrop-blur-md"
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={banActionLoading}
                        onClick={() => void handleToggleBanViewedUser()}
                        className="block w-full px-3 py-2 text-left text-sm text-fg-primary hover:bg-black/[0.04] disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/[0.06]"
                      >
                        {otherProfile?.is_banned === true ? 'Odbanuj' : 'Zbanuj użytkownika'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null
            }
          />

          {profileBanned ? (
            <div
              className={`mt-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100 ${PROFILE_MOBILE.card.paddingXClass}`}
            >
              <p className="font-medium">To konto zostało zablokowane przez administrację</p>
            </div>
          ) : null}

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
              commentsLoadingByPost={commentsLoadingByPost}
              expandedComments={expandedComments}
              commentInput={commentInput}
              commentSubmitting={commentSubmitting}
              onToggleLike={onToggleLike}
              onToggleComments={onToggleComments}
              onSubmitComment={onSubmitComment}
              onCommentInputChange={onCommentInputChange}
              onToggleCommentLike={onToggleCommentLike}
              onReplyToComment={onReplyToComment}
              onCancelReply={onCancelReply}
              commentReplyTargetByPost={commentReplyTargetByPost}
              commentLikeLoadingByPost={commentLikeLoadingByPost}
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
              commentsLoadingByPost={commentsLoadingByPost}
              expandedComments={expandedComments}
              commentInput={commentInput}
              commentSubmitting={commentSubmitting}
              onToggleLike={onToggleLike}
              onToggleComments={onToggleComments}
              onSubmitComment={onSubmitComment}
              onCommentInputChange={onCommentInputChange}
              onToggleCommentLike={onToggleCommentLike}
              onReplyToComment={onReplyToComment}
              onCancelReply={onCancelReply}
              commentReplyTargetByPost={commentReplyTargetByPost}
              commentLikeLoadingByPost={commentLikeLoadingByPost}
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
              events={profileEvents}
              loading={externalEventsLoading}
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
    </>
  )
}
