import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Marker,
  NavigationControl,
  Source,
} from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useTheme } from '../../ThemeContext'
import {
  buildOsmBuildingsLayer,
  buildSkySpec,
  buildUjBuildingsLabelLayer,
  buildUjBuildingsLayer,
  buildUjBuildingsOutlineLayer,
  mapStyleUrl,
  UJ_BUILDINGS_LABEL_LAYER_ID,
  UJ_BUILDINGS_LAYER_ID,
  UJ_BUILDINGS_OUTLINE_LAYER_ID,
  UJ_BUILDINGS_SOURCE_ID,
} from './BuildingExtrusionsLayer'
import type { Building } from '../../services/SaleFinderService'
import { loadFootprintCollection, type FootprintFeatureCollection } from '../../services/Campus3DService'

/**
 * MapLibreCanvas — wrapper na MapLibre GL JS przez `react-map-gl/maplibre` v8.
 *
 * Responsibilities:
 *   - Render mapy z theme-aware style (positron light / dark).
 *   - Ładuje footprints UJ z `/uj-footprints/*.geojson` i wystawia jako
 *     GeoJSON source. Footprints są pobrane raz (równolegle) per mount;
 *     UI nie blokuje się dopóki nie przyjdą (mapa rysuje się od razu z OSM).
 *   - Dodaje trzy warstwy:
 *       1. `osm-buildings-3d` — generyczne OSM extrusions z openmaptiles
 *          source (warstwa wbudowanego stylu, my tylko dorzucamy 3D effect).
 *       2. `uj-buildings-3d` — gold extrusions z naszych footprintów.
 *       3. `uj-buildings-outline` — line outline dla widoczności z dystansu.
 *   - Pin marker dla budynków UJ które NIE mają footprintu (jeszcze nie
 *     zescrapowane / nie istnieją w OSM) — fallback do lat/lng centroidu.
 *   - Hover/click highlights przez `setFeatureState`.
 *   - Camera flyTo gdy zmienia się `selectedBuildingId` z zewnątrz.
 *
 * Props są declarative (lift state up) — `useCampus3D` posiada stan,
 * Canvas tylko renderuje + emituje eventy.
 */

const KRAKOW_CENTER: { lng: number; lat: number } = { lng: 19.9337, lat: 50.0614 }
const DEFAULT_VIEW_STATE = {
  longitude: KRAKOW_CENTER.lng,
  latitude: KRAKOW_CENTER.lat,
  zoom: 14.5,
  pitch: 55,
  bearing: -17,
}

type Props = {
  buildings: Building[]
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  onSelectBuilding: (id: string | null) => void
  onHoverBuilding: (id: string | null) => void
}

