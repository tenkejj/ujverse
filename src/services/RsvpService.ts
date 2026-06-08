/**
 * RsvpService — warstwa danych dla `public.event_rsvps`.
 *
 * Tabela ma `event_id TEXT` (mix UUID + `ext:ingest:...` + `local-*`), więc
 * service operuje na string ID — zgodnie z `UJEvent.id` w warstwie aplikacji.
 *
 * RLS:
 *   - SELECT: każdy zalogowany
 *   - INSERT/DELETE: tylko własny RSVP (`user_id = auth.uid()`)
 *
 * Endpoint-y:
 *   - `getMyRsvpIds()` — Set<eventId> dla zalogowanego usera (hydratacja `isAttending`)
 *   - `getCountsByEventIds(ids)` — Map<eventId, count> dla wielu (hydratacja `attendees`)
 *   - `getAttendeesForEvent(id)` — lista profili (do modala uczestników)
 *   - `rsvp(eventId)` — INSERT
 *   - `cancelRsvp(eventId)` — DELETE
 */

import { supabase } from '../supabaseClient'
import type { Profile } from '../types'

/** Profil uczestnika w liście (subset Profile pod kartę modala). */
export type RsvpAttendeeProfile = Pick<
  Profile,
  'id' | 'full_name' | 'username' | 'avatar_url' | 'department'
>

export type RsvpAttendee = {
  user_id: string
  created_at: string
  profile: RsvpAttendeeProfile | null
}

type RsvpJoinRow = {
  user_id: string
  created_at: string
  profiles: RsvpAttendeeProfile | RsvpAttendeeProfile[] | null
}

const PROFILES_JOIN =
  'profiles!event_rsvps_user_id_fkey(id, full_name, username, avatar_url, department)'

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

function normalizeProfile(raw: RsvpJoinRow['profiles']): RsvpAttendeeProfile | null {
  if (!raw) return null
  const p = Array.isArray(raw) ? raw[0] : raw
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return null
  return {
    id: p.id,
    full_name: p.full_name ?? null,
    username: p.username ?? null,
    avatar_url: p.avatar_url ?? null,
    department: p.department ?? null,
  }
}

export const RsvpService = {
  /** Set<eventId>, do których zalogowany user się zapisał. Pusty Set bez sesji. */
  async getMyRsvpIds(): Promise<Set<string>> {
    const userId = await currentUserId()
    if (!userId) return new Set()
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('event_id')
      .eq('user_id', userId)
    if (error) {
      console.error('[RsvpService] getMyRsvpIds error', error)
      return new Set()
    }
    return new Set(
      (data ?? [])
        .map((r) => (typeof r.event_id === 'string' ? r.event_id : null))
        .filter((id): id is string => id !== null),
    )
  },

  /** `Record<eventId, count>` dla zestawu eventów. Pomija nieistniejące klucze. */
  async getCountsByEventIds(eventIds: string[]): Promise<Record<string, number>> {
    if (eventIds.length === 0) return {}
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('event_id')
      .in('event_id', eventIds)
    if (error) {
      console.error('[RsvpService] getCountsByEventIds error', error)
      return {}
    }
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const id = typeof row.event_id === 'string' ? row.event_id : null
      if (!id) continue
      counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  },

  /** Lista uczestników jednego wydarzenia, posortowana od najstarszego zapisu. */
  async getAttendeesForEvent(eventId: string): Promise<RsvpAttendee[]> {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select(`user_id, created_at, ${PROFILES_JOIN}`)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[RsvpService] getAttendeesForEvent error', error)
      return []
    }
    return (data as unknown as RsvpJoinRow[] | null ?? []).map((row) => ({
      user_id: row.user_id,
      created_at: row.created_at,
      profile: normalizeProfile(row.profiles),
    }))
  },

  /** Toggle ON. Zwraca `{ error: null }` przy sukcesie (duplikat PK liczymy jako sukces). */
  async rsvp(eventId: string): Promise<{ error: string | null }> {
    const userId = await currentUserId()
    if (!userId) return { error: 'Brak sesji' }
    const { error } = await supabase
      .from('event_rsvps')
      .insert({ event_id: eventId, user_id: userId })
    if (error) {
      // 23505 = unique_violation (już zapisany) — idempotentnie OK
      if (error.code === '23505') return { error: null }
      console.error('[RsvpService] rsvp error', error)
      return { error: error.message }
    }
    return { error: null }
  },

  /** Toggle OFF. Brak rekordu jest sukcesem (idempotent). */
  async cancelRsvp(eventId: string): Promise<{ error: string | null }> {
    const userId = await currentUserId()
    if (!userId) return { error: 'Brak sesji' }
    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId)
    if (error) {
      console.error('[RsvpService] cancelRsvp error', error)
      return { error: error.message }
    }
    return { error: null }
  },
}
