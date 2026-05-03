import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Camera } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../supabaseClient'
import type { Profile } from '../../types'
import UserAvatar from '../UserAvatar'
import ImageCropperModal from '../ImageCropperModal'
import { PROFILE_MOBILE } from '../../styles/mobile-theme'

type CropTarget = 'avatar' | 'banner'

type Props = {
  profile: Profile | null
  displayName: string
  isOwn: boolean
  currentUserId: string
  onAvatarUpdate?: (url: string) => void
  onBannerUpdate?: (url: string) => void
  /**
   * Przycisk Edytuj/Obserwuj/Obserwujesz renderowany po prawej stronie
   * awatara. Używa `layoutId=profile-edit-action` — FAB na mobile korzysta
   * z tego samego layoutId, żeby Framer Motion morphował inline ↔ fixed.
   */
  inlineAction?: ReactNode
  /** BadgeDock (desktop absolutny, mobile poziomy pod awatarem) — slot. */
  badgeDockDesktop?: ReactNode
  badgeDockMobile?: ReactNode
}

const AVATAR_SIZE_STYLE = `
.ujverse-profile-hero { --profile-avatar-size: ${PROFILE_MOBILE.avatar.sizePx.base}px; }
@media (min-width: 640px) { .ujverse-profile-hero { --profile-avatar-size: ${PROFILE_MOBILE.avatar.sizePx.sm}px; } }
@media (min-width: 1024px) { .ujverse-profile-hero { --profile-avatar-size: ${PROFILE_MOBILE.avatar.sizePx.lg}px; } }
`

export default function ProfileHero({
  profile,
  displayName,
  isOwn,
  currentUserId,
  onAvatarUpdate,
  onBannerUpdate,
  inlineAction,
  badgeDockDesktop,
  badgeDockMobile,
}: Props) {
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

  const bannerUrl = profile?.banner_url

  const avatarInlineStyle: CSSProperties = {
    width: 'var(--profile-avatar-size)',
    height: 'var(--profile-avatar-size)',
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

      <style>{AVATAR_SIZE_STYLE}</style>

      <motion.div
        variants={PROFILE_MOBILE.motion.fadeUp}
        className={`ujverse-profile-hero relative ${PROFILE_MOBILE.cover.heightClass} overflow-hidden ${PROFILE_MOBILE.cover.radiusClass}`}
      >
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 20% 0%, rgba(232,200,74,0.16) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(15,23,42,0.25) 0%, transparent 55%), linear-gradient(135deg, #0f172a 0%, #020617 100%)',
            }}
            aria-hidden
          />
        )}

        <div className={PROFILE_MOBILE.cover.gradientOverlayClass} aria-hidden />

        {isOwn ? (
          <>
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              aria-label="Zmień baner profilu"
              className="group/banner absolute inset-0 z-[5] flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-not-allowed"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/banner:opacity-100 group-focus-visible/banner:opacity-100">
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

        {badgeDockDesktop ? (
          <div
            className={PROFILE_MOBILE.badgeDock.wrapperDesktopClass}
            style={{
              top: 'calc(var(--profile-avatar-size) * -0.5 + 100%)',
              transform: 'translateY(calc(var(--profile-avatar-size) * 0.15))',
            }}
          >
            {badgeDockDesktop}
          </div>
        ) : null}
      </motion.div>

      <motion.div
        variants={PROFILE_MOBILE.motion.fadeUp}
        className={`ujverse-profile-hero relative ${PROFILE_MOBILE.card.paddingXClass}`}
      >
        <div
          className="flex items-start justify-between gap-3"
          style={{ marginTop: 'calc(var(--profile-avatar-size) * -0.5)' }}
        >
          <div className="flex min-w-0 flex-1 items-end">
            {isOwn ? (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Zmień zdjęcie profilowe"
                style={avatarInlineStyle}
                className={`group/avatar relative z-20 shrink-0 overflow-hidden ${PROFILE_MOBILE.avatar.radiusClass} ${PROFILE_MOBILE.avatar.ringClass} bg-bg-app p-0 text-left transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-70`}
              >
                <UserAvatar
                  profile={profile}
                  name={displayName}
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
              <div
                style={avatarInlineStyle}
                className={`relative z-20 shrink-0 overflow-hidden ${PROFILE_MOBILE.avatar.radiusClass} ${PROFILE_MOBILE.avatar.ringClass} bg-bg-app`}
              >
                <UserAvatar
                  profile={profile}
                  name={displayName}
                  className="h-full w-full border-0"
                  textSize="text-xl lg:text-2xl"
                />
              </div>
            )}
          </div>

          <div
            className="flex shrink-0 items-center gap-2"
            style={{ paddingTop: 'calc(var(--profile-avatar-size) * 0.5 + 0.5rem)' }}
          >
            {inlineAction}
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

        {badgeDockMobile ? (
          <div className={`mt-3 ${PROFILE_MOBILE.badgeDock.wrapperMobileClass}`}>
            {badgeDockMobile}
          </div>
        ) : null}
      </motion.div>
    </>
  )
}
