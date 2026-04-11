import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { ArrowLeft, Calendar, Camera, MapPin, MessageCircle, UserPlus, UserX } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from '../lib/appToast'
import type { Comment, Post, Profile } from '../types'
import { supabase } from '../supabaseClient'
import { useEvents } from '../hooks/useEvents'
import UserAvatar from './UserAvatar'
import PostCard from './PostCard'
import ImageCropperModal from './ImageCropperModal'
import EmptyState from './EmptyState'
import FollowListsModal, { type FollowModalTab } from './FollowListsModal'

type CropTarget = 'avatar' | 'banner'
type ProfileTab = 'posts' | 'replies' | 'events' | 'media'

const TAB_ITEMS: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'Wpisy' },
  { id: 'replies', label: 'Odpowiedzi' },
  { id: 'events', label: 'Wydarzenia' },
  { id: 'media', label: 'Multimedia' },
]

function followActionErrorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  const msg =
    err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
  const t = `${code} ${msg}`.toLowerCase()
  if (
    code === '42P01' ||
    (t.includes('follows') && t.includes('does not exist')) ||
    t.includes('schema cache') ||
    t.includes('could not find the table')
  ) {
    return 'Brak tabeli obserwacji w bazie. Wklej migrację SQL w panelu Supabase (SQL Editor).'
  }
  return 'Nie udało się zaktualizować obserwacji. Spróbuj ponownie.'
}

const followLabelVariants = {
  initial: (hover: boolean) => ({ y: hover ? 10 : -10, opacity: 0 }),
  animate: { y: 0, opacity: 1 },
  exit: (hover: boolean) => ({ y: hover ? 10 : -10, opacity: 0 }),
}

function capitalizeFirst(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function handleFromDisplayName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9ąćęłńóśźż_]/gi, '')
    .replace(/_+/g, '_')
  return slug ? `@${slug}` : '@użytkownik'
}

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

type ReplyRow = {
  id: number
  content: string
  created_at: string
  post_id: string
  posts: { id: string; content: string | null; user_id: string } | { id: string; content: string | null; user_id: string }[] | null
}

function normalizePostJoin(
  posts: ReplyRow['posts'],
): { id: string; content: string | null; user_id: string } | null {
  if (!posts) return null
  return Array.isArray(posts) ? (posts[0] ?? null) : posts
}

