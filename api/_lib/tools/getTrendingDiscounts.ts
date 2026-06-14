/**
 * Tool: `get_trending_discounts`
 *
 * Zwraca TOP 5 zniżek po liczbie aktywacji (`mark_discount_use`) z ostatnich
 * 7 dni. Korzysta z RPC `public.trending_discounts(p_limit)` zdefiniowanej
 * w migracji 20260625100000_student_discounts.sql:315-333.
 *
 * RPC zwraca dwie kolumny — `discount_id` i `recent_uses`. Pełne dane zniżek
 * (nazwa, kategoria, adres, headline) dociągamy w drugim zapytaniu po `id IN (...)`,
 * a potem mergujemy w pamięci, zachowując kolejność z RPC (po `recent_uses DESC`).
 *
 * Cache TTL 300s — agregat 7-dniowy, świeżość nie jest krytyczna.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const TRENDING_LIMIT = 5

const TrendingRowSchema = z.object({
  discount_id: z.string(),
  recent_uses: z.union([z.number(), z.string()]),
})
const TrendingRowsSchema = z.array(TrendingRowSchema)

const DiscountRowSchema = z.object({
  id: z.string(),
  business_name: z.string(),
  discount_headline: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  verified_at: z.string().nullable(),
  use_count: z.number().nullable(),
  avg_rating: z.union([z.number(), z.string()]).nullable(),
})
const DiscountRowsSchema = z.array(DiscountRowSchema)

type ResultItem = {
  id: string
  business_name: string
  discount_headline: string
  description: string | null
  category: string
  address: string | null
  city: string | null
  verified_at: string | null
  recent_uses: number
  use_count: number
  avg_rating: number | null
}

export type GetTrendingDiscountsResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type GetTrendingDiscountsError = {
  ok: false
  error: string
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<GetTrendingDiscountsResult | GetTrendingDiscountsError | string> {
  const { data: trendData, error: trendErr } = await ctx.supabaseAdmin.rpc(
    'trending_discounts',
    { p_limit: TRENDING_LIMIT },
  )
  if (trendErr) {
    console.error('[get_trending_discounts] RPC error:', trendErr.message)
    return { ok: false, error: trendErr.message }
  }
  const trendParsed = TrendingRowsSchema.safeParse(trendData ?? [])
  if (!trendParsed.success) {
    console.error(
      '[get_trending_discounts] zod validation failed (trend):',
      trendParsed.error.issues,
    )
    return { ok: false, error: 'invalid trending row shape from database' }
  }
  const trendRows = trendParsed.data
  if (trendRows.length === 0) {
    return 'Brak danych w bazie dla tego zapytania'
  }

  const ids = trendRows.map((r) => r.discount_id)
  const { data: discountData, error: discountErr } = await ctx.supabaseAdmin
    .from('student_discounts')
    .select(
      'id, business_name, discount_headline, description, category, ' +
        'address, city, verified_at, use_count, avg_rating',
    )
    .in('id', ids)
    .is('hidden_at', null)
  if (discountErr) {
    console.error(
      '[get_trending_discounts] discount select error:',
      discountErr.message,
    )
    return { ok: false, error: discountErr.message }
  }
  const discountParsed = DiscountRowsSchema.safeParse(discountData ?? [])
  if (!discountParsed.success) {
    console.error(
      '[get_trending_discounts] zod validation failed (discount):',
      discountParsed.error.issues,
    )
    return { ok: false, error: 'invalid discount row shape from database' }
  }
  const byId = new Map<string, (typeof discountParsed.data)[number]>()
  for (const d of discountParsed.data) byId.set(d.id, d)

  const items: ResultItem[] = []
  for (const t of trendRows) {
    const d = byId.get(t.discount_id)
    if (!d) continue
    items.push({
      id: d.id,
      business_name: d.business_name,
      discount_headline: d.discount_headline,
      description: d.description,
      category: d.category,
      address: d.address,
      city: d.city,
      verified_at: d.verified_at,
      recent_uses:
        typeof t.recent_uses === 'number'
          ? t.recent_uses
          : Number(t.recent_uses),
      use_count: d.use_count ?? 0,
      avg_rating:
        d.avg_rating == null
          ? null
          : typeof d.avg_rating === 'number'
            ? d.avg_rating
            : Number(d.avg_rating),
    })
  }

  if (items.length === 0) {
    return 'Brak danych w bazie dla tego zapytania'
  }

  return { ok: true, count: items.length, items }
}

registerTool<
  Record<string, never>,
  GetTrendingDiscountsResult | GetTrendingDiscountsError | string
>({
  tool: {
    name: 'get_trending_discounts',
    description:
      'Top 5 zniżek najczęściej aktywowanych w 7 ostatnich dniach. Dla „co popularne/polecane/trendy".',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
