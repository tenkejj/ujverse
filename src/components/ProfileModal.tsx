import { useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ImagePlus, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import ImageCropperModal from './ImageCropperModal'
import FacultyAccent from './profile/FacultyAccent'
import { PROFILE_MOBILE } from '../styles/mobile-theme'

const fieldInputCls =
  'w-full rounded-xl border border-black/10 bg-black/[0.05] p-3 text-slate-900 shadow-none ring-0 outline-none transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:shadow-none focus:border-[var(--profile-accent)] dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-neutral-500'


type Props = {
  session: Session
  profile: Profile | null
  onClose: () => void
  onSaved: (updated: Profile) => void
  onAvatarUpdate?: (url: string) => void
}

export default function ProfileModal({ session, profile, onClose, onSaved, onAvatarUpdate }: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [currentBannerUrl] = useState<string | null>(profile?.banner_url ?? null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(onClose, 220)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const handleAvatarCropSave = async (blob: Blob) => {
    setCropSrc(null)
    setIsUploadingAvatar(true)
    try {
      const filePath = `avatars/${session.user.id}/${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase
        .storage.from('media')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const publicUrl = supabase.storage.from('media').getPublicUrl(uploadData.path).data.publicUrl
      setCurrentAvatarUrl(publicUrl)
      setAvatarPreview(publicUrl)
      onAvatarUpdate?.(publicUrl)
    } catch (err) {
      console.error('Błąd uploadu awatara:', err)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: name.trim() || null,
        avatar_url: currentAvatarUrl,
        banner_url: currentBannerUrl,
        bio: bio.trim() || null,
        department: department.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (updateError) { setError(updateError.message); setSaving(false); return }
    onSaved(data as Profile)
    setSaving(false)
    handleClose()
  }

  const panelBase: React.CSSProperties = {
    boxShadow: 'none',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '500px',
    height: 'auto',
    maxHeight: '90vh',
    zIndex: 9999,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    padding: '1.5rem',
    borderRadius: '1.5rem',
    outline: 'none',
  }

  const backdropMerged: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9998,
    opacity: isClosing ? 0 : 1,
    pointerEvents: isClosing ? 'none' : 'auto',
    transition: 'opacity 0.2s ease',
  }

  const panelMerged: React.CSSProperties = {
    ...panelBase,
    opacity: isClosing ? 0 : 1,
    transform: isClosing ? 'translate(-50%, -48%) scale(0.98)' : 'translate(-50%, -50%)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  }

  return (
    <>
      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          cropShape="round"
          title="Kadruj zdjęcie profilowe"
          onCancel={handleAvatarCropCancel}
          onSave={handleAvatarCropSave}
        />
      )}

      <FacultyAccent department={department}>
        <div
          role="presentation"
          className="bg-black/90"
          style={backdropMerged}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            className={`rounded-3xl bg-transparent backdrop-blur-2xl backdrop-saturate-150 ring-0 outline-none ${PROFILE_MOBILE.card.glassLight} ${PROFILE_MOBILE.card.glassDark}`}
            style={panelMerged}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-6 mb-4 flex shrink-0 items-center justify-between border-b border-black/10 bg-white/65 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#02040e]/65">
              <h2 id="profile-modal-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
                Edytuj profil
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-slate-600 shadow-none ring-0 transition-colors hover:bg-slate-100/70 dark:text-white dark:hover:bg-white/10"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="flex flex-col items-center gap-2 pb-2">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Awatar"
                    className="h-24 w-24 rounded-full border-4 border-brand-gold/35 object-cover shadow-none"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-100 shadow-none ring-0 dark:border-[#1c2b4e] dark:bg-[#01020a]">
                    <span className="text-2xl font-bold text-accent-interactive">
                      {(name || session.user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 shadow-none ring-0">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent shadow-none" />
                  </div>
                )}
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-brand-gold p-1.5 text-black shadow-none ring-0 transition-transform hover:scale-110 hover:bg-brand-gold/85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <p className="text-xs text-slate-500 dark:text-neutral-400">Kliknij ikonę, aby zmienić zdjęcie</p>
            </div>

            <div>
              <label htmlFor="profile-name" className="mb-1.5 block font-medium text-slate-900 dark:text-white">
                Imię / Nazwa
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Jan Kowalski"
                maxLength={80}
                className={fieldInputCls}
              />
            </div>

            <div>
              <label htmlFor="profile-bio" className="mb-1.5 block font-medium text-slate-900 dark:text-white">
                O mnie
              </label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Napisz coś o sobie…"
                rows={3}
                maxLength={300}
                className={`${fieldInputCls} resize-none`}
              />
              <p className="mt-1 text-right text-[11px] text-slate-500 dark:text-neutral-500">{bio.length}/300</p>
            </div>

            <div>
              <label htmlFor="profile-location" className="mb-1.5 block font-medium text-slate-900 dark:text-white">
                Lokalizacja
              </label>
              <input
                id="profile-location"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="np. Kraków, Collegium Novum"
                maxLength={120}
                className={fieldInputCls}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-none ring-0 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

            <div className="sticky bottom-0 -mx-6 mt-4 flex shrink-0 justify-end gap-3 border-t border-black/10 bg-white/65 px-6 pt-4 pb-1 backdrop-blur-xl shadow-none ring-0 dark:border-white/10 dark:bg-[#02040e]/65">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 shadow-none ring-0 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--profile-accent)] px-6 py-2.5 text-sm font-bold text-white shadow-[var(--profile-glow)] ring-0 outline-none transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {saving ? 'Zapisuję…' : 'Zapisz'}
              </button>
            </div>
          </div>
        </div>
      </FacultyAccent>
    </>
  )
}
