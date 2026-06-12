/**
 * BuildingExtrusionsLayer — declarative configs dla warstw MapLibre.
 *
 * Trzy warstwy:
 *   1. `OSM_BUILDINGS_LAYER` — generyczne `fill-extrusion` z tiles
 *      OpenFreeMap (OpenMapTiles schema, source-layer `building`).
 *      Niski opacity + neutralna szarość — kontekst miasta wokół UJ.
 *
 *   2. `UJ_BUILDINGS_LAYER` — overlay z 18 budynków UJ, gold accent,
 *      wyższy opacity. Wysokość liczona z `height_m` (z OSM `height`/
 *      `building:levels` zescrapowanego przez `scripts/fetch-uj-footprints.ts`)
 *      albo fallback 12m dla "nieznanych".
 *
 *   3. `UJ_BUILDINGS_OUTLINE_LAYER` — cienka linia wokół UJ buildings,
 *      pomaga je odróżnić od OSM context gdy widok jest z dystansu.
 *
 * Stylowanie używa data-driven properties (`['get', 'height_m']`,
 * `['feature-state', 'selected']`) — MapLibre re-renderuje na hover/click
 * bez przebudowy całego sourcea.
 */

import type {
  FillExtrusionLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'

/** Domyślna wysokość budynku UJ gdy w OSM nie ma `height`/`levels`. */
export const UJ_DEFAULT_HEIGHT_M = 12

/** Layer ID dla floating labels nad UJ buildings. */
export const UJ_BUILDINGS_LABEL_LAYER_ID = 'uj-buildings-label'

/**
 * Layer ID dla OSM buildings (rendered globalnie, niski opacity).
 * Style musi mieć source `openmaptiles` z `source-layer: building`
 * (OpenFreeMap / OpenMapTiles defaults to this).
 */
export const OSM_BUILDINGS_LAYER_ID = 'osm-buildings-3d'

/** Layer ID dla UJ buildings — gold extrusion. */
export const UJ_BUILDINGS_LAYER_ID = 'uj-buildings-3d'

/** Layer ID dla UJ buildings outline (cienka linia). */
export const UJ_BUILDINGS_OUTLINE_LAYER_ID = 'uj-buildings-outline'

/** GeoJSON source ID dla UJ footprints. */
export const UJ_BUILDINGS_SOURCE_ID = 'uj-buildings'

/**
 * Buduje spec layer'a `fill-extrusion` dla generycznych OSM buildings.
 * Wstawiany do MapLibre style PRZED warstwą UJ żeby UJ rysowało się na wierzchu.
 */
export function buildOsmBuildingsLayer(theme: 'light' | 'dark'): FillExtrusionLayerSpecification {
  return {
    id: OSM_BUILDINGS_LAYER_ID,
    source: 'openmaptiles',
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': theme === 'dark' ? '#3f3f46' : '#cbd5e1',
      // OpenMapTiles building tiles eksponują `render_height` (interpoluje
      // z `height` lub `levels * 3`). W razie braku — fallback 0 (płaskie).
      'fill-extrusion-height': [
        'coalesce',
        ['get', 'render_height'],
        ['*', ['coalesce', ['get', 'render_min_height'], 0], 1],
        0,
      ],
      'fill-extrusion-base': [
        'coalesce',
        ['get', 'render_min_height'],
        0,
      ],
      'fill-extrusion-opacity': 0.65,
    },
  }
}

/**
 * Layer dla UJ buildings — gold extrusion z dynamic color (selected /
 * hover) przez `feature-state`. ID feature'u to `building_id` slug
 * (musi być promote_id w source).
 */
