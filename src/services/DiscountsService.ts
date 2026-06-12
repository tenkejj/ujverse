/**
 * UJverse — DiscountsService: CRUD + use tracking + reviews dla "Couponek UJ".
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Zasady:
 *   - Wszystkie SELECT-y filtrują `hidden_at is null` chyba że caller jawnie
 *     poprosi o all (admin-tier; nie używane w UI MVP).
 *   - "Wziąłem!" idzie przez RPC `mark_discount_use` — idempotentne (nie da
 *     się double-count), zwraca aktualny `use_count` dla optimistic UI.
 *   - Trending używa RPC `trending_discounts` (oknem 7 dni).
 *   - Reviews: 1 per user per discount (UNIQUE constraint w DB).
 *
 * Wszystkie metody zwracają `{ data, error }` zgodnie z konwencją w
 * `CohortService.ts` — łatwy match z istniejącymi hookami.
 */
import { supabase } from '../supabaseClient'
import type { PostgrestError } from '@supabase/supabase-js'
import type {
  DiscountCategory,
  DiscountFilter,
  DiscountReportReason,
  DiscountReview,
  StudentDiscount,
} from '../types/discounts'

const DISCOUNT_SELECT_FIELDS =
  'id, created_by, business_name, discount_headline, description, category, address, city, lat, lng, website_url, source_url, verified_at, verified_by, requires_uj_id, valid_until, use_count, review_count, avg_rating, report_count, hidden_at, hidden_reason, created_at, updated_at'

class DiscountsServiceImpl {
  // -------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------

  /** Pełen katalog z filtrami / sortem. Domyślnie tylko widoczne (hidden_at null). */
  async list(filter: DiscountFilter): Promise<{ data: StudentDiscount[]; error: PostgrestError | null }> {
    let q = supabase
      .from('student_discounts')
      .select(DISCOUNT_SELECT_FIELDS)
      .is('hidden_at', null)

    if (filter.category !== 'all') {
      q = q.eq('category', filter.category)
    }
    if (filter.verifiedOnly) {
      q = q.not('verified_at', 'is', null)
    }
    if (filter.search.trim()) {
      const term = `%${filter.search.trim()}%`
      // OR po nazwie biznesu i nagłówku zniżki — proste ale wystarcza
      q = q.or(`business_name.ilike.${term},discount_headline.ilike.${term}`)
    }

    switch (filter.sort) {
      case 'use':
        q = q.order('use_count', { ascending: false }).order('created_at', { ascending: false })
        break
      case 'rating':
        q = q.order('avg_rating', { ascending: false, nullsFirst: false }).order('use_count', { ascending: false })
        break
      case 'created':
      default:
        q = q.order('created_at', { ascending: false })
        break
    }

    q = q.limit(200)
    const { data, error } = await q
    return { data: (data ?? []) as StudentDiscount[], error }
  }

  async getById(id: string): Promise<{ data: StudentDiscount | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('student_discounts')
      .select(DISCOUNT_SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle()
    return { data: (data as StudentDiscount | null) ?? null, error }
  }

  /** Set ID-ków zniżek użytych przez `userId` — do oznaczenia "Wziąłeś" w UI. */
  async getMyUsedDiscountIds(userId: string): Promise<{ data: Set<string>; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('student_discount_uses')
      .select('discount_id')
      .eq('user_id', userId)
    if (error) return { data: new Set(), error }
    const set = new Set<string>()
    for (const row of (data ?? []) as Array<{ discount_id: string }>) {
      set.add(row.discount_id)
    }
    return { data: set, error: null }
  }

  /**
   * Top N najczęściej "branych" zniżek z ostatnich 7 dni — RPC zwraca
   * pary (id, recent_uses); my następnie pobieramy pełne rekordy z głównej
   * tabeli i merge w odpowiedniej kolejności (Postgrest nie obsługuje
   * order-by-array, więc sort robimy JS-side).
   */
  async trending(limit = 5): Promise<{ data: Array<StudentDiscount & { recentUses: number }>; error: PostgrestError | null }> {
    const { data: trendingRows, error: rpcError } = await supabase.rpc('trending_discounts', { p_limit: limit })
    if (rpcError) return { data: [], error: rpcError }
    const trendingArr = (trendingRows ?? []) as Array<{ discount_id: string; recent_uses: number }>
    if (trendingArr.length === 0) return { data: [], error: null }

    const ids = trendingArr.map((r) => r.discount_id)
    const { data: discounts, error } = await supabase
      .from('student_discounts')
      .select(DISCOUNT_SELECT_FIELDS)
      .in('id', ids)
      .is('hidden_at', null)
    if (error) return { data: [], error }

    const byId = new Map((discounts as StudentDiscount[]).map((d) => [d.id, d]))
    const merged = trendingArr
      .map((row) => {
        const disc = byId.get(row.discount_id)
        return disc ? { ...disc, recentUses: Number(row.recent_uses) } : null
      })
      .filter((x): x is StudentDiscount & { recentUses: number } => x !== null)
    return { data: merged, error: null }
  }

  // -------------------------------------------------------------------
  // MUTATIONS — discount
  // -------------------------------------------------------------------

  async create(payload: {
    createdBy: string
    businessName: string
    discountHeadline: string
    description?: string | null
    category: DiscountCategory
    address?: string | null
    city?: string
    lat?: number | null
    lng?: number | null
    websiteUrl?: string | null
    sourceUrl?: string | null
    requiresUjId?: boolean
    validUntil?: string | null
  }): Promise<{ data: StudentDiscount | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('student_discounts')
      .insert({
        created_by: payload.createdBy,
        business_name: payload.businessName,
        discount_headline: payload.discountHeadline,
        description: payload.description ?? null,
        category: payload.category,
        address: payload.address ?? null,
        city: payload.city ?? 'Kraków',
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        website_url: payload.websiteUrl ?? null,
        source_url: payload.sourceUrl ?? null,
        requires_uj_id: payload.requiresUjId ?? true,
        valid_until: payload.validUntil ?? null,
      })
      .select(DISCOUNT_SELECT_FIELDS)
      .single()
    return { data: (data as StudentDiscount | null) ?? null, error }
  }

  async update(id: string, patch: Partial<{
    businessName: string
    discountHeadline: string
    description: string | null
    category: DiscountCategory
    address: string | null
    lat: number | null
    lng: number | null
    websiteUrl: string | null
    sourceUrl: string | null
    requiresUjId: boolean
    validUntil: string | null
  }>): Promise<{ data: StudentDiscount | null; error: PostgrestError | null }> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.businessName !== undefined) dbPatch.business_name = patch.businessName
    if (patch.discountHeadline !== undefined) dbPatch.discount_headline = patch.discountHeadline
    if (patch.description !== undefined) dbPatch.description = patch.description
    if (patch.category !== undefined) dbPatch.category = patch.category
    if (patch.address !== undefined) dbPatch.address = patch.address
    if (patch.lat !== undefined) dbPatch.lat = patch.lat
    if (patch.lng !== undefined) dbPatch.lng = patch.lng
    if (patch.websiteUrl !== undefined) dbPatch.website_url = patch.websiteUrl
    if (patch.sourceUrl !== undefined) dbPatch.source_url = patch.sourceUrl
    if (patch.requiresUjId !== undefined) dbPatch.requires_uj_id = patch.requiresUjId
    if (patch.validUntil !== undefined) dbPatch.valid_until = patch.validUntil

