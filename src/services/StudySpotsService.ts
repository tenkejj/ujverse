/**
 * UJverse — StudySpotsService: CRUD + check-in/check-out + rating.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Konwencje:
 *   - Wszystkie metody zwracają `{ data, error }` zgodnie z pozostałymi
 *     service'ami (`UsosRegistrationsService`, `DiscountsService`).
 *   - `getAllWithMyState(userId)` używa RPC `get_study_spots_full` —
 *     jednym strzałem ściąga listę spotów + info o moim rating i
 *     aktywnym check-inie (no N+1 z klienta).
 *   - Check-in: unique constraint `WHERE checked_out_at IS NULL` w SQL
 *     zapewnia że user jest w max 1 miejscu. Próba check-in'u w innym
 *     miejscu wymaga uprzedniego check-out (caller powinien to zrobić).
 *   - `checkout` ustawia `checked_out_at = now()`. Auto-expire 3h przez
 *     `expire_old_study_checkins()` w cronie (lub on-demand).
 */
import { supabase } from '../supabaseClient'
import type { PostgrestError } from '@supabase/supabase-js'
import type {
  ActiveCheckinWithProfile,
  StudySpot,
  StudySpotCheckin,
  StudySpotCreateInput,
  StudySpotMood,
  StudySpotRating,
  StudySpotWithUserState,
} from '../types/studySpots'
import {
  removeStudySpotPhoto,
  uploadStudySpotPhoto,
  MAX_PHOTOS_PER_SPOT,
} from '../lib/studySpotUpload'

const SPOT_SELECT_FIELDS =
  'id, name, address, lat, lng, kind, building_id, description, hours_text, photo_urls, wifi_quality, silence_level, sockets_count_estimate, tags, website_url, google_maps_url, is_free, price_hint, rating_avg, rating_count, active_checkins_count, created_by, created_at, updated_at'

class StudySpotsServiceImpl {
  // -------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------

  async getAllWithMyState(
    userId: string,
  ): Promise<{ data: StudySpotWithUserState[]; error: PostgrestError | null }> {
    const { data, error } = await supabase.rpc('get_study_spots_full', { p_user_id: userId })
    return {
      data: (data ?? []) as StudySpotWithUserState[],
      error: error as PostgrestError | null,
    }
  }

  async getById(spotId: string): Promise<{ data: StudySpot | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('study_spots')
      .select(SPOT_SELECT_FIELDS)
      .eq('id', spotId)
      .maybeSingle()
    return { data: (data as unknown as StudySpot | null) ?? null, error: error as PostgrestError | null }
  }

  // -------------------------------------------------------------------
  // CREATE / UPDATE / DELETE
  // -------------------------------------------------------------------

  async create(
    input: StudySpotCreateInput,
    userId: string,
  ): Promise<{ data: StudySpot | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('study_spots')
      .insert({
        ...input,
        created_by: userId,
        is_free: input.is_free ?? true,
        tags: input.tags ?? [],
        photo_urls: [],
      })
      .select(SPOT_SELECT_FIELDS)
      .single()
    return { data: (data as unknown as StudySpot | null) ?? null, error: error as PostgrestError | null }
  }

  async deleteById(spotId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('study_spots').delete().eq('id', spotId)
    return { error: error as PostgrestError | null }
  }

  // -------------------------------------------------------------------
  // CHECK-IN / CHECK-OUT
  // -------------------------------------------------------------------

  /**
   * Check-in do spotu. Jeśli user ma już aktywny check-in gdzie indziej,
   * najpierw wymeldowuje (caller może też świadomie wywołać `checkoutActive()`
   * z UI prompcie żeby user widział co się dzieje).
   */
  async checkIn(
    spotId: string,
    userId: string,
    mood: StudySpotMood = 'focus',
    comment?: string | null,
  ): Promise<{ data: StudySpotCheckin | null; error: PostgrestError | null }> {
    // Wymelduj poprzedni aktywny check-in jeśli istnieje (defense in depth
    // przed unique constraintem `WHERE checked_out_at IS NULL`).
    await this.checkoutActive(userId)

    const { data, error } = await supabase
      .from('study_spot_checkins')
      .insert({
        spot_id: spotId,
        user_id: userId,
        mood,
        comment: comment ?? null,
      })
      .select()
      .single()
    return {
      data: (data as unknown as StudySpotCheckin | null) ?? null,
      error: error as PostgrestError | null,
    }
  }

  async checkoutActive(userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('study_spot_checkins')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('checked_out_at', null)
    return { error: error as PostgrestError | null }
  }

  async checkoutById(checkinId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('study_spot_checkins')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', checkinId)
    return { error: error as PostgrestError | null }
  }

