/**
 * UJverse — UsosRegistrationsService: CRUD + subscribe / dismiss alarmów.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Konwencje:
 *   - Wszystkie metody zwracają `{ data, error }` zgodnie z `DiscountsService` /
 *     `CohortService` — kompatybilne z istniejącymi hookami.
 *   - Subscribe / unsubscribe są pojedynczymi mutacjami (INSERT / DELETE).
 *   - `markDismissed` ustawia `dismissed_at = now()` — banner alarmu przestaje
 *     wyskakiwać, ale subskrypcja pozostaje (user dalej dostanie alarm
 *     gdy data startu się zmieni → reset można zrobić unsubscribe+subscribe).
 *   - RPC `get_my_upcoming_registrations` wraca subskrybowane "żywe"
 *     rejestracje (opens_at > now() - 1h) sortowane po opens_at.
 */
import { supabase } from '../supabaseClient'
import type { PostgrestError } from '@supabase/supabase-js'
import type {
  MyUpcomingRegistration,
  RegistrationFilter,
  RegistrationKind,
  UsosRegistration,
} from '../types/usosRegistrations'

const REGISTRATION_SELECT_FIELDS =
  'id, created_by, title, description, study_program, year, audience_label, opens_at, closes_at, registration_url, info_url, kind, subscriber_count, source_announcement_id, source_usos_tura_id, source_unit_code, source_label, created_at, updated_at'

class UsosRegistrationsServiceImpl {
  // -------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------

  async list(filter: RegistrationFilter, opts?: { studyProgram?: string | null; year?: number | null }): Promise<{
    data: UsosRegistration[]
    error: PostgrestError | null
  }> {
    let q = supabase.from('usos_registrations').select(REGISTRATION_SELECT_FIELDS)

    if (filter.kind !== 'all') q = q.eq('kind', filter.kind)

    if (filter.search.trim()) {
      const term = `%${filter.search.trim()}%`
      q = q.or(`title.ilike.${term},description.ilike.${term},audience_label.ilike.${term}`)
    }

    if (filter.myProgramOnly && opts?.studyProgram) {
      // Pokazuj rejestracje dla mojego programu LUB ogólne (study_program is null)
      q = q.or(`study_program.eq.${opts.studyProgram},study_program.is.null`)
      if (opts.year != null) {
        // Pokazuj dopasowane rok-w-rok LUB bez roku (ogólne)
        q = q.or(`year.eq.${opts.year},year.is.null`)
      }
    }

    switch (filter.sort) {
      case 'subscribers':
        q = q.order('subscriber_count', { ascending: false }).order('opens_at', { ascending: true })
        break
      case 'created':
        q = q.order('created_at', { ascending: false })
        break
      case 'opens':
      default:
        q = q.order('opens_at', { ascending: true })
        break
    }

    q = q.limit(200)
    const { data, error } = await q
    return { data: (data ?? []) as UsosRegistration[], error }
  }

  async getById(id: string): Promise<{ data: UsosRegistration | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('usos_registrations')
      .select(REGISTRATION_SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle()
    return { data: (data as UsosRegistration | null) ?? null, error }
  }

  /** Set ID-ków subskrybowanych przez user'a — do oznaczenia "Subskrybujesz" w UI. */
  async getMySubscribedIds(userId: string): Promise<{ data: Set<string>; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('usos_registration_subscriptions')
      .select('registration_id')
      .eq('user_id', userId)
    if (error) return { data: new Set(), error }
    const set = new Set<string>()
    for (const row of (data ?? []) as Array<{ registration_id: string }>) {
      set.add(row.registration_id)
    }
    return { data: set, error: null }
  }

  /** RPC: nadchodzące subskrypcje (niedismissed, opens_at > now-1h). */
  async getMyUpcoming(userId: string): Promise<{
    data: MyUpcomingRegistration[]
    error: PostgrestError | null
  }> {
    const { data, error } = await supabase.rpc('get_my_upcoming_registrations', { p_user_id: userId })
    if (error) return { data: [], error }
    return { data: (data ?? []) as MyUpcomingRegistration[], error: null }
  }

  // -------------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------------

  async create(payload: {
    createdBy: string
    title: string
    description?: string | null
    studyProgram?: string | null
    year?: number | null
    audienceLabel?: string | null
    opensAt: string
    closesAt?: string | null
    registrationUrl: string
    infoUrl?: string | null
    kind: RegistrationKind
  }): Promise<{ data: UsosRegistration | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('usos_registrations')
      .insert({
        created_by: payload.createdBy,
        title: payload.title,
        description: payload.description ?? null,
        study_program: payload.studyProgram ?? null,
        year: payload.year ?? null,
        audience_label: payload.audienceLabel ?? null,
        opens_at: payload.opensAt,
        closes_at: payload.closesAt ?? null,
        registration_url: payload.registrationUrl,
        info_url: payload.infoUrl ?? null,
        kind: payload.kind,
      })
      .select(REGISTRATION_SELECT_FIELDS)
      .single()
    return { data: (data as UsosRegistration | null) ?? null, error }
  }

  async update(id: string, patch: Partial<{
    title: string
    description: string | null
    studyProgram: string | null
    year: number | null
    audienceLabel: string | null
    opensAt: string
    closesAt: string | null
    registrationUrl: string
    infoUrl: string | null
    kind: RegistrationKind
  }>): Promise<{ data: UsosRegistration | null; error: PostgrestError | null }> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.title !== undefined) dbPatch.title = patch.title
    if (patch.description !== undefined) dbPatch.description = patch.description
    if (patch.studyProgram !== undefined) dbPatch.study_program = patch.studyProgram
    if (patch.year !== undefined) dbPatch.year = patch.year
    if (patch.audienceLabel !== undefined) dbPatch.audience_label = patch.audienceLabel
    if (patch.opensAt !== undefined) dbPatch.opens_at = patch.opensAt
    if (patch.closesAt !== undefined) dbPatch.closes_at = patch.closesAt
    if (patch.registrationUrl !== undefined) dbPatch.registration_url = patch.registrationUrl
    if (patch.infoUrl !== undefined) dbPatch.info_url = patch.infoUrl
    if (patch.kind !== undefined) dbPatch.kind = patch.kind

    const { data, error } = await supabase
      .from('usos_registrations')
      .update(dbPatch)
      .eq('id', id)
      .select(REGISTRATION_SELECT_FIELDS)
      .single()
    return { data: (data as UsosRegistration | null) ?? null, error }
  }

  async delete(id: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('usos_registrations').delete().eq('id', id)
    return { error }
  }

  // -------------------------------------------------------------------
  // SUBSCRIPTIONS
  // -------------------------------------------------------------------

  async subscribe(registrationId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('usos_registration_subscriptions')
      .insert({ registration_id: registrationId, user_id: userId })
    return { error }
  }

  async unsubscribe(registrationId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('usos_registration_subscriptions')
      .delete()
      .eq('registration_id', registrationId)
      .eq('user_id', userId)
    return { error }
  }

  /** "Dzięki, wiem" — banner nie wyskoczy ale subskrypcja zostaje. */
  async markDismissed(registrationId: string, userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('usos_registration_subscriptions')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('registration_id', registrationId)
      .eq('user_id', userId)
    return { error }
  }
}

export const UsosRegistrationsService = new UsosRegistrationsServiceImpl()
