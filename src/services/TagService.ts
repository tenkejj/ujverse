/**
 * TagService — oficjalne tagi / strefy z `public.groups`.
 * Źródło prawdy dla menu nawigacji (GroupNav) i triggera tagów postów.
 */

import { createElement, type ReactElement } from 'react'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Dumbbell,
  HelpCircle,
  Layers,
  Megaphone,
  Palette,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../supabaseClient'

/** Kanoniczna lista oficjalnych tagów (pełna — widok `/groups` i rail mobile). */
export const OFFICIAL_TAGS = [
  'ankiety',
  'ogloszenia',
  'pomoc',
  'praca',
  'wydarzenia',
  'nauka',
  'sport',
  'kultura',
  'inicjatywy',
] as const

export type OfficialTagSlug = (typeof OFFICIAL_TAGS)[number]

export const OFFICIAL_TAG_SET = new Set<string>(OFFICIAL_TAGS)

/**
 * Sliced subset of `OFFICIAL_TAGS` zachowujący kanoniczną kolejność.
 * Używane przez `GroupNav` z prop `limit` (feed=3, widok strefy=9).
 *
 * `slice(0, n)` jest bezpieczne dla n<=0 (zwraca []) i n>length (zwraca cały zbiór).
 */
export function getZones(limit: number): OfficialTagSlug[] {
  return OFFICIAL_TAGS.slice(0, Math.max(0, limit))
}

/** Ikona Lucide przypisana do oficjalnego tagu. Spójna dla całego UI. */
export const TAG_ICONS: Record<OfficialTagSlug, LucideIcon> = {
  ankiety: BarChart3,
  ogloszenia: Megaphone,
  pomoc: HelpCircle,
  praca: Briefcase,
  wydarzenia: Calendar,
  nauka: BookOpen,
  sport: Dumbbell,
  kultura: Palette,
  inicjatywy: Users,
}

/** Fallback dla slugów spoza `OFFICIAL_TAGS` — utrzymuje spójność wizualną zamiast `Radio`. */
const ZONE_ICON_FALLBACK: LucideIcon = Layers

export type ZoneIconProps = {
  slug: string
  className?: string
  strokeWidth?: number
}

/**
 * `ZoneIcon` — jedyne źródło prawdy dla ikon stref (sidebar, nagłówek, kafelki).
 *
 * Rozwiązuje slug przez `canonicalOfficialSlug` (obsługa aliasów l.poj./mn.) i
 * sięga do `TAG_ICONS`. Dla nieznanych slugów rysuje `Layers` zamiast `Radio`,
 * dzięki czemu nowe oficjalne strefy nie wymagają zmian w UI poza rejestrem.
 *
 * Rozmiar i kolor sterowane wyłącznie klasami Tailwind (`size-*`, `text-*`).
 */
export function ZoneIcon({
  slug,
  className,
  strokeWidth = 2,
}: ZoneIconProps): ReactElement {
  const canonical = canonicalOfficialSlug(slug)
  const Icon = canonical ? TAG_ICONS[canonical] : ZONE_ICON_FALLBACK
  return createElement(Icon, {
    className,
    strokeWidth,
    'aria-hidden': true,
  })
}

/** Statyczne etykiety sidebaru — nie zależą od treści postów ani slugów w DB. */
export const OFFICIAL_TAG_META: Record<OfficialTagSlug, { name: string; hashtag: string }> = {
  ankiety: { name: 'Ankiety', hashtag: '#ankiety' },
  ogloszenia: { name: 'Ogłoszenia', hashtag: '#ogloszenia' },
  pomoc: { name: 'Pomoc', hashtag: '#pomoc' },
  praca: { name: 'Praca', hashtag: '#praca' },
  wydarzenia: { name: 'Wydarzenia', hashtag: '#wydarzenia' },
  nauka: { name: 'Nauka', hashtag: '#nauka' },
  sport: { name: 'Sport', hashtag: '#sport' },
  kultura: { name: 'Kultura', hashtag: '#kultura' },
  inicjatywy: { name: 'Inicjatywy', hashtag: '#inicjatywy' },
}

