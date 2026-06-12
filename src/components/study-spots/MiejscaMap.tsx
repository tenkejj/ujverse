/**
 * UJverse — MiejscaMap: interaktywna mapa Leaflet z markerami miejsc nauki.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * - OSM tiles (free, attribution wymagana).
 * - Markery per kind kolorowane (kolory matchują `STUDY_SPOT_KIND_META.tintClass`).
 * - Klik marker → callback `onPickSpot(spot)` (otwiera DetailModal w parencie).
 * - Aktywne live presence — pulsujący ring na markerze (przez DivIcon z keyframes).
 * - Centrum mapy: Kraków (Rynek Główny ~50.0614, 19.9342), zoom 13.
 */
import { useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { StudySpotWithUserState } from '../../types/studySpots'
import { STUDY_SPOT_KIND_META } from '../../types/studySpots'

const KRAKOW_CENTER: L.LatLngTuple = [50.0614, 19.9342]
const DEFAULT_ZOOM = 13

/** Kolory pinów per kind (heksy spójne z tintClass'ami). */
const PIN_COLORS: Record<string, string> = {
  library_uj: '#f59e0b', // amber
  library_other: '#f97316', // orange
  cafe: '#f43f5e', // rose
  coworking: '#8b5cf6', // violet
  courtyard: '#10b981', // emerald
  akademik: '#0ea5e9', // sky
  other: '#78716c', // stone
}

/** Tworzy DivIcon dla pojedynczego spotu — pin + opcjonalne pulse ring. */
function makePinIcon(kind: string, hasLive: boolean): L.DivIcon {
  const color = PIN_COLORS[kind] ?? PIN_COLORS.other
  const pulse = hasLive
    ? `<span style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:.85;animation:msp 1.6s cubic-bezier(0,0,.2,1) infinite"></span>`
    : ''
  return L.divIcon({
    className: 'mspot-pin',
    html: `<div style="position:relative;width:28px;height:36px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))">
      ${pulse}
      <svg width="28" height="36" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <path fill="${color}" stroke="#0b0f1a" stroke-width="1.4" d="M12 2C7.5 2 4 5.4 4 9.7c0 5.2 4.2 9.5 8 14.3 3.8-4.8 8-9.1 8-14.3C20 5.4 16.5 2 12 2z"/>
        <circle cx="12" cy="9.5" r="3.4" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -28],
  })
}

type Props = {
  spots: StudySpotWithUserState[]
  onPickSpot: (spot: StudySpotWithUserState) => void
  className?: string
}

export default function MiejscaMap({ spots, onPickSpot, className }: Props) {
  // Memoize markerów (icon recreate jest tani, ale w 50-spotowej liście warto).
  const markers = useMemo(
    () =>
      spots.map((s) => ({
        spot: s,
        icon: makePinIcon(s.kind, s.active_checkins_count > 0),
      })),
    [spots],
  )

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-zinc-50 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/40 dark:shadow-[0_24px_70px_-30px_rgba(0,0,0,0.85)] ${className ?? ''}`}
    >
      {/* Pulse keyframes — globalne, doczepiane raz */}
      <style>{`@keyframes msp{0%{transform:scale(.85);opacity:.85}100%{transform:scale(1.6);opacity:0}}`}</style>

      <MapContainer
        center={KRAKOW_CENTER}
        zoom={DEFAULT_ZOOM}
        className="z-0 h-[68vh] min-h-[420px] w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map(({ spot, icon }) => {
          const meta = STUDY_SPOT_KIND_META[spot.kind]
          return (
            <Marker
              key={spot.id}
              position={[spot.lat, spot.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onPickSpot(spot),
              }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    {meta.label}
                  </p>
                  <p className="text-[13px] font-bold text-zinc-900">{spot.name}</p>
                  <p className="text-[11px] text-zinc-600">{spot.address}</p>
                  <div className="flex items-center gap-3 pt-1 text-[11px]">
                    {spot.rating_avg != null && (
                      <span className="tabular-nums">
                        ⭐ {spot.rating_avg.toFixed(1)} ({spot.rating_count})
                      </span>
                    )}
                    {spot.active_checkins_count > 0 && (
                      <span className="tabular-nums text-emerald-700">
                        🟢 {spot.active_checkins_count} osób
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onPickSpot(spot)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white hover:bg-black"
                  >
                    Szczegóły →
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Legenda kolorów per kind */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200/70 bg-white/85 px-3 py-2 text-[10.5px] backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/75 sm:left-auto sm:right-3 sm:max-w-sm">
        {(Object.entries(PIN_COLORS) as Array<[keyof typeof PIN_COLORS, string]>).map(
          ([kind, color]) => (
            <span
              key={kind}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {STUDY_SPOT_KIND_META[kind as keyof typeof STUDY_SPOT_KIND_META].label}
            </span>
          ),
        )}
      </div>
    </div>
  )
}
