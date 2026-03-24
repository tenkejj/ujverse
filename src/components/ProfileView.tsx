import { Camera, Instagram, Linkedin, MessageCircle, Settings } from 'lucide-react'
import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { Comment, Post, Profile } from '../types'
import UserAvatar from './UserAvatar'
import PostCard from './PostCard'
import ImageCropperModal from './ImageCropperModal'

type Props = {
  myProfile: Profile | null
  displayName: string
  email: string | undefined
  currentUserId: string
  onOpenProfileModal: () => void
  onBannerUpdate?: (newUrl: string) => void

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
  email,
  currentUserId,
  onOpenProfileModal,
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
  const myPosts = posts.filter((p) => p.user_id === currentUserId)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayBannerUrl = bannerUrl ?? myProfile?.banner_url ?? null

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCropSave(croppedBlob: Blob) {
    if (!myProfile?.id) return
    setIsUploading(true)
    setCropSrc(null)
    try {
      const path = `${myProfile.id}/banner-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(path, croppedBlob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('banners').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: publicUrl })
        .eq('id', myProfile.id)

      if (updateError) throw updateError

      setBannerUrl(publicUrl)
      onBannerUpdate?.(publicUrl)
    } catch (err) {
      console.error('Błąd wgrywania bannera:', err)
    } finally {
      setIsUploading(false)
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  return (
    <>
      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}

      {/* Profile card */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-white/5 border-t-2 border-t-uj-blue/10 dark:border-t-uj-orange/20 shadow-uj-soft dark:shadow-none">

        {/* Banner */}
        <div className="relative w-full h-32 bg-gradient-to-r from-blue-900 to-blue-800 overflow-hidden rounded-t-2xl">
          {displayBannerUrl && (
            <img
              src={displayBannerUrl}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />

          {myProfile?.id === currentUserId && (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/65 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
            >
              <Camera size={13} />
              {isUploading ? 'Wgrywanie…' : 'Zmień tło'}
            </button>
          )}
        </div>

        <div className="px-5 pb-6 pt-12 relative">
          {/* Avatar — wypchnięty ponad banner */}
          <UserAvatar
            profile={myProfile}
            name={displayName}
            className="absolute -top-10 left-5 h-20 w-20 border-4 border-white dark:border-dark-card shadow-lg"
            textSize="text-2xl"
          />

          {/* Przycisk edycji po prawej */}
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs font-semibold text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-600 shadow-sm transition-all"
            >
              <Settings size={12} /> Edytuj profil
            </button>
          </div>

          {/* Name */}
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-blue-50 leading-tight">{displayName}</h2>

          {/* Major + year */}
          {(myProfile?.major || myProfile?.year_of_study) && (
            <p className="text-sm text-uj-blue font-medium mt-0.5">
              {[myProfile.major, myProfile.year_of_study].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Email */}
          <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 mb-3">{email}</p>

          {/* Bio */}
          {myProfile?.bio ? (
            <p className="text-[14px] text-slate-700 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-line">{myProfile.bio}</p>
          ) : (
            <p className="text-[13px] text-slate-400 dark:text-gray-500 italic mb-3">
              Brak opisu — kliknij „Edytuj profil", aby dodać bio.
            </p>
          )}

          {/* Social links */}
          {(myProfile?.instagram_url || myProfile?.linkedin_url) && (
            <div className="flex items-center gap-3 mt-1">
              {myProfile.instagram_url && (
                <a
                  href={myProfile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                >
                  <Instagram size={12} /> Instagram
                </a>
              )}
              {myProfile.linkedin_url && (
                <a
                  href={myProfile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A66C2] text-white text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                >
                  <Linkedin size={12} /> LinkedIn
                </a>
              )}
            </div>
          )}
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
          />
        )
      })}
    </>
  )
}
