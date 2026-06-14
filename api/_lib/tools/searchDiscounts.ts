/**
 * Tool: `search_discounts`
 *
 * Wyszukuje zniżki studenckie z `public.student_discounts` z opcjonalnym
 * filtrem po fragmencie tekstu (`business_name`, `discount_headline`,
 * `description`) oraz po kategorii (10-elementowy enum z migracji
 * 20260625100000_student_discounts.sql).
 *
 * Filtry niewidoczne dla modelu (zawsze stosowane):
 *   - `hidden_at IS NULL`        — nie pokazujemy ukrytych przez admina
 *   - `valid_until IS NULL OR valid_until >= today` — nie pokazujemy
 *     wygasłych
 *
 * Sortowanie:
 *   - najpierw `verified_at DESC NULLS LAST` (zweryfikowane na górze)
 *   - potem `use_count DESC` (popularne wyżej)
 *
 * Argsy są opcjonalne — bez żadnego argumentu narzędzie zwraca top 10
 * zniżek (verified + popular). Z `category` filtrujemy po enumie
 * (jedzenie, kawa, kultura, kino, sport, ksiazki, uslugi, transport,
 * odziez, inne). Z `query` robimy `OR` na trzech kolumnach `ilike`.
 *
 * Cache: TTL 120s — zniżki zmieniają się rzadko, ale `use_count` rośnie
 * (trigger), więc 2 min trzymają świeżość bez floodu.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10
const MIN_QUERY_LEN = 2

const ALLOWED_CATEGORIES = [
  'jedzenie',
  'kawa',
  'kultura',
  'kino',
  'sport',
  'ksiazki',
  'uslugi',
  'transport',
  'odziez',
  'inne',
] as const

function escapeIlikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

const DiscountRowSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  discount_headline: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  website_url: z.string().nullable(),
  source_url: z.string().nullable(),
  requires_uj_id: z.boolean().nullable(),
  valid_until: z.string().nullable(),
  verified_at: z.string().nullable(),
  use_count: z.number().nullable(),
  review_count: z.number().nullable(),
  avg_rating: z.union([z.number(), z.string()]).nullable(),
  created_at: z.string().nullable(),
})

const DiscountRowsSchema = z.array(DiscountRowSchema)

export type SearchDiscountsArgs = {
  query?: string
  category?: string
}

type ResultItem = {
  id: string
  business_name: string
  discount_headline: string
  description: string | null
  category: string
  address: string | null
  city: string | null
  website_url: string | null
  source_url: string | null
  requires_uj_id: boolean
  valid_until: string | null
  verified_at: string | null
  use_count: number
  review_count: number
  avg_rating: number | null
}

export type SearchDiscountsResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type SearchDiscountsError = {
  ok: false
  error: string
}

const DISCOUNT_SELECT =
  'id, business_name, discount_headline, description, category, ' +
  'address, city, website_url, source_url, requires_uj_id, valid_until, ' +
  'verified_at, use_count, review_count, avg_rating, created_at'

async function execute(
  args: SearchDiscountsArgs,
  ctx: ToolContext,
): Promise<SearchDiscountsResult | SearchDiscountsError | string> {
  const rawQuery = typeof args?.query === 'string' ? args.query.trim() : ''
  const rawCategory = typeof args?.category === 'string' ? args.category.trim().toLowerCase() : ''

  if (rawCategory && !ALLOWED_CATEGORIES.includes(rawCategory as (typeof ALLOWED_CATEGORIES)[number])) {
    return {
      ok: false,
      error: `invalid category — allowed: ${ALLOWED_CATEGORIES.join(', ')}`,
    }
  }

  // Today w UTC — `valid_until` to `date`, więc porównujemy z YYYY-MM-DD.
  const today = new Date().toISOString().slice(0, 10)

  let q = ctx.supabaseAdmin
    .from('student_discounts')
    .select(DISCOUNT_SELECT)
    .is('hidden_at', null)
    .or(`valid_until.is.null,valid_until.gte.${today}`)
    .order('verified_at', { ascending: false, nullsFirst: false })
    .order('use_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (rawCategory) {
    q = q.eq('category', rawCategory)
  }

  if (rawQuery.length >= MIN_QUERY_LEN) {
    const pattern = escapeIlikePattern(rawQuery)
    q = q.or(
      `business_name.ilike.%${pattern}%,` +
        `discount_headline.ilike.%${pattern}%,` +
        `description.ilike.%${pattern}%`,
    )
  }

  const { data, error } = await q

  if (error) {
    console.error('[search_discounts] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = DiscountRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[search_discounts] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid discount row shape from database' }
  }

  if (parsed.data.length === 0) {
    return 'Brak danych w bazie dla tego zapytania'
  }

  const items: ResultItem[] = parsed.data.map((r) => ({
    id: r.id,
    business_name: r.business_name,
    discount_headline: r.discount_headline,
    description: r.description,
    category: r.category,
    address: r.address,
    city: r.city,
    website_url: r.website_url,
    source_url: r.source_url,
    requires_uj_id: r.requires_uj_id ?? true,
    valid_until: r.valid_until,
    verified_at: r.verified_at,
    use_count: r.use_count ?? 0,
    review_count: r.review_count ?? 0,
    avg_rating:
      r.avg_rating == null
        ? null
        : typeof r.avg_rating === 'number'
          ? r.avg_rating
          : Number(r.avg_rating),
  }))

  return { ok: true, count: items.length, items }
}

registerTool<
  SearchDiscountsArgs,
  SearchDiscountsResult | SearchDiscountsError | string
>({
  tool: {
    name: 'search_discounts',
        description:
          'Zniżki studenckie w Krakowie (Couponek UJ). Filtr po kategorii i/lub haśle. Bez args = top 10. Pytania o zniżki/kupony/promocje/„gdzie taniej".',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Min. 2 znaki.' },
            category: {
              type: 'string',
              description: 'jedna z enum.',
              enum: [...ALLOWED_CATEGORIES],
            },
          },
          additionalProperties: false,
        },
  },
  execute,
})