export default function MapLibreCanvas({
  buildings,
  selectedBuildingId,
  hoveredBuildingId,
  onSelectBuilding,
  onHoverBuilding,
}: Props) {
  const { theme } = useTheme()
  const mapRef = useRef<MapRef | null>(null)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const [footprintFC, setFootprintFC] = useState<FootprintFeatureCollection>({
    type: 'FeatureCollection',
    features: [],
  })

  // ── Lazy load footprints once buildings list arrives ─────────────────
  useEffect(() => {
    if (buildings.length === 0) return
    let cancelled = false
    void loadFootprintCollection(buildings).then((fc) => {
      if (cancelled) return
      setFootprintFC(fc)
    })
    return () => {
      cancelled = true
    }
  }, [buildings])

  // ── Building lookup ──────────────────────────────────────────────────
  const buildingById = useMemo(
    () => new Map(buildings.map((b) => [b.id, b])),
    [buildings],
  )

  // Wzbogać footprinty o `short_name` z DB-listy budynków — potrzebne
  // dla label layera (`text-field: ['get','short_name']`). Footprint
  // GeoJSON pliki mają tylko OSM `name`, który nie jest skrócony.
  const enrichedFootprintFC = useMemo<FootprintFeatureCollection>(() => {
    if (footprintFC.features.length === 0) return footprintFC
    const features = footprintFC.features.map((f) => {
      const b = buildingById.get(f.properties.building_id)
      if (!b) return f
      return {
        ...f,
        properties: {
          ...f.properties,
          short_name: b.short_name ?? null,
          full_name: b.name,
        },
      }
    })
    return { type: 'FeatureCollection', features }
  }, [footprintFC, buildingById])

  // Zestaw building.id które mają footprint w MapLibre — pozostałe rysujemy
  // jako Marker pin (fallback). Set bo lookup w renderze.
  const footprintIds = useMemo(
    () => new Set(enrichedFootprintFC.features.map((f) => f.properties.building_id)),
    [enrichedFootprintFC],
  )

  // ── Style URL ────────────────────────────────────────────────────────
  const styleUrl = useMemo(() => mapStyleUrl(theme), [theme])

  // ── On style load — dodaj sky settings (sky/fog gradient) ────────────
  const handleStyleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      const sky = buildSkySpec(theme)
      // setSky jest dostępne dopiero gdy styl jest załadowany — try/catch
      // bo niektóre wersje stylu OpenFreeMap mogą nie mieć ATM support.
      map.setSky?.(sky)
    } catch (err) {
      console.warn('[Campus3D] setSky failed:', err)
    }
    setStyleLoaded(true)
  }, [theme])

  // Reset styleLoaded gdy zmienia się styl (theme switch).
  useEffect(() => {
    setStyleLoaded(false)
  }, [styleUrl])

  // ── Feature state — hover / selected — synchronizuj z props ───────────
  // Trzymamy ostatnio ustawione id w ref żeby clear FS na poprzednim.
  const lastHoverRef = useRef<string | null>(null)
  const lastSelectedRef = useRef<string | null>(null)

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !styleLoaded) return

    if (lastHoverRef.current && lastHoverRef.current !== hoveredBuildingId) {
      map.setFeatureState(
        { source: UJ_BUILDINGS_SOURCE_ID, id: lastHoverRef.current },
        { hover: false },
      )
    }
    if (hoveredBuildingId) {
      map.setFeatureState(
        { source: UJ_BUILDINGS_SOURCE_ID, id: hoveredBuildingId },
        { hover: true },
      )
    }
    lastHoverRef.current = hoveredBuildingId
  }, [hoveredBuildingId, styleLoaded, footprintFC])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !styleLoaded) return

    if (lastSelectedRef.current && lastSelectedRef.current !== selectedBuildingId) {
      map.setFeatureState(
        { source: UJ_BUILDINGS_SOURCE_ID, id: lastSelectedRef.current },
        { selected: false },
      )
    }
    if (selectedBuildingId) {
      map.setFeatureState(
        { source: UJ_BUILDINGS_SOURCE_ID, id: selectedBuildingId },
        { selected: true },
      )
    }
    lastSelectedRef.current = selectedBuildingId
  }, [selectedBuildingId, styleLoaded, footprintFC])

  // ── flyTo on selection change ────────────────────────────────────────
  // Gdy mamy footprint — używamy `fitBounds` z bbox polygonu (kamera
  // dopasowana do realnego rozmiaru budynku). Bez footprintu fallback
  // do flyTo na lat/lng z fixed zoom.
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (selectedBuildingId === null) {
      map.flyTo({
        center: [KRAKOW_CENTER.lng, KRAKOW_CENTER.lat],
        zoom: 14.5,
        pitch: 55,
        bearing: -17,
        duration: 900,
        essential: true,
      })
      return
    }
    const b = buildingById.get(selectedBuildingId)
    if (!b) return

    const footprint = enrichedFootprintFC.features.find(
      (f) => f.properties.building_id === selectedBuildingId,
    )
    if (footprint) {
      // Wyznacz bbox z wszystkich koordynatów polygonu.
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const ring of footprint.geometry.coordinates) {
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng
          if (lat < minLat) minLat = lat
          if (lng > maxLng) maxLng = lng
          if (lat > maxLat) maxLat = lat
        }
      }
      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        {
          padding: { top: 120, bottom: 220, left: 60, right: 60 },
          pitch: 60,
          bearing: -17,
          duration: 1100,
          maxZoom: 19,
          essential: true,
        },
      )
      return
    }

    map.flyTo({
      center: [b.lng, b.lat],
      zoom: 18,
      pitch: 60,
      bearing: -17,
      duration: 1100,
      essential: true,
    })
  }, [selectedBuildingId, buildingById, enrichedFootprintFC])

  // ── Mouse events ─────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature && typeof feature.id === 'string') {
        onHoverBuilding(feature.id)
        e.target.getCanvas().style.cursor = 'pointer'
      } else {
        if (hoveredBuildingId !== null) onHoverBuilding(null)
        e.target.getCanvas().style.cursor = ''
      }
    },
    [hoveredBuildingId, onHoverBuilding],
  )

  const handleMouseLeave = useCallback(() => {
    if (hoveredBuildingId !== null) onHoverBuilding(null)
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = ''
  }, [hoveredBuildingId, onHoverBuilding])

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature && typeof feature.id === 'string') {
        onSelectBuilding(feature.id)
        return
      }
      // Click w puste miejsce → zwiń selekcję.
      if (selectedBuildingId !== null) onSelectBuilding(null)
    },
    [onSelectBuilding, selectedBuildingId],
  )

  // ── Layers (declarative) ─────────────────────────────────────────────
  const osmLayer = useMemo(() => buildOsmBuildingsLayer(theme), [theme])
  const ujLayer = useMemo(() => buildUjBuildingsLayer(theme), [theme])
  const ujOutlineLayer = useMemo(() => buildUjBuildingsOutlineLayer(theme), [theme])
  const ujLabelLayer = useMemo(() => buildUjBuildingsLabelLayer(theme), [theme])

  return (
    <MapGL
      ref={mapRef}
      mapLib={maplibregl}
      initialViewState={DEFAULT_VIEW_STATE}
      mapStyle={styleUrl}
      maxZoom={20}
      minZoom={11}
      style={{ width: '100%', height: '100%' }}
      attributionControl={{ compact: true }}
      onLoad={handleStyleLoad}
      onStyleData={handleStyleLoad}
      interactiveLayerIds={styleLoaded ? [UJ_BUILDINGS_LAYER_ID] : []}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <NavigationControl position="bottom-right" showCompass visualizePitch />

      {/* OSM buildings extrusion — używa istniejącego źródła `openmaptiles`
          z OpenFreeMap style. beforeId nie ustawiony — MapLibre wstawi na
          końcu, ale przed naszymi UJ layerami które dodajemy potem. */}
      {styleLoaded && <Layer {...osmLayer} />}

      {/* UJ buildings overlay — własny GeoJSON source z footprintów. */}
      {styleLoaded && enrichedFootprintFC.features.length > 0 && (
        <Source
          id={UJ_BUILDINGS_SOURCE_ID}
          type="geojson"
          data={enrichedFootprintFC}
          promoteId="building_id"
        >
          <Layer
            {...ujOutlineLayer}
            id={UJ_BUILDINGS_OUTLINE_LAYER_ID}
          />
          <Layer
            {...ujLayer}
            id={UJ_BUILDINGS_LAYER_ID}
          />
          <Layer
            {...ujLabelLayer}
            id={UJ_BUILDINGS_LABEL_LAYER_ID}
          />
        </Source>
      )}

      {/* Fallback markery dla budynków BEZ footprintu (jeszcze nie
          zescrapowanych z OSM) — pin marker na lat/lng centroidu. */}
      {buildings
        .filter((b) => !footprintIds.has(b.id))
        .map((b) => (
          <Marker
            key={b.id}
            longitude={b.lng}
            latitude={b.lat}
            anchor="bottom"
            onClick={(e) => {
              // Stop propagation żeby nie odpalić "click na pustym miejscu"
              // który by deselectował budynek.
              e.originalEvent.stopPropagation()
              onSelectBuilding(b.id)
            }}
          >
            <PinMarker
              theme={theme}
              isSelected={selectedBuildingId === b.id}
              isHovered={hoveredBuildingId === b.id}
              label={b.short_name ?? null}
              onMouseEnter={() => onHoverBuilding(b.id)}
              onMouseLeave={() => onHoverBuilding(null)}
            />
          </Marker>
        ))}
    </MapGL>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Pin marker — używany dla budynków bez OSM footprintu (fallback).
// Inline SVG w divIcon-style — wraz z theme/state colors.
// ─────────────────────────────────────────────────────────────────────

function PinMarker({
  theme,
  isSelected,
  isHovered,
  label,
  onMouseEnter,
  onMouseLeave,
}: {
  theme: 'light' | 'dark'
  isSelected: boolean
  isHovered: boolean
  label: string | null
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const color = isSelected
    ? theme === 'dark' ? '#ffe88a' : '#0f172a'
    : isHovered
    ? theme === 'dark' ? '#f4d96b' : '#334155'
    : theme === 'dark' ? '#e8c84a' : '#1e293b'

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex flex-col items-center cursor-pointer select-none"
      style={{
        filter: `drop-shadow(0 2px 4px rgba(0,0,0,${isSelected ? 0.6 : 0.4}))`,
      }}
    >
      <svg width="28" height="36" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <path
          fill={color}
          stroke="#fff"
          strokeWidth="1.25"
          d="M12 2C7.5 2 4 5.4 4 9.7c0 5.2 4.2 9.5 8 14.3 3.8-4.8 8-9.1 8-14.3C20 5.4 16.5 2 12 2z"
        />
        <circle cx="12" cy="9.5" r="3.2" fill="#fff" />
      </svg>
      {label && (
        <span
          className={`mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
            theme === 'dark'
              ? 'bg-black/65 text-brand-gold-bright'
              : 'bg-white/85 text-[#1e293b]'
          }`}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
