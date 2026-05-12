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
import type { UJEvent } from '../data/mockEvents'
import type { NewEventFormData } from '../hooks/useEvents'
import ImageCropper from './ImageCropper'
import LocationPicker from './LocationPicker'

function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onAdd: (data: NewEventFormData) => void
  editEvent?: UJEvent | null
  onUpdate?: (id: string, patch: Partial<UJEvent>) => void
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-100 p-3 text-gray-900 outline-none placeholder:text-gray-500 focus:border-gray-300 dark:border-border-app dark:bg-bg-card dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-white/15'

const CATEGORIES = ['Wydarzenie', 'Wydział', 'Ogłoszenie'] as const

const fileInputCls =
  'block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-900 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-300 focus:border-gray-300 focus:outline-none dark:border-border-app dark:bg-bg-card dark:text-zinc-100 dark:file:bg-white/10 dark:file:text-zinc-100 dark:hover:file:bg-white/15 dark:focus:border-white/15'

export default function CreateEventModal({
  isOpen,
  onClose,
  onAdd,
  editEvent = null,
  onUpdate,
}: Props) {
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
  const [posterWasRemoved, setPosterWasRemoved] = useState(false)

  const isEdit = Boolean(editEvent)

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    setIsClosing(false)
    setImageToCrop(null)
    setLocationPickerOpen(false)
    setPosterWasRemoved(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (editEvent) {
      setTitle(editEvent.title)
      setDateTime(toDateTimeLocalValue(editEvent.date))
      setCategory(editEvent.category)
      setLocation(editEvent.location)
      setDescription(editEvent.description)
      setMapUrl(editEvent.mapUrl ?? '')
      setImagePreview(editEvent.imageUrl ?? null)
    } else {
      setTitle('')
      setDateTime('')
      setCategory('Wydarzenie')
      setLocation('')
      setDescription('')
      setMapUrl('')
      setImagePreview(null)
    }
  }, [isOpen, editEvent?.id])

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
    setPosterWasRemoved(false)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const clearPoster = () => {
    setImagePreview(null)
    setImageToCrop(null)
    setPosterWasRemoved(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dateTime.trim() || !location.trim()) return

    if (isEdit && editEvent && onUpdate) {
      const nextDate = new Date(dateTime)
      if (Number.isNaN(nextDate.getTime())) return

      const patch: Partial<UJEvent> = {
        title: title.trim(),
        date: nextDate,
        category,
        location: location.trim(),
        description: description.trim(),
      }
      const map = mapUrl.trim()
      if (map) patch.mapUrl = map
      else patch.mapUrl = undefined

      if (imagePreview) patch.imageUrl = imagePreview
      else if (posterWasRemoved) patch.imageUrl = undefined

      onUpdate(editEvent.id, patch)
      handleClose()
      return
    }

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
          setPosterWasRemoved(false)
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
        aria-hidden
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.18 }}
        onPointerDown={(ev) => {
          if (ev.target === ev.currentTarget) handleClose()
        }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-title"
        className="fixed left-1/2 top-1/2 z-110 max-h-[90vh] w-[95%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-app bg-bg-card p-6 shadow-uj-soft dark:shadow-none"
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
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-fg-primary transition-colors dark:text-slate-400 dark:hover:text-white"
            aria-label="Zamknij"
          >
            <X size={20} strokeWidth={2} />
          </button>

          <h2 id="create-event-title" className="text-xl font-bold text-slate-900 dark:text-white mb-6 pr-10">
            {isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ce-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
              <label htmlFor="ce-datetime" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
              <label htmlFor="ce-category" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kategoria
              </label>
              <select
                id="ce-category"
                value={category}
                onChange={(ev) => setCategory(ev.target.value)}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5" id="ce-location-label">
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
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-uj-gold px-3 py-2.5 text-sm font-semibold text-uj-gold transition-colors hover:bg-uj-gold/10 dark:text-brand-gold-bright dark:border-brand-gold-bright"
                >
                  <Map size={18} strokeWidth={2} aria-hidden />
                  Wybierz na mapie
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="ce-poster" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border-app bg-black/50 text-white transition-colors hover:bg-black/70 dark:bg-black/65"
                    aria-label="Usuń plakat"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                  <img
                    src={imagePreview}
                    alt=""
                    className="h-24 w-full rounded-xl border border-border-app object-cover"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="ce-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-gray-500 transition-colors hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="min-h-[44px] min-w-[160px] flex-1 rounded-xl bg-uj-gold px-4 text-sm font-semibold text-black transition-colors hover:bg-uj-gold/90 dark:bg-brand-gold dark:hover:bg-brand-gold/85"
              >
                {isEdit ? 'Zapisz zmiany' : 'Utwórz wydarzenie'}
              </button>
            </div>
          </form>
      </motion.div>
    </>,
    document.body,
  )
}
