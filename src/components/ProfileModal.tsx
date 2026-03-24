import { useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ImagePlus, Instagram, Linkedin, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import type { Profile } from '../types'
import { UJ_DEPARTMENTS } from '../lib/departments'
import ImageCropperModal from './ImageCropperModal'

type Props = {
  session: Session
  profile: Profile | null
  onClose: () => void
  onSaved: (updated: Profile) => void
  onAvatarUpdate?: (url: string) => void
}

const inputCls =
  'w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2.5 text-[14px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-uj-blue/25 dark:focus:ring-uj-orange/25 transition-all'

export default function ProfileModal({ session, profile, onClose, onSaved, onAvatarUpdate }: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [major, setMajor] = useState(profile?.major ?? '')
  const [yearOfStudy, setYearOfStudy] = useState(profile?.year_of_study ?? '')
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url ?? '')
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
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
    const avatarUrl = currentAvatarUrl

    const { data, error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: name.trim() || null,
        avatar_url: avatarUrl,
        bio: bio.trim() || null,
        major: major.trim() || null,
        year_of_study: yearOfStudy.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
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
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <motion.div
        className="w-full max-w-lg bg-white dark:bg-dark-card rounded-3xl shadow-2xl dark:shadow-none border border-gray-100 dark:border-white/5 border-t-4 border-t-uj-blue/20 dark:border-t-uj-orange/30 flex flex-col max-h-[90vh]"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: isClosing ? 0 : 1, y: isClosing ? 20 : 0, scale: isClosing ? 0.97 : 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-blue-50">Edytuj profil</h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors text-slate-500 dark:text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 pb-2">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Awatar" className="h-24 w-24 rounded-full object-cover border-4 border-uj-blue/20" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-uj-blue/10 border-4 border-uj-blue/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-uj-blue">{(name || session.user.email || 'U').charAt(0).toUpperCase()}</span>
                </div>
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-uj-orange text-white shadow-md hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed transition-transform"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <p className="text-xs text-slate-400 dark:text-gray-500">Kliknij ikonę, aby zmienić zdjęcie</p>
          </div>

          {/* Imię */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Imię / Nazwa</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="np. Jan Kowalski" maxLength={80} className={inputCls} />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">O mnie</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Napisz coś o sobie…" rows={3} maxLength={300}
              className={`${inputCls} resize-none`} />
            <p className="text-[11px] text-slate-400 dark:text-gray-500 text-right">{bio.length}/300</p>
          </div>

          {/* Kierunek + rok */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Kierunek studiów</label>
              <input type="text" value={major} onChange={(e) => setMajor(e.target.value)}
                placeholder="np. Informatyka" maxLength={80} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Rok studiów</label>
              <input type="text" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}
                placeholder="np. 2 rok Lic." maxLength={40} className={inputCls} />
            </div>
          </div>

          {/* Wydział */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
              Wydział
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Wybierz wydział —</option>
              {UJ_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Instagram size={11} /> Instagram (URL)
            </label>
            <input type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/twojanazwa" className={inputCls} />
          </div>

          {/* LinkedIn */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Linkedin size={11} /> LinkedIn (URL)
            </label>
            <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/twojanazwa" className={inputCls} />
          </div>

          {/* Banner URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Zdjęcie w tle (Banner URL)</label>
            <input type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://… (link do obrazka)" className={inputCls} />
            {bannerUrl && (
              <img src={bannerUrl} alt="Podgląd banneru" className="w-full h-16 object-cover rounded-xl border border-slate-200 dark:border-gray-700 mt-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>

          {/* E-mail (read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">E-mail</label>
            <div className="w-full rounded-xl border border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 px-3 py-2.5 text-slate-400 dark:text-gray-500 text-[14px]">{session.user.email}</div>
          </div>

          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-gray-700 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
            Anuluj
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-uj-blue text-white text-sm font-extrabold hover:bg-uj-blue/90 transition-colors disabled:opacity-70">
            {saving ? 'Zapisuję…' : 'Zapisz profil'}
          </button>
        </div>
      </motion.div>
    </motion.div>
    </>
  )
}
