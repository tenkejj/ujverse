import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Map, X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { NewEventFormData } from '../hooks/useEvents'
import ImageCropper from './ImageCropper'
import LocationPicker from './LocationPicker'

type Props = {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: NewEventFormData) => void
}

const inputCls =
  'bg-black/20 border border-[#1c2b4e] text-white rounded-lg p-3 w-full focus:border-[#ffa000] outline-none [color-scheme:dark]'

const CATEGORIES = ['Wydarzenie', 'Wydział', 'Ogłoszenie'] as const

const fileInputCls =
  'block w-full cursor-pointer rounded-lg border border-[#1c2b4e] bg-black/20 px-3 py-2.5 text-sm text-slate-200 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#1c2b4e] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#2a3b66] focus:border-[#ffa000] focus:outline-none [color-scheme:dark]'

export default function CreateEventModal({ isOpen, onClose, onAdd }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [title, setTitle] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [category, setCategory] = useState<string>('Wydarzenie')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [mapUrl, setMapUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setDateTime('')
    setCategory('Wydarzenie')
    setLocation('')
    setDescription('')
    setMapUrl('')
    setImagePreview(null)
    setImageToCrop(null)
    setLocationPickerOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsClosing(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || imageToCrop || locationPickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, imageToCrop, locationPickerOpen, handleClose])

  const handlePosterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearPoster = () => {
    setImagePreview(null)
    setImageToCrop(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dateTime.trim() || !location.trim()) return
    const map = mapUrl.trim()
    onAdd({
      title: title.trim(),
      date: dateTime,
      category,
      location: location.trim(),
      description: description.trim(),
      ...(imagePreview ? { imageUrl: imagePreview } : {}),
      ...(map ? { mapUrl: map } : {}),
    })
    handleClose()
  }

  if (!isOpen) return null

  return createPortal(
    <>
      <ImageCropper
        imageSrc={imageToCrop}
        onClose={() => {
          setImageToCrop(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
        onCropped={(base64) => {
          setImagePreview(base64)
          setImageToCrop(null)
        }}
      />

      <LocationPicker
        isOpen={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onConfirm={({ mapUrl: url, locationLabel }) => {
          setLocation(locationLabel)
          setMapUrl(url)
        }}
      />

      <motion.div
        role="presentation"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.18 }}
        onClick={(ev) => ev.stopPropagation()}
        onPointerDown={(ev) => {
          if (ev.target === ev.currentTarget) handleClose()
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
          className="w-full max-w-lg rounded-2xl border border-[#1c2b4e] bg-[#040521] p-6 relative overflow-hidden shadow-none [color-scheme:dark]"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{
            opacity: isClosing ? 0 : 1,
            y: isClosing ? 8 : 0,
            scale: isClosing ? 0.97 : 1,
          }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(ev) => ev.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Zamknij"
          >
            <X size={20} strokeWidth={2} />
          </button>

          <h2 id="create-event-title" className="text-xl font-bold text-white mb-6 pr-10">
            Nowe wydarzenie
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ce-title" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Tytuł
              </label>
              <input
                id="ce-title"
                type="text"
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="ce-datetime" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Data i czas
              </label>
              <input
                id="ce-datetime"
                type="datetime-local"
                value={dateTime}
                onChange={(ev) => setDateTime(ev.target.value)}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label htmlFor="ce-category" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Kategoria
              </label>
              <select
                id="ce-category"
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-[#040521]">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 mb-1.5" id="ce-location-label">
                Lokalizacja
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                <input
                  id="ce-location"
                  type="text"
                  value={location}
                  onChange={(ev) => setLocation(ev.target.value)}
                  className={`${inputCls} flex-1 min-w-0`}
                  required
                  aria-labelledby="ce-location-label"
                />
                <button
                  type="button"
                  onClick={() => setLocationPickerOpen(true)}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-[#ffa000] px-3 py-2.5 text-sm font-semibold text-[#ffa000] hover:bg-[#ffa000]/10 transition-colors"
                >
                  <Map size={18} strokeWidth={2} aria-hidden />
                  Wybierz na mapie
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="ce-poster" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Plakat (opcjonalnie, JPEG / PNG / WebP)
              </label>
              <input
                ref={fileInputRef}
                id="ce-poster"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePosterChange}
                className={fileInputCls}
              />
              {imagePreview ? (
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={clearPoster}
                    className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/80 border border-[#1c2b4e] transition-colors"
                    aria-label="Usuń plakat"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                  <img
                    src={imagePreview}
                    alt=""
                    className="h-24 w-full object-cover rounded-lg border border-[#1c2b4e]"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="ce-desc" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Opis
              </label>
              <textarea
                id="ce-desc"
                rows={4}
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                className={`${inputCls} resize-y min-h-[100px]`}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 bg-transparent transition-colors font-medium"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="flex-1 min-w-[160px] py-3 rounded-xl bg-[#ffa000] text-black font-bold hover:bg-[#e69000] transition-colors"
              >
                Utwórz wydarzenie
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </>,
    document.body,
  )
}
