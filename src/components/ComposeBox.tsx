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
  /** Mobilna szuflada: nieprzezroczyste tło rodzica — karta compose bez własnego „szkła”. */
  sheetMode?: boolean
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
  sheetMode = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isComposing) setTimeout(() => textareaRef.current?.focus(), 400)
  }, [isComposing])

  const bodyLen = body.length
  const ringProgress = Math.min(bodyLen / BODY_MAX, 1)
  const ringDash = RING_CIRCUMFERENCE * ringProgress

  const rootCls = sheetMode
    ? 'overflow-hidden rounded-none border-0 bg-transparent shadow-none'
    : `bg-card dark:bg-bg-app rounded-2xl border border-[#0f172a]/5 transition-[border-color,box-shadow] duration-200 overflow-hidden shadow-sm dark:border-white/10 ${
        isComposing
          ? 'border-[#0f172a]/12 shadow-[0_0_0_1px_rgb(164_137_85/0.12),0_2px_10px_-2px_rgb(15_23_42/0.06)] dark:border-white/10 dark:shadow-[inset_0_0_0_1px_rgb(201_162_39/0.15),0_8px_32px_-12px_rgb(0_0_0/0.45)]'
          : 'dark:shadow-lg dark:shadow-black/20'
      }`

  const innerPad = sheetMode ? 'p-3 sm:p-4' : 'p-4'

  return (
    <div className={rootCls}>
      <div className={`${innerPad} flex gap-3 items-start`}>

        <div className="flex flex-col items-center shrink-0">
          <UserAvatar profile={myProfile} name={displayName} className="h-10 w-10" textSize="text-sm" />
        </div>

        <div className="flex-1 min-w-0">
          {!isComposing ? (
            <div className="rounded-xl bg-card px-3 py-2 -mx-0.5 ring-1 ring-[#0f172a]/[0.04] dark:bg-transparent dark:ring-0">
              <button
                type="button"
                onClick={() => { onOpen() }}
                className="w-full text-left text-fg-secondary dark:text-gray-500 text-[15px] py-2 hover:text-fg-primary/90 dark:hover:text-gray-400 transition-colors"
              >
                Co słychać na uczelni?
              </button>
            </div>
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
                className={`w-full min-h-[80px] resize-none rounded-xl px-3 py-2.5 text-[15px] leading-relaxed focus:outline-none ${
                  sheetMode
                    ? 'border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-300/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-brand-gold/30'
                    : 'bg-card text-fg-primary placeholder:text-fg-secondary ring-1 ring-inset ring-[#0f172a]/[0.05] focus:ring-2 focus:ring-[#0f172a]/[0.08] dark:bg-transparent dark:ring-1 dark:ring-inset dark:ring-white/10 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-2 dark:focus:ring-brand-gold/25'
                }`}
              />

              {/* Image preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Podgląd"
                    className="max-h-56 rounded-xl border border-[#0f172a]/10 dark:border-white/10 object-cover"
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
              <div
                className={`mt-1 flex flex-nowrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-white/10 ${
                  sheetMode ? 'pb-1' : 'pt-2'
                }`}
              >
                <div className="flex shrink-0 items-center gap-0.5">
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
                    className="p-2 rounded-full text-[#0f172a] hover:text-[#8a6d3b] dark:text-brand-gold/60 dark:hover:text-brand-gold transition-colors"
                    title="Dodaj zdjęcie"
                  >
                    <ImagePlus size={18} />
                  </button>
                </div>

                <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
                  {/* Character ring */}
                  <div className="relative h-6 w-6" title={`${BODY_MAX - bodyLen} znaków`}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        strokeWidth="2.5"
                        className="stroke-[#0f172a]/15 dark:stroke-brand-gold/25"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        stroke={
                          ringProgress > 0.9
                            ? '#ef4444'
                            : ringProgress > 0.7
                              ? '#f59e0b'
                              : undefined
                        }
                        className={
                          ringProgress > 0.9 || ringProgress > 0.7
                            ? 'transition-all duration-100'
                            : 'stroke-[#0f172a] dark:stroke-brand-gold transition-all duration-100'
                        }
                        strokeDasharray={`${ringDash} ${RING_CIRCUMFERENCE}`}
                      />
                    </svg>
                    {ringProgress > 0.8 && (
                      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${ringProgress > 0.9 ? 'text-red-500' : 'text-slate-500'}`}>
                        {BODY_MAX - bodyLen}
                      </span>
                    )}
                  </div>

                  <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />

                  <button
                    type="button"
                    onClick={onReset}
                    className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-[#0f172a] transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    Anuluj
                  </button>
                  <motion.button
                    type="button"
                    onClick={onSubmit}
                    disabled={isLoading || !body.trim()}
                    whileTap={{ scale: 0.98 }}
                    className="whitespace-nowrap rounded-full bg-[#0f172a] px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-brand-gold-bright dark:text-zinc-900 dark:shadow-none"
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