  /** Pokaż wszystkie aktywne check-iny dla danego spotu (live presence list). */
  async getActiveCheckinsForSpot(
    spotId: string,
  ): Promise<{ data: StudySpotCheckin[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('study_spot_checkins')
      .select('id, spot_id, user_id, mood, checked_in_at, checked_out_at, expires_at, comment')
      .eq('spot_id', spotId)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
    return {
      data: (data as unknown as StudySpotCheckin[]) ?? [],
      error: error as PostgrestError | null,
    }
  }

  // -------------------------------------------------------------------
  // RATINGS
  // -------------------------------------------------------------------

  async upsertRating(
    spotId: string,
    userId: string,
    overall: number,
    extra?: {
      wifi?: number | null
      silence?: number | null
      sockets?: number | null
      comfort?: number | null
      comment?: string | null
    },
  ): Promise<{ data: StudySpotRating | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('study_spot_ratings')
      .upsert(
        {
          spot_id: spotId,
          user_id: userId,
          overall,
          wifi: extra?.wifi ?? null,
          silence: extra?.silence ?? null,
          sockets: extra?.sockets ?? null,
          comfort: extra?.comfort ?? null,
          comment: extra?.comment ?? null,
        },
        { onConflict: 'spot_id,user_id' },
      )
      .select()
      .single()
    return {
      data: (data as unknown as StudySpotRating | null) ?? null,
      error: error as PostgrestError | null,
    }
  }

  async deleteRating(spotId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('study_spot_ratings')
      .delete()
      .eq('spot_id', spotId)
      .eq('user_id', userId)
    return { error: error as PostgrestError | null }
  }

  async getRatingsForSpot(
    spotId: string,
  ): Promise<{ data: StudySpotRating[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('study_spot_ratings')
      .select('id, spot_id, user_id, overall, wifi, silence, sockets, comfort, comment, created_at, updated_at')
      .eq('spot_id', spotId)
      .order('updated_at', { ascending: false })
    return {
      data: (data as unknown as StudySpotRating[]) ?? [],
      error: error as PostgrestError | null,
    }
  }

  // -------------------------------------------------------------------
  // ACTIVE CHECK-INS WITH PROFILES
  // -------------------------------------------------------------------

  /**
   * RPC `get_active_checkins_with_profiles` — kto teraz jest na spocie
   * + avatary/nazwiska, w jednym query (no N+1 dla profiles).
   */
  async getActiveCheckinsWithProfiles(
    spotId: string,
  ): Promise<{ data: ActiveCheckinWithProfile[]; error: PostgrestError | null }> {
    const { data, error } = await supabase.rpc('get_active_checkins_with_profiles', {
      p_spot_id: spotId,
    })
    return {
      data: (data ?? []) as ActiveCheckinWithProfile[],
      error: error as PostgrestError | null,
    }
  }

  // -------------------------------------------------------------------
  // PHOTOS (Supabase Storage)
  // -------------------------------------------------------------------

  /**
   * Upload zdjęcia do bucketu `study-spots-photos` + append `publicUrl`
   * do `study_spots.photo_urls`. Sanity-check `MAX_PHOTOS_PER_SPOT`
   * po stronie klienta (RLS i tak chroni przed bucketem-spamem).
   */
  async uploadPhoto(
    spotId: string,
    userId: string,
    file: File,
  ): Promise<{ publicUrl: string | null; error: string | null }> {
    const current = await this.getById(spotId)
    if (current.error) return { publicUrl: null, error: current.error.message }
    if (!current.data) return { publicUrl: null, error: 'Spot nie istnieje' }
    if (current.data.photo_urls.length >= MAX_PHOTOS_PER_SPOT) {
      return { publicUrl: null, error: `Maks. ${MAX_PHOTOS_PER_SPOT} zdjęć na miejsce` }
    }

    let uploaded
    try {
      uploaded = await uploadStudySpotPhoto(file, spotId, userId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload nie powiódł się'
      return { publicUrl: null, error: msg }
    }

    const next = [...current.data.photo_urls, uploaded.publicUrl]
    const { error: updErr } = await supabase
      .from('study_spots')
      .update({ photo_urls: next })
      .eq('id', spotId)
    if (updErr) {
      // Wyczyść osierocony plik
      void removeStudySpotPhoto(uploaded.publicUrl).catch(() => null)
      return { publicUrl: null, error: updErr.message }
    }
    return { publicUrl: uploaded.publicUrl, error: null }
  }

  async removePhoto(
    spotId: string,
    photoUrl: string,
  ): Promise<{ error: string | null }> {
    const current = await this.getById(spotId)
    if (current.error) return { error: current.error.message }
    if (!current.data) return { error: 'Spot nie istnieje' }

    const next = current.data.photo_urls.filter((u) => u !== photoUrl)
    const { error: updErr } = await supabase
      .from('study_spots')
      .update({ photo_urls: next })
      .eq('id', spotId)
    if (updErr) return { error: updErr.message }

    // Storage delete jest best-effort — jeśli RLS nie pozwoli, foto zostanie
    // sierotą w bucketcie. To akceptowalne (audit log + cleanup cron).
    try {
      await removeStudySpotPhoto(photoUrl)
    } catch {
      // ignore — array już bez tej referencji
    }
    return { error: null }
  }
}

export const StudySpotsService = new StudySpotsServiceImpl()