export function buildUjBuildingsLayer(theme: 'light' | 'dark'): FillExtrusionLayerSpecification {
  // Tokeny w sync z `src/styles/theme.ts`:
  //   gold.primary `#1e293b` — głęboki granat, używany jako kolor akcentu
  //                            w light mode (logo, akcenty).
  //   gold.bright  `#e8c84a` — żywy gold dla dark mode.
  const goldPrimary = '#1e293b'
  const goldBright = '#e8c84a'
  const idleColor = theme === 'dark' ? goldBright : goldPrimary
  const hoverColor = theme === 'dark' ? '#f4d96b' : '#334155'
  const selectedColor = theme === 'dark' ? '#ffe88a' : '#0f172a'

  return {
    id: UJ_BUILDINGS_LAYER_ID,
    source: UJ_BUILDINGS_SOURCE_ID,
    type: 'fill-extrusion',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], selectedColor,
        ['boolean', ['feature-state', 'hover'], false], hoverColor,
        idleColor,
      ],
      'fill-extrusion-height': [
        'coalesce',
        ['get', 'height_m'],
        // properties.levels * 3.5 jako fallback gdy height_m null
        ['*', ['coalesce', ['get', 'levels'], 0], 3.5],
        UJ_DEFAULT_HEIGHT_M,
      ],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 0.95,
        ['boolean', ['feature-state', 'hover'], false], 0.9,
        0.85,
      ],
    },
  }
}

/**
 * Cienka linia wokół UJ buildings — żeby przy oddalonym widoku akcent
 * gold był widoczny nawet jak budynek ma mały footprint.
 */
export function buildUjBuildingsOutlineLayer(theme: 'light' | 'dark'): LineLayerSpecification {
  return {
    id: UJ_BUILDINGS_OUTLINE_LAYER_ID,
    source: UJ_BUILDINGS_SOURCE_ID,
    type: 'line',
    minzoom: 12,
    paint: {
      'line-color': theme === 'dark' ? '#fde68a' : '#0f172a',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false], 3,
        ['boolean', ['feature-state', 'hover'], false], 2.2,
        1.2,
      ],
      'line-opacity': 0.95,
    },
  }
}

/**
 * Symbol layer — short_name budynku UJ rendered jako pill nad jego
 * centroidem. Widoczne od minzoom 13.5; po hoverze opcjonalnie pełna
 * nazwa (managed przez featureState `hover`).
 */
export function buildUjBuildingsLabelLayer(
  theme: 'light' | 'dark',
): SymbolLayerSpecification {
  const textColor = theme === 'dark' ? '#fde68a' : '#0f172a'
  const haloColor = theme === 'dark' ? '#0b1226' : '#ffffff'
  return {
    id: UJ_BUILDINGS_LABEL_LAYER_ID,
    source: UJ_BUILDINGS_SOURCE_ID,
    type: 'symbol',
    minzoom: 13.5,
    layout: {
      // Skrót budynku — z `short_name` w properties; fallback do `name`.
      'text-field': [
        'coalesce',
        ['get', 'short_name'],
        ['get', 'name'],
        ['get', 'building_id'],
      ],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        13.5, 10,
        16, 13,
        18, 16,
      ],
      'text-font': ['Noto Sans Bold'],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      // Renderuj label przy centroidzie polygonu.
      'symbol-placement': 'point',
      'text-anchor': 'center',
      'text-padding': 6,
    },
    paint: {
      'text-color': textColor,
      'text-halo-color': haloColor,
      'text-halo-width': 1.6,
      'text-halo-blur': 0.4,
      'text-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1,
        ['boolean', ['feature-state', 'selected'], false], 1,
        0.9,
      ],
    },
  }
}

/**
 * Definicja koloru tła sky (gradient) dla globe-look — MapLibre `setSky`.
 * Light mode: jasny błękit, dark: granat→black gradient.
 */
export function buildSkySpec(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      'sky-color': '#0b1226',
      'sky-horizon-blend': 0.5,
      'horizon-color': '#1e293b',
      'horizon-fog-blend': 0.7,
      'fog-color': '#0b1226',
      'fog-ground-blend': 0.7,
      'atmosphere-blend': 0.6,
    } as const
  }
  return {
    'sky-color': '#cfe0f2',
    'sky-horizon-blend': 0.4,
    'horizon-color': '#dbe7f3',
    'horizon-fog-blend': 0.7,
    'fog-color': '#e2edf7',
    'fog-ground-blend': 0.7,
    'atmosphere-blend': 0.6,
  } as const
}

// ─────────────────────────────────────────────────────────────────────────
// Styl mapy — light/dark
// ─────────────────────────────────────────────────────────────────────────

/**
 * Free, no-key style endpoints z OpenFreeMap (community fork OpenMapTiles).
 * Działają bez tokena, OSM-based, schema kompatybilna z `OpenMapTiles`.
 */
export const MAP_STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

export function mapStyleUrl(theme: 'light' | 'dark'): string {
  return MAP_STYLE_URLS[theme]
}
