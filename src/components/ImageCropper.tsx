import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Cropper, { type Area, type Point } from 'react-easy-crop'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { getCroppedImageAsJpegBase64 } from '../lib/cropImage'

const ASPECT = 16 / 9

type Props = {
  imageSrc: string | null
  onClose: () => void
  onCropped: (base64DataUrl: string) => void
}

export default function ImageCropper({ imageSrc, onClose, onCropped }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!imageSrc) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setBusy(false)
  }, [imageSrc])

  useEffect(() => {
    if (!imageSrc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imageSrc, onClose])

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const base64 = await getCroppedImageAsJpegBase64(imageSrc, croppedAreaPixels)
      onCropped(base64)
      onClose()
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  if (!imageSrc) return null

  return createPortal(
    <motion.div
      role="presentation"
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/85 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-[#1c2b4e] bg-white dark:bg-[#040521] p-5 shadow-none relative"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-white bg-black/50 hover:bg-black/65 transition-colors"
          aria-label="Zamknij"
        >
          <X size={20} strokeWidth={2} />
        </button>

        <h2 id="image-cropper-title" className="text-lg font-bold text-slate-900 dark:text-white mb-3 pr-12">
          Przytnij plakat (16:9)
        </h2>

        <div className="relative h-[min(50vh,320px)] w-full rounded-xl overflow-hidden border border-border-app bg-slate-100 dark:bg-black/40">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            objectFit="contain"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex-1 min-w-[160px] flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <span className="shrink-0">Powiększenie</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#ffa000] h-2"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-fg-primary transition-colors font-medium dark:text-slate-400 dark:hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={busy || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
            className="px-5 py-2.5 rounded-xl bg-[#ffa000] text-black font-bold hover:bg-[#e69000] disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {busy ? 'Przetwarzanie…' : 'Zatwierdź kadr'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
