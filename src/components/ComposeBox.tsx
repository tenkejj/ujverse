import { useRef, useEffect } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Profile } from '../types'
import UserAvatar from './UserAvatar'

const BODY_MAX = 1000
const RING_CIRCUMFERENCE = 2 * Math.PI * 10

type Props = {
  myProfile: Profile | null
  displayName: string
  isComposing: boolean
  body: string
  imageFile: File | null
  imagePreview: string | null
  isLoading: boolean
  error: string | null
  onBodyChange: (value: string) => void
  onImageFileChange: (file: File | null) => void
  onOpen: () => void
  onReset: () => void
  onSubmit: () => void
}

export default function ComposeBox({
  myProfile,
  displayName,
  isComposing,
  body,
  imageFile: _imageFile,
  imagePreview,
  isLoading,
  error,
  onBodyChange,
  onImageFileChange,
  onOpen,
  onReset,
  onSubmit,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isComposing) setTimeout(() => textareaRef.current?.focus(), 400)
  }, [isComposing])

  const bodyLen = body.length
  const ringProgress = Math.min(bodyLen / BODY_MAX, 1)
  const ringDash = RING_CIRCUMFERENCE * ringProgress

  return (
    <div
      className={`bg-slate-50 dark:bg-bg-card rounded-2xl border border-t-2 border-t-uj-blue/10 dark:border-t-uj-orange/20 transition-all duration-200 overflow-hidden ${
        isComposing
          ? 'border-uj-blue/30 dark:border-border-app dark:border-t-uj-orange/20 shadow-[0_0_0_3px_rgba(0,51,153,0.06),0_1px_8px_rgba(0,51,153,0.08)]'
          : 'border-slate-200/60 dark:border-border-app shadow-uj-soft dark:shadow-lg dark:shadow-black/20'
      }`}
    >
      <div className="p-4 flex gap-3 items-start">

        {/* Avatar + thread line */}
        <div className="flex flex-col items-center shrink-0">
          <UserAvatar profile={myProfile} name={displayName} className="h-10 w-10" textSize="text-sm" />
          {isComposing && (
            <div className="w-px flex-1 mt-2 bg-gradient-to-b from-uj-blue/20 to-transparent min-h-[8px]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {!isComposing ? (
            <button
              type="button"
              onClick={() => { onOpen() }}
              className="w-full text-left text-slate-400 dark:text-gray-500 text-[15px] py-2.5 hover:text-slate-500 dark:hover:text-gray-400 transition-colors"
            >
              Co słychać na uczelni?
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => {
                  onBodyChange(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                placeholder="Co słychać na uczelni?"
                rows={3}
                maxLength={BODY_MAX}
                className="w-full bg-transparent resize-none text-[15px] text-slate-900 dark:text-blue-50 placeholder-slate-500 dark:placeholder-gray-600 leading-relaxed focus:outline-none min-h-[80px]"
              />

              {/* Image preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Podgląd"
                    className="max-h-56 rounded-xl border border-slate-200 dark:border-gray-700 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onImageFileChange(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
              )}

              {/* Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-700">
                <div className="flex items-center gap-0.5">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onImageFileChange(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="p-2 rounded-full text-uj-blue/50 hover:text-uj-blue hover:bg-uj-blue/8 transition-all"
                    title="Dodaj zdjęcie"
                  >
                    <ImagePlus size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {/* Character ring */}
                  <div className="relative h-6 w-6" title={`${BODY_MAX - bodyLen} znaków`}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                      <circle
                        cx="12" cy="12" r="10" fill="none" strokeWidth="2.5"
                        strokeLinecap="round"
                        stroke={ringProgress > 0.9 ? '#ef4444' : ringProgress > 0.7 ? '#f59e0b' : '#002147'}
                        strokeDasharray={`${ringDash} ${RING_CIRCUMFERENCE}`}
                        className="transition-all duration-100"
                      />
                    </svg>
                    {ringProgress > 0.8 && (
                      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${ringProgress > 0.9 ? 'text-red-500' : 'text-slate-500'}`}>
                        {BODY_MAX - bodyLen}
                      </span>
                    )}
                  </div>

                  <div className="h-4 w-px bg-slate-200 dark:bg-gray-700" />

                  <button
                    type="button"
                    onClick={onReset}
                    className="text-sm text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Anuluj
                  </button>
                  <motion.button
                    type="button"
                    onClick={onSubmit}
                    disabled={isLoading || !body.trim()}
                    whileTap={{ scale: 0.94 }}
                    className="px-5 py-1.5 rounded-full bg-uj-blue text-white text-sm font-bold hover:bg-uj-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {isLoading ? 'Publikuję…' : 'Opublikuj'}
                  </motion.button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
