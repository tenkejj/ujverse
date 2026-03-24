import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { X, Check } from 'lucide-react'
import { motion } from 'framer-motion'

type Props = {
  imageSrc: string
  onCancel: () => void
  onSave: (croppedBlob: Blob) => void
  aspect?: number
  cropShape?: 'rect' | 'round'
  title?: string
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.src = imageSrc
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Nie udało się załadować obrazu'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Brak kontekstu canvas')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas jest pusty'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

export default function ImageCropperModal({
  imageSrc,
  onCancel,
  onSave,
  aspect = 3 / 1,
  cropShape = 'rect',
  title = 'Kadruj zdjęcie tła',
}: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleCancel = () => {
    setIsClosing(true)
    setTimeout(onCancel, 220)
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  async function handleSave() {
    if (!croppedAreaPixels) return
    setIsSaving(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onSave(blob)
    } catch (err) {
      console.error('Błąd kadrowania:', err)
      setIsSaving(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-black/60">
        <h2 className="text-white font-bold text-base">{title}</h2>
        <p className="text-xs text-gray-400">Przeciągnij i przybliż, aby dobrać kadr</p>
      </div>

      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={false}
          style={{
            containerStyle: { background: '#000' },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-6 py-4 bg-black/60">
        <span className="text-xs text-gray-400 w-14 text-right">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-uj-blue h-1.5 rounded-full"
        />
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 bg-black/60 border-t border-white/10">
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-gray-600 text-gray-300 text-sm font-semibold hover:bg-white/10 transition-all"
        >
          <X size={14} />
          Anuluj
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !croppedAreaPixels}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-uj-blue text-white text-sm font-semibold hover:bg-uj-blue/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
        >
          <Check size={14} />
          {isSaving ? 'Zapisywanie…' : 'Zapisz kadrowanie'}
        </button>
      </div>
    </motion.div>
  )
}