/** Krótkie opisy stref — używane w kafelkach na `/group` hub. */
export const TAG_DESCRIPTIONS: Record<OfficialTagSlug, string> = {
  ankiety: 'Głosowania i sondaże społeczności UJ.',
  ogloszenia: 'Ogłoszenia studenckie i z życia uczelni.',
  pomoc: 'Prośby o pomoc i wsparcie w sprawach studenckich.',
  praca: 'Oferty pracy, staży i współpracy.',
  wydarzenia: 'Spotkania, koncerty i inicjatywy społeczności.',
  nauka: 'Materiały, notatki i pytania o przedmioty.',
  sport: 'Aktywności sportowe, mecze i AZS UJ.',
  kultura: 'Wystawy, koncerty i wydarzenia kulturalne.',
  inicjatywy: 'Akcje studenckie i projekty społeczności.',
}

/** Mapowanie wariantów slugów z DB (np. liczba pojedyn. / mnog.) na kanoniczny tag. */
const SLUG_ALIASES: Record<string, OfficialTagSlug> = {
  ankieta: 'ankiety',
  ankiety: 'ankiety',
  ogloszenie: 'ogloszenia',
  ogloszenia: 'ogloszenia',
  wydarzenie: 'wydarzenia',
  wydarzenia: 'wydarzenia',
  pomoc: 'pomoc',
  praca: 'praca',
}

export type OfficialTagRow = {
  id: string
  name: string
  slug: OfficialTagSlug
  hashtag: string
}

export function canonicalOfficialSlug(raw: string): OfficialTagSlug | null {
  const key = raw.trim().toLowerCase()
  if (SLUG_ALIASES[key]) return SLUG_ALIASES[key]
  if (OFFICIAL_TAG_SET.has(key)) return key as OfficialTagSlug
  return null
}

export function isOfficialTagSlug(raw: string): boolean {
  return canonicalOfficialSlug(raw) !== null
}

function sortByOfficialOrder(rows: OfficialTagRow[]): OfficialTagRow[] {
  const order = new Map(OFFICIAL_TAGS.map((slug, index) => [slug, index]))
  return [...rows].sort(
    (a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999),
  )
}

function rowFromSlug(slug: OfficialTagSlug): OfficialTagRow {
  const meta = OFFICIAL_TAG_META[slug]
  return {
    id: `official-${slug}`,
    name: meta.name,
    slug,
    hashtag: meta.hashtag,
  }
}

/** Sidebar — statyczna lista oficjalnych tagów (kolejność z `OFFICIAL_TAGS`). */
export function getOfficialTags(): { tags: OfficialTagRow[]; error: Error | null } {
  const tags = OFFICIAL_TAGS.map((slug) => rowFromSlug(slug))
  return { tags, error: null }
}

class TagServiceImpl {
  getOfficialTags(): { tags: OfficialTagRow[]; error: Error | null } {
    return getOfficialTags()
  }

  getZones(limit: number): OfficialTagSlug[] {
    return getZones(limit)
  }

  async listOfficialTags(): Promise<{ tags: OfficialTagRow[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (error) {
      return { tags: [], error: new Error(error.message) }
    }

    const bySlug = new Map<OfficialTagSlug, OfficialTagRow>()

    for (const row of data ?? []) {
      const canonical = canonicalOfficialSlug(String(row.slug ?? ''))
      if (!canonical) continue

      const meta = OFFICIAL_TAG_META[canonical]
      bySlug.set(canonical, {
        id: String(row.id),
        name: meta?.name ?? String(row.name),
        slug: canonical,
        hashtag: meta?.hashtag ?? `#${canonical}`,
      })
    }

    return { tags: sortByOfficialOrder([...bySlug.values()]), error: null }
  }
}

export const TagService = new TagServiceImpl()
