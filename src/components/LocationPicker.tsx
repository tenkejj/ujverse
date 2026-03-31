import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'

/** Kampus UJ — okolice Collegium Novum */
const DEFAULT_CENTER: L.LatLngTuple = [50.0614, 19.9342]
const DEFAULT_ZOOM = 16

type LatLng = { lat: number; lng: number }

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Wybrane miejsce + link Google Maps + tekst do pola lokalizacji */
  onConfirm: (payload: { lat: number; lng: number; mapUrl: string; locationLabel: string }) => void
}

const GOLD_ICON = L.divIcon({
  className: 'gold-pin-icon',
  html: `<div aria-hidden="true" style="width:32px;height:32px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))">
    <svg width="28" height="36" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path fill="#ffa000" stroke="#040521" stroke-width="1.25" d="M12 2C7.5 2 4 5.4 4 9.7c0 5.2 4.2 9.5 8 14.3 3.8-4.8 8-9.1 8-14.3C20 5.4 16.5 2 12 2z"/>
      <circle cx="12" cy="9.5" r="3.2" fill="#040521"/>
    </svg>
  </div>`,
  iconSize: [32, 36],
  iconAnchor: [16, 34],
})

function googleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      'accept-language': 'pl',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    return data.display_name?.trim() ?? null
  } catch {
    return null
  }
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationPicker({ isOpen, onClose, onConfirm }: Props) {
  const [marker, setMarker] = useState<LatLng | null>(null)
  const [label, setLabel] = useState('')
  const [geocodeLoading, setGeocodeLoading] = useState(false)

  const mapKey = useMemo(() => (isOpen ? `map-${Date.now()}` : 'closed'), [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setMarker(null)
      setLabel('')
      setGeocodeLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setMarker({ lat, lng })
    setGeocodeLoading(true)
    setLabel('')
    void reverseGeocode(lat, lng).then((name) => {
      setGeocodeLoading(false)
      if (name) setLabel(name)
      else setLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    })
  }, [])

  const handleConfirm = () => {
    if (!marker) return
    const { lat, lng } = marker
    onConfirm({
      lat,
      lng,
      mapUrl: googleMapsSearchUrl(lat, lng),
      locationLabel: label.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    })
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <motion.div
      role="presentation"
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/85 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onPointerDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        className="w-full max-w-lg rounded-2xl border border-border-app bg-card p-5 shadow-none relative overflow-hidden"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[500] p-2 rounded-full text-white bg-black/50 hover:bg-black/65 transition-colors"
          aria-label="Zamknij"
        >
          <X size={20} strokeWidth={2} />
        </button>

        <h2 id="location-picker-title" className="text-lg font-bold text-fg-primary mb-1 pr-12">
          Wybierz miejsce na mapie
        </h2>
        <p className="text-xs text-text-label mb-3">
          Kliknij mapę, by postawić pinezkę. Adres uzupełni się automatycznie (OpenStreetMap Nominatim).
        </p>

        <div className="rounded-xl overflow-hidden border border-border-app bg-slate-100 dark:bg-[#0a0f2a]">
          <MapContainer
            key={mapKey}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className="z-0 h-[min(45vh,280px)] w-full rounded-lg"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={handleMapClick} />
            {marker ? <Marker position={[marker.lat, marker.lng]} icon={GOLD_ICON} /> : null}
          </MapContainer>
        </div>

        <div className="mt-3 min-h-[2.5rem] text-sm text-slate-300">
          {geocodeLoading ? (
            <span className="text-slate-500">Szukam adresu…</span>
          ) : marker ? (
            <span className="line-clamp-3">{label || 'Kliknij mapę ponownie lub zatwierdź współrzędne.'}</span>
          ) : (
            <span className="text-slate-500">Kliknij w mapę, aby wybrać punkt.</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-fg-primary transition-colors font-medium dark:text-slate-400 dark:hover:text-white"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={!marker}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-[#ffa000] text-black font-bold hover:bg-[#e69000] disabled:opacity-45 disabled:pointer-events-none transition-colors"
          >
            Zatwierdź lokalizację
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