function ProfileSkeleton() {
  return (
    <>
      <div className="mb-6 w-full overflow-hidden rounded-2xl border border-[#0f172a]/10 shadow-sm dark:border-white/5 dark:shadow-2xl dark:shadow-black/50 animate-pulse">
        <div className="h-40 w-full bg-slate-200 dark:bg-white/10 lg:h-52" />
        <div className="flex justify-end px-4 pt-3 pb-2 sm:px-6">
          <div className="h-9 w-28 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
        <div className="flex items-end gap-4 px-4 pb-2 sm:px-6 -mt-12 lg:-mt-16">
          <div className="h-24 w-24 shrink-0 rounded-full border-4 border-bg-app bg-slate-200 dark:bg-white/10 lg:h-32 lg:w-32" />
        </div>
        <div className="space-y-3 p-6 pt-4">
          <div className="h-9 w-56 rounded-lg bg-slate-200 dark:bg-white/10" />
          <div className="h-4 w-36 rounded-full bg-slate-100 dark:bg-white/5" />
          <div className="h-20 max-w-prose rounded-lg bg-slate-100 dark:bg-white/5" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card rounded-2xl border border-slate-100 dark:border-border-app p-4 animate-pulse"
          >
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full w-1/3" />
                <div className="h-2.5 bg-slate-100 dark:bg-white/5 rounded-full w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

type Props = {
  myProfile: Profile | null
  displayName: string
  currentUserId: string
  viewedUserId?: string | null
  onBack?: () => void
  onNavigateToPost?: (postId: string) => void
  joinedAtLabel?: string | null
  onOpenProfileModal: () => void
  onNavigateToUser?: (userId: string) => void
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

export default function ProfileView({
  myProfile,
  displayName,
  currentUserId,
  viewedUserId = null,
  onBack,
  onNavigateToPost,
  joinedAtLabel,
  onOpenProfileModal,
  onNavigateToUser,
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
  const isOwn = !viewedUserId || viewedUserId === currentUserId

  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [otherPosts, setOtherPosts] = useState<Post[]>([])
  const [otherLoading, setOtherLoading] = useState(false)
  const [otherNotFound, setOtherNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followStatsLoading, setFollowStatsLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followActionLoading, setFollowActionLoading] = useState(false)
  const [followingBtnHovered, setFollowingBtnHovered] = useState(false)
  const [followModalOpen, setFollowModalOpen] = useState(false)
  const [followModalInitialTab, setFollowModalInitialTab] = useState<FollowModalTab>('followers')

  const [userReplies, setUserReplies] = useState<ReplyRow[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)

  const fetchOtherUser = useCallback(async (userId: string) => {
    setOtherLoading(true)
    setOtherNotFound(false)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profileData) {
      setOtherNotFound(true)
      setOtherProfile(null)
      setOtherPosts([])
      setOtherLoading(false)
      return
    }

    setOtherProfile(profileData as Profile)

    const { data: postsData } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setOtherPosts((postsData ?? []) as Post[])
    setOtherLoading(false)
  }, [])

  useEffect(() => {
    if (!isOwn && viewedUserId) void fetchOtherUser(viewedUserId)
  }, [isOwn, viewedUserId, fetchOtherUser])

  useEffect(() => {
    setActiveTab('posts')
  }, [viewedUserId, isOwn])

  const profileForDisplay: Profile | null = isOwn ? myProfile : otherProfile
  const titleName =
    isOwn ? (myProfile?.full_name || displayName) : (otherProfile?.full_name || 'Użytkownik')

  const displayedUserId = isOwn ? currentUserId : (viewedUserId ?? '')

  const userPosts = isOwn ? posts.filter((p) => p.user_id === currentUserId) : otherPosts
  const mediaPosts = userPosts.filter((p) => Boolean(p.image_url?.trim()))
  const attendingEvents = allEvents.filter((e) => e.isAttending)

  const showPostsLoading = isOwn ? postsLoading : otherLoading

  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const followToggleInFlight = useRef(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const loadFollowStats = useCallback(async (opts?: { silent?: boolean }) => {
    if (!displayedUserId) return
    const silent = opts?.silent ?? false
    if (!silent) setFollowStatsLoading(true)
    const [folRes, wingRes] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', displayedUserId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', displayedUserId),
    ])
    if (!silent) setFollowStatsLoading(false)
    if (folRes.error || wingRes.error) {
      setFollowersCount(0)
      setFollowingCount(0)
      return
    }
    setFollowersCount(folRes.count ?? 0)
    setFollowingCount(wingRes.count ?? 0)
  }, [displayedUserId])

  useEffect(() => {
    void loadFollowStats()
  }, [loadFollowStats])

  useEffect(() => {
    if (isOwn || !viewedUserId) {
      setIsFollowing(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', viewedUserId)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setIsFollowing(false)
        return
      }
      setIsFollowing(Boolean(data))
    })()
    return () => {
      cancelled = true
    }
  }, [isOwn, viewedUserId, currentUserId])

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

  const handleFollowToggle = async () => {
    if (!viewedUserId || isOwn || followToggleInFlight.current) return
    followToggleInFlight.current = true
    setFollowActionLoading(true)
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', viewedUserId)
        if (error) throw error
        setIsFollowing(false)
        setFollowersCount((c) => Math.max(0, c - 1))
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: viewedUserId,
        })
        if (error) throw error
        setIsFollowing(true)
        setFollowersCount((c) => c + 1)
      }
    } catch (e) {
      console.error(e)
      toast.error(followActionErrorMessage(e), { id: 'profile-follow-action' })
    } finally {
      followToggleInFlight.current = false
      setFollowActionLoading(false)
    }
  }

  const openCrop = (file: File, target: CropTarget) => {
    setCropSrc(URL.createObjectURL(file))
    setCropTarget(target)
  }

  const clearCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropTarget(null)
  }

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) openCrop(file, 'banner')
    if (bannerInputRef.current) bannerInputRef.current.value = ''
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) openCrop(file, 'avatar')
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const persistProfileField = async (patch: { avatar_url?: string; banner_url?: string }) => {
    await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', currentUserId)
  }

  const handleBannerCropSave = async (blob: Blob) => {
    clearCrop()
    setUploadingBanner(true)
    try {
      const filePath = `banners/${currentUserId}/${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const publicUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
      await persistProfileField({ banner_url: publicUrl })
      onBannerUpdate?.(publicUrl)
    } catch (err) {
      console.error('Błąd uploadu banera:', err)
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleAvatarCropSave = async (blob: Blob) => {
    clearCrop()
    setUploadingAvatar(true)
    try {
      const filePath = `avatars/${currentUserId}/${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const publicUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
      await persistProfileField({ avatar_url: publicUrl })
      onAvatarUpdate?.(publicUrl)
    } catch (err) {
      console.error('Błąd uploadu awatara:', err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const bannerUrl = profileForDisplay?.banner_url
  const handleLabel = handleFromDisplayName(titleName)

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

  const avatarClass =
    'relative z-20 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-bg-app bg-bg-app shadow-lg lg:h-32 lg:w-32'

  const actionBtnClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-[#0f172a]/12 bg-white/95 px-4 py-2 text-sm font-semibold text-fg-primary shadow-sm transition-colors hover:border-brand-gold/50 dark:border-white/20 dark:bg-[#01020a]/95 dark:text-white dark:hover:border-brand-gold/40'

  const renderPostList = (list: Post[]) => {
    if (list.length === 0) return null
    return (
      <div className="rounded-2xl border border-[#0f172a]/10 bg-card overflow-hidden divide-y divide-[#0f172a]/10 dark:border-white/10 dark:divide-white/10">
        {list.map((post, idx) => {
          const postId = String(post?.id ?? `fallback-${idx}`)
          return (
            <PostCard
              key={postId}
              variant="stacked"
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
      </div>
    )
  }

  function eventDateParts(d: Date) {
    const day = d.toLocaleDateString('pl-PL', { day: 'numeric' })
    const month = d
      .toLocaleDateString('pl-PL', { month: 'short' })
      .replace('.', '')
      .toUpperCase()
    return { day, month }
  }

  if (!isOwn && otherLoading) {
    return (
      <div className="space-y-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-fg-secondary dark:text-gray-400 hover:text-fg-primary dark:hover:text-white transition-colors -ml-1 mb-1"
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
            className="flex items-center gap-1.5 text-sm font-semibold text-fg-secondary dark:text-gray-400 hover:text-fg-primary dark:hover:text-white transition-colors -ml-1 mb-1"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}
        <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
          <UserX size={48} strokeWidth={1.5} className="text-slate-300 dark:text-white/20" />
          <p className="text-[15px] font-semibold text-slate-500 dark:text-gray-400">
            Nie znaleziono użytkownika
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {cropSrc && cropTarget === 'banner' && isOwn && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={3}
          cropShape="rect"
          title="Kadruj baner profilu (3:1)"
          onCancel={clearCrop}
          onSave={(blob) => void handleBannerCropSave(blob)}
        />
      )}
      {cropSrc && cropTarget === 'avatar' && isOwn && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          title="Kadruj zdjęcie profilowe"
          onCancel={clearCrop}
          onSave={(blob) => void handleAvatarCropSave(blob)}
        />
      )}

      {displayedUserId ? (
        <FollowListsModal
          open={followModalOpen}
          onClose={() => setFollowModalOpen(false)}
          profileUserId={displayedUserId}
          currentUserId={currentUserId}
          initialTab={followModalInitialTab}
          onCountsChange={loadFollowStats}
        />
      ) : null}

      <div className="space-y-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-fg-secondary dark:text-gray-400 hover:text-fg-primary dark:hover:text-white transition-colors -ml-1 mb-1"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}

        <div className="relative w-full rounded-2xl border border-[#0f172a]/10 bg-[#f8fafc] shadow-sm dark:border-white/5 dark:bg-[#01020a] dark:shadow-2xl dark:shadow-black/50">
          <div className="relative h-40 w-full overflow-hidden lg:h-52">
            {bannerUrl ? (
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-black" aria-hidden />
            )}

            {isOwn ? (
              <>
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  aria-label="Zmień baner profilu"
                  className="group/banner absolute inset-0 z-[5] flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/banner:opacity-100 group-focus-visible/banner:opacity-100">
                    {uploadingBanner ? (
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera size={22} strokeWidth={2} />
                    )}
                  </span>
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerFileChange}
                />
              </>
            ) : null}
          </div>

          <div className="relative flex flex-col border-t border-[#0f172a]/8 dark:border-white/5">
            <div className="flex items-end justify-between gap-3 px-4 sm:px-6">
              <div className="-mt-12 flex min-w-0 flex-1 items-end lg:-mt-16">
                {isOwn ? (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Zmień zdjęcie profilowe"
                    className={`group/avatar ${avatarClass} p-0 text-left transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-70`}
                  >
                    <UserAvatar
                      profile={profileForDisplay}
                      name={titleName}
                      className="h-full w-full border-0"
                      textSize="text-xl lg:text-2xl"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                      {uploadingAvatar ? (
                        <span className="h-7 w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Camera size={22} strokeWidth={2} className="text-white drop-shadow-md" />
                      )}
                    </span>
                  </button>
                ) : (
                  <div className={avatarClass}>
                    <UserAvatar
                      profile={profileForDisplay}
                      name={titleName}
                      className="h-full w-full border-0"
                      textSize="text-xl lg:text-2xl"
                    />
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 pb-3 pt-2 sm:pb-4">
                {isOwn ? (
                  <button type="button" onClick={onOpenProfileModal} className={actionBtnClass}>
                    Edytuj profil
                  </button>
                ) : !isFollowing ? (
                  <motion.button
                    type="button"
                    onClick={() => void handleFollowToggle()}
                    disabled={followActionLoading}
                    whileTap={followActionLoading ? undefined : { scale: 0.95 }}
                    className={actionBtnClass}
                  >
                    {followActionLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <UserPlus size={18} strokeWidth={2} />
                        Obserwuj
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => void handleFollowToggle()}
                    disabled={followActionLoading}
                    whileTap={followActionLoading ? undefined : { scale: 0.95 }}
                    onHoverStart={() => setFollowingBtnHovered(true)}
                    onHoverEnd={() => setFollowingBtnHovered(false)}
                    className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                      followingBtnHovered
                        ? 'border-red-500/35 text-red-500/80'
                        : 'border-[#0f172a]/20 bg-transparent text-[#0f172a] dark:border-white/25 dark:text-white'
                    }`}
                  >
                    {followActionLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <span className="relative block min-h-5 min-w-[12.5rem] overflow-hidden">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={followingBtnHovered ? 'u' : 'f'}
                            custom={followingBtnHovered}
                            variants={followLabelVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-x-0 top-0 block text-center whitespace-nowrap"
                          >
                            {followingBtnHovered ? 'Przestań obserwować' : 'Obserwujesz'}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    )}
                  </motion.button>
                )}
              </div>
            </div>

            {isOwn && (
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            )}

            <div className="space-y-4 px-4 pb-4 pt-1 text-left sm:px-6 sm:pb-6">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-fg-primary dark:text-white">
                  {titleName}
                </h2>
                <p className="mt-0.5 text-base text-slate-500 dark:text-slate-500">{handleLabel}</p>
              </div>

              {profileForDisplay?.bio ? (
                <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-fg-primary dark:text-white">
                  {profileForDisplay.bio}
                </p>
              ) : (
                <p className="max-w-prose text-sm italic leading-relaxed text-fg-secondary">
                  {isOwn
                    ? 'Brak opisu — kliknij „Edytuj profil”, aby dodać bio.'
                    : 'Brak opisu.'}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 dark:text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="shrink-0 text-brand-gold" aria-hidden>
                    <MapPinIcon className="h-5 w-5" />
                  </span>
                  Kraków, Polska
                </span>
                {profileForDisplay?.department ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="shrink-0 text-brand-gold" aria-hidden>
                      <AcademicCapIcon className="h-5 w-5" />
                    </span>
                    {profileForDisplay.department}
                  </span>
                ) : null}
                {joinedLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="shrink-0 text-brand-gold" aria-hidden>
                      <CalendarDaysIcon className="h-5 w-5" />
                    </span>
                    Dołączył {joinedLabel}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <button
                  type="button"
                  disabled={followStatsLoading}
                  onClick={() => {
                    setFollowModalInitialTab('following')
                    setFollowModalOpen(true)
                  }}
                  className="group inline-flex flex-wrap items-baseline gap-x-1 rounded-md text-left transition hover:underline hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
                >
                  <strong className="text-lg font-bold tabular-nums text-[#0f172a] dark:text-white">
                    {followStatsLoading ? '…' : formatCompactCount(followingCount)}
                  </strong>
                  <span className="text-slate-500 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                    Obserwowanych
                  </span>
                </button>
                <button
                  type="button"
                  disabled={followStatsLoading}
                  onClick={() => {
                    setFollowModalInitialTab('followers')
                    setFollowModalOpen(true)
                  }}
                  className="group inline-flex flex-wrap items-baseline gap-x-1 rounded-md text-left transition hover:underline hover:opacity-90 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
                >
                  <strong className="text-lg font-bold tabular-nums text-[#0f172a] dark:text-white">
                    {followStatsLoading ? '…' : formatCompactCount(followersCount)}
                  </strong>
                  <span className="text-slate-500 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                    Obserwujących
                  </span>
                </button>
              </div>

              <nav
                className="relative z-20 -mx-1 flex border-b border-[#0f172a]/10 dark:border-white/5"
                role="tablist"
                aria-label="Treści profilu"
              >
                {TAB_ITEMS.map((t) => {
                  const isActive = activeTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`profile-tab-panel-${t.id}`}
                      id={`profile-tab-${t.id}`}
                      onClick={() => {
                        setActiveTab(t.id)
                      }}
                      className={`relative z-10 flex-1 px-2 py-3 text-center text-sm font-semibold transition-colors border-b-2 -mb-px ${
                        isActive
                          ? 'border-brand-gold text-[#0f172a] dark:border-brand-gold-bright dark:text-white'
                          : 'border-transparent text-slate-500 hover:text-[#0f172a] dark:text-slate-500 dark:hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        <div className="relative z-10 isolate">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              role="tabpanel"
              id={`profile-tab-panel-${activeTab}`}
              aria-labelledby={`profile-tab-${activeTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, visibility: 'visible' }}
              exit={{
                opacity: 0,
                visibility: 'hidden',
                transition: { duration: 0.18, ease: 'easeOut' },
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-none min-h-[8rem]"
            >
              <div className="pointer-events-auto">
            {activeTab === 'posts' && (
              <>
                {showPostsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-gold border-t-transparent" />
                  </div>
                ) : userPosts.length === 0 && isOwn ? (
                  <div className="flex flex-col items-center py-12 text-slate-400">
                    <MessageCircle size={36} className="mb-3 opacity-20" />
                    <p className="text-sm">Nie masz jeszcze żadnych wpisów.</p>
                  </div>
                ) : userPosts.length === 0 && !isOwn ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="Brak wpisów"
                    subtitle="Ten użytkownik nie opublikował jeszcze żadnych postów"
                  />
                ) : (
                  renderPostList(userPosts)
                )}
              </>
            )}

            {activeTab === 'media' && (
              <>
                {showPostsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-gold border-t-transparent" />
                  </div>
                ) : mediaPosts.length === 0 ? (
                  <EmptyState
                    icon={Camera}
                    title="Brak multimediów"
                    subtitle={
                      isOwn
                        ? 'Opublikuj wpis ze zdjęciem, aby pojawiło się tutaj.'
                        : 'Brak wpisów ze zdjęciami.'
                    }
                  />
                ) : (
                  renderPostList(mediaPosts)
                )}
              </>
            )}

            {activeTab === 'replies' && (
              <>
                {repliesLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-gold border-t-transparent" />
                  </div>
                ) : userReplies.length === 0 ? (
                  <EmptyState
                    icon={MessageCircle}
                    title="Brak odpowiedzi"
                    subtitle={
                      isOwn
                        ? 'Komentarze przy wpisach innych osób pojawią się tutaj.'
                        : 'Ten użytkownik nie dodał jeszcze komentarzy.'
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {userReplies.map((row) => {
                      const post = normalizePostJoin(row.posts)
                      const preview = post?.content?.trim() || '(wpis usunięty lub niedostępny)'
                      return (
                        <li
                          key={row.id}
                          className="rounded-2xl border border-[#0f172a]/10 bg-card p-4 dark:border-white/10"
                        >
                          <p className="whitespace-pre-line text-[15px] leading-relaxed text-fg-primary dark:text-white">
                            {row.content}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#0f172a]/08 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-500">
                            <span>
                              Na: <span className="text-fg-secondary line-clamp-2">{preview}</span>
                            </span>
                            {onNavigateToPost && post?.id && (
                              <button
                                type="button"
                                onClick={() => onNavigateToPost(String(post.id))}
                                className="shrink-0 font-semibold text-brand-gold hover:text-brand-gold-bright"
                              >
                                Zobacz wpis
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}

            {activeTab === 'events' && (
              <>
                {!isOwn ? (
                  <EmptyState
                    icon={Calendar}
                    title="Brak publicznych wydarzeń"
                    subtitle="Wydarzenia innych użytkowników nie są jeszcze udostępniane."
                  />
                ) : attendingEvents.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Brak wydarzeń"
                    subtitle="Zaznacz udział w wydarzeniach w zakładce Wydarzenia."
                  />
                ) : (
                  <ul className="relative z-10 space-y-3">
                    {attendingEvents.map((e) => {
                      const { day, month } = eventDateParts(e.date)
                      const timeStr = e.date.toLocaleTimeString('pl-PL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      return (
                        <li key={e.id} className="list-none">
                          <button
                            type="button"
                            onClick={() => onNavigateToEvents?.()}
                            className="flex w-full cursor-pointer gap-4 rounded-xl border border-[#0f172a]/10 bg-card p-4 text-left shadow-sm transition-colors hover:border-brand-gold/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 dark:border-white/5 dark:shadow-none dark:hover:border-brand-gold/30"
                          >
                            <div className="pointer-events-none flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg border border-[#0f172a]/10 py-3 dark:border-white/5 dark:bg-white/[0.04]">
                              <span className="text-2xl font-bold leading-none text-brand-gold">{day}</span>
                              <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
                                {month}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              {e.category ? (
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
                                  {e.category}
                                </p>
                              ) : null}
                              <p className="text-base font-semibold leading-snug text-[#0f172a] dark:text-white">
                                {e.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{timeStr}</p>
                              {e.description ? (
                                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                  {e.description}
                                </p>
                              ) : null}
                              {e.location ? (
                                <p className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                  <span className="mt-0.5 shrink-0 text-brand-gold" aria-hidden>
                                    <MapPin className="h-4 w-4" strokeWidth={2} />
                                  </span>
                                  <span>{e.location}</span>
                                </p>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
