import { useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ImagePlus, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import ImageCropperModal from './ImageCropperModal'
import FacultyAccent from './profile/FacultyAccent'
import { PROFILE_MOBILE, SEARCH_MOBILE } from '../styles/mobile-theme'
import { UJ_DEPARTMENTS, canonicalDepartment } from '../lib/departments'

const fieldInputCls = `${SEARCH_MOBILE.mobileInputClass} h-auto px-3 py-3 pl-3 leading-tight placeholder:text-fg-secondary/50 dark:placeholder:text-fg-secondary/50`
const DEPARTMENT_PLACEHOLDER = 'Wybierz wydział'

function sanitizeDepartment(raw: string | null | undefined): string | null {
  const normalized = canonicalDepartment(raw)
  if (!normalized) return null
  const trimmed = normalized.trim()
  if (!trimmed || trimmed === DEPARTMENT_PLACEHOLDER) return null
  return UJ_DEPARTMENTS.includes(trimmed as (typeof UJ_DEPARTMENTS)[number]) ? trimmed : null
}


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
  const [department, setDepartment] = useState(sanitizeDepartment(profile?.department) ?? '')
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
    const sanitizedDepartment = sanitizeDepartment(department)

    const { data, error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: name.trim() || null,
        avatar_url: currentAvatarUrl,
        banner_url: currentBannerUrl,
        bio: bio.trim() || null,
        department: sanitizedDepartment,
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

      <FacultyAccent department={sanitizeDepartment(department)}>
        <div
          role="presentation"
          className="bg-bg-app/90"
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
            <div className="sticky top-0 z-10 -mx-6 mb-4 flex shrink-0 items-center justify-between border-b border-border-app bg-bg-app/80 px-6 py-4 backdrop-blur-xl dark:border-white/10">
              <h2 id="profile-modal-title" className="text-lg font-extrabold text-fg-primary">
                Edytuj profil
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-fg-secondary shadow-none ring-0 transition-colors hover:bg-bg-app/70 hover:text-fg-primary dark:hover:bg-white/10"
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
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-border-app bg-bg-app/70 shadow-none ring-0 dark:border-white/10 dark:bg-bg-app">
                    <span className="text-2xl font-bold text-accent-interactive">
                      {(name || session.user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-bg-app/60 shadow-none ring-0">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-fg-primary border-t-transparent shadow-none" />
                  </div>
                )}
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 rounded-full bg-[var(--profile-accent)] p-1.5 text-white shadow-[var(--profile-glow)] ring-0 transition-transform hover:scale-110 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <p className="text-xs text-fg-secondary">Kliknij ikonę, aby zmienić zdjęcie</p>
            </div>

            <div>
              <label htmlFor="profile-name" className="mb-1.5 block font-medium text-fg-primary">
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
              <label htmlFor="profile-bio" className="mb-1.5 block font-medium text-fg-primary">
                O mnie
              </label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Napisz coś o sobie…"
                rows={3}
                maxLength={300}
                className={`${fieldInputCls} resize-none align-top`}
              />
              <p className="mt-1 text-right text-[11px] text-fg-secondary">{bio.length}/300</p>
            </div>

            <div>
              <label htmlFor="profile-department" className="mb-1.5 block font-medium text-fg-primary">
                Wydział
              </label>
              <select
                id="profile-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={fieldInputCls}
              >
                <option value="" disabled hidden>
                  {DEPARTMENT_PLACEHOLDER}
                </option>
                {UJ_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-none ring-0 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

            <div className="sticky bottom-0 -mx-6 mt-4 flex shrink-0 justify-end gap-3 border-t border-border-app bg-bg-app/80 px-6 pt-4 pb-1 backdrop-blur-xl shadow-none ring-0 dark:border-white/10">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-fg-secondary shadow-none ring-0 transition-colors hover:text-fg-primary dark:hover:text-fg-primary"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--profile-accent)] px-6 py-2.5 text-sm font-bold text-bg-app shadow-[var(--profile-glow)] ring-0 outline-none transition-opacity hover:opacity-90 disabled:opacity-70"
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
