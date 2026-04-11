import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { ArrowLeft, Camera, MessageCircle, UserPlus, UserX } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Comment, Post, Profile } from '../types'
import { supabase } from '../supabaseClient'
import { useEvents } from '../hooks/useEvents'
import UserAvatar from './UserAvatar'
import PostCard from './PostCard'
import ImageCropperModal from './ImageCropperModal'
import EmptyState from './EmptyState'

type CropTarget = 'avatar' | 'banner'

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

function ProfileSkeleton() {
  return (
    <>
      <div className="mb-6 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#1c2b4e] animate-pulse">
        <div className="h-32 w-full bg-slate-200 dark:bg-white/10 lg:h-48" />
        <div className="p-6 pt-16 lg:pt-20">
          <div className="h-8 w-48 rounded-full bg-slate-200 dark:bg-white/10" />
          <div className="mt-2 h-4 w-32 rounded-full bg-slate-100 dark:bg-white/5" />
          <div className="mt-4 h-16 w-full rounded-lg bg-slate-100 dark:bg-white/5" />
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
  /** Gdy ustawione i różne od currentUserId — profil innej osoby (fetch lokalny). */
  viewedUserId?: string | null
  onBack?: () => void
  onNavigateToPost?: (postId: string) => void
  /** np. z session.user.created_at — „październik 2023” (tylko mój profil). */
  joinedAtLabel?: string | null
  onOpenProfileModal: () => void
  onNavigateToUser?: (userId: string) => void
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

  const profileForDisplay: Profile | null = isOwn ? myProfile : otherProfile
  const titleName =
    isOwn
      ? (myProfile?.full_name || displayName)
      : (otherProfile?.full_name || 'Użytkownik')

  const userPosts = isOwn
    ? posts.filter((p) => p.user_id === currentUserId)
    : otherPosts

  const showPostsLoading = isOwn ? postsLoading : otherLoading

  const eventsAttendingCount = allEvents.filter((e) => e.isAttending).length

  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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
  const joinedFormatted =
    isOwn && joinedAtLabel?.trim()
      ? `Dołączył: ${capitalizeFirst(joinedAtLabel.trim())}`
      : isOwn
        ? 'Dołączył: —'
        : null

  if (!isOwn && otherLoading) {
    return (
      <div className="space-y-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors -ml-1 mb-1"
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
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors -ml-1 mb-1"
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

      <div className="space-y-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors -ml-1 mb-1"
          >
            <ArrowLeft size={18} />
            Wróć
          </button>
        )}

        <div className="relative mb-6 w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] shadow-sm dark:border-[#1c2b4e] dark:bg-[#01020a]">
          <div className="relative">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt=""
                className="h-32 w-full object-cover lg:h-48"
              />
            ) : (
              <div className="h-32 w-full bg-black lg:h-48" aria-hidden />
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

                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="absolute top-[calc(100%-45px)] right-4 z-20 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-[#01020a] dark:text-white dark:hover:bg-white/10"
                >
                  Edytuj profil
                </button>
              </>
            ) : (
              <div className="absolute top-[calc(100%-45px)] right-4 z-20">
                <button
                  type="button"
                  onClick={() => toast('Obserwowanie użytkowników będzie dostępne wkrótce.')}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-[#01020a] dark:text-white dark:hover:bg-white/10"
                >
                  <UserPlus size={18} strokeWidth={2} />
                  Obserwuj
                </button>
              </div>
            )}
          </div>

          {isOwn ? (
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Zmień zdjęcie profilowe"
              className="group/avatar absolute left-6 top-20 z-10 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white p-0 shadow-md transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-70 dark:border-[#01020a] dark:bg-[#01020a] lg:top-32 lg:h-32 lg:w-32"
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
            <div className="absolute left-6 top-20 z-10 h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-md dark:border-[#01020a] dark:bg-[#01020a] lg:top-32 lg:h-32 lg:w-32">
              <UserAvatar
                profile={profileForDisplay}
                name={titleName}
                className="h-full w-full border-0"
                textSize="text-xl lg:text-2xl"
              />
            </div>
          )}
          {isOwn && (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          )}

          <div className="p-6 pt-16 text-left lg:pt-20">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{titleName}</h2>
            <p className="text-slate-500">{handleLabel}</p>

            {profileForDisplay?.bio ? (
              <p className="my-3 whitespace-pre-line text-slate-800 dark:text-white">{profileForDisplay.bio}</p>
            ) : (
              <p className="my-3 text-sm italic text-slate-500">
                {isOwn
                  ? 'Brak opisu — kliknij „Edytuj profil”, aby dodać bio.'
                  : 'Brak opisu.'}
              </p>
            )}

            <div className="mt-1 flex flex-col gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              {profileForDisplay?.department && (
                <div className="flex items-center gap-2 text-accent-interactive">
                  <AcademicCapIcon className="h-5 w-5 shrink-0 text-accent-interactive" aria-hidden />
                  <span>{profileForDisplay.department}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPinIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <span>Kraków, Polska</span>
              </div>
              {joinedFormatted && (
                <div className="flex items-center gap-2">
                  <CalendarDaysIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <span>{joinedFormatted}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-6 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
              <span>
                <strong className="font-bold text-slate-900 dark:text-white">{userPosts.length}</strong>{' '}
                <span className="text-slate-500">Postów</span>
              </span>
              {isOwn && (
                <span>
                  <strong className="font-bold text-slate-900 dark:text-white">{eventsAttendingCount}</strong>{' '}
                  <span className="text-slate-500">Wydarzeń</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPostsLoading && (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-uj-blue border-t-transparent" />
        </div>
      )}

      {!showPostsLoading && userPosts.length === 0 && isOwn && (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <MessageCircle size={36} className="mb-3 opacity-20" />
          <p className="text-sm">Nie masz jeszcze żadnych wpisów.</p>
        </div>
      )}

      {!showPostsLoading && userPosts.length === 0 && !isOwn && (
        <EmptyState
          icon={MessageCircle}
          title="Brak wpisów"
          subtitle="Ten użytkownik nie opublikował jeszcze żadnych postów"
        />
      )}

      {!showPostsLoading && userPosts.length > 0 && (
        <div className="space-y-3">
          {userPosts.map((post, idx) => {
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
        </div>
      )}
    </>
  )
}