    const { data, error } = await supabase
      .from('student_discounts')
      .update(dbPatch)
      .eq('id', id)
      .select(DISCOUNT_SELECT_FIELDS)
      .single()
    return { data: (data as StudentDiscount | null) ?? null, error }
  }

  async delete(id: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('student_discounts').delete().eq('id', id)
    return { error }
  }

  // -------------------------------------------------------------------
  // USE TRACKING
  // -------------------------------------------------------------------

  /**
   * Idempotentne oznaczenie "wziąłem!" — RPC zwraca nowy `use_count` oraz
   * flagę `already_used` (gdy true, count nie został zmieniony).
   */
  async markUse(discountId: string): Promise<{ useCount: number; alreadyUsed: boolean; error: PostgrestError | null }> {
    const { data, error } = await supabase.rpc('mark_discount_use', { p_discount_id: discountId })
    if (error || !data) return { useCount: 0, alreadyUsed: false, error: error ?? null }
    const row = Array.isArray(data) ? data[0] : data
    const useCount = typeof row?.use_count === 'number' ? row.use_count : 0
    const alreadyUsed = Boolean(row?.already_used)
    return { useCount, alreadyUsed, error: null }
  }

  async unmarkUse(discountId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('student_discount_uses')
      .delete()
      .eq('discount_id', discountId)
      .eq('user_id', userId)
    return { error }
  }

  // -------------------------------------------------------------------
  // REVIEWS
  // -------------------------------------------------------------------

  async listReviews(discountId: string): Promise<{ data: DiscountReview[]; error: PostgrestError | null }> {
    type RawAuthor = { id: string; full_name: string | null; username: string | null; avatar_url: string | null }
    type RawReview = Omit<DiscountReview, 'author'> & { author: RawAuthor | RawAuthor[] | null }
    const { data, error } = await supabase
      .from('student_discount_reviews')
      .select(
        'id, discount_id, user_id, rating, comment, created_at, updated_at, author:profiles!student_discount_reviews_user_id_fkey(id, full_name, username, avatar_url)',
      )
      .eq('discount_id', discountId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return { data: [], error }
    // PostgREST embed dla FK potrafi zwrócić array nawet dla single FK —
    // normalizujemy do flat object|null.
    const normalized = ((data ?? []) as unknown as RawReview[]).map<DiscountReview>((r) => ({
      ...r,
      author: Array.isArray(r.author) ? r.author[0] ?? null : r.author,
    }))
    return { data: normalized, error: null }
  }

  async upsertMyReview(payload: {
    discountId: string
    userId: string
    rating: number
    comment?: string | null
  }): Promise<{ data: DiscountReview | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('student_discount_reviews')
      .upsert(
        {
          discount_id: payload.discountId,
          user_id: payload.userId,
          rating: payload.rating,
          comment: payload.comment ?? null,
        },
        { onConflict: 'discount_id,user_id' },
      )
      .select('id, discount_id, user_id, rating, comment, created_at, updated_at')
      .single()
    return { data: (data as DiscountReview | null) ?? null, error }
  }

  async deleteMyReview(discountId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('student_discount_reviews')
      .delete()
      .eq('discount_id', discountId)
      .eq('user_id', userId)
    return { error }
  }

  // -------------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------------

  async report(payload: {
    discountId: string
    userId: string
    reason: DiscountReportReason
    comment?: string | null
  }): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('student_discount_reports').insert({
      discount_id: payload.discountId,
      user_id: payload.userId,
      reason: payload.reason,
      comment: payload.comment ?? null,
    })
    return { error }
  }
}

export const DiscountsService = new DiscountsServiceImpl()
