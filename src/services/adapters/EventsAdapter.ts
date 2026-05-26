import type { UJEvent } from '../../data/mockEvents'
import {
  escapeIlikePattern,
  eventFromDbRow,
  eventMatchesTextQuery,
  EVENTS_WITH_AUTHOR_SELECT,
  mergeEventLists,
  startOfTodayIso,
} from '../../lib/eventRow'
import { UjverseSanitizer } from '../../lib/sanitizer'
import { hydrateOfficialEventsFromStorage } from '../EventIngestor'
import { supabase } from '../../supabaseClient'
import type { EventMeta, UnifiedContent } from '../../types/content'
import type { ContentAdapter } from './BaseAdapter'

/**
 * Opcje wyszukiwania wydarzeń.
 *
 * `includePast` jest świadomie wyłączone z `searchDb` / `searchOfficialCache`:
 * gdy użytkownik jawnie wpisuje frazę, oczekuje trafień niezależnie od daty.
 * Pole zostaje dla kompatybilności z `listByUserId` (profil), gdzie ma sens.
 */
export type EventSearchOpts = {
  limit?: number
  includePast?: boolean
}

/**
 * Adapter wydarzeń.
 *
 * Źródło: Supabase `events`, cache oficjalnych z EventIngestor, kontekst UI.
 * Mapuje `UJEvent` -> `UnifiedContent<EventMeta>`; wyszukiwanie hybrydowe DB + ingest.
 */
class EventsAdapterImpl implements ContentAdapter<UJEvent, EventMeta> {
  readonly type = 'event' as const

  /**
   * Wyszukiwanie tekstowe w `public.events`.
   *
   * Świadomie BEZ filtra daty: gdy użytkownik jawnie szuka frazy, oczekuje
   * trafień niezależnie od tego, czy wydarzenie minęło. Czystość głównego
   * widoku (lista nadchodzących) jest pilnowana po stronie `refetchDbEvents`
   * w `useEvents.ts`, a nie tu.
   */
  async searchDb(query: string, opts?: EventSearchOpts): Promise<UJEvent[]> {
    const normalized = query.trim()
    if (normalized.length < 2) return []

    const pattern = escapeIlikePattern(normalized)
    const orFilter = `title.ilike.%${pattern}%,description.ilike.%${pattern}%,location.ilike.%${pattern}%`

    const limit = opts?.limit ?? 24
    const { data, error } = await supabase
      .from('events')
      .select(EVENTS_WITH_AUTHOR_SELECT)
      .or(orFilter)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[EventsAdapter.searchDb] error', { query: normalized, error })
      }
      throw new Error(error.message)
    }

    const rawRows = data ?? []
    const mapped = rawRows
      .map(eventFromDbRow)
      .filter((e): e is UJEvent => e !== null)

    if (import.meta.env.DEV) {
      console.log('[EventsAdapter.searchDb]', {
        query: normalized,
        rawCount: rawRows.length,
        mappedCount: mapped.length,
        mappedTitles: mapped.map((e) => e.title),
      })
    }

    return mapped
  }

  searchOfficialCache(query: string, opts?: EventSearchOpts): UJEvent[] {
    const normalized = query.trim()
    if (normalized.length < 2) return []

    const limit = opts?.limit ?? 24
    const cache = hydrateOfficialEventsFromStorage()
    const matched = cache.filter((ev) => eventMatchesTextQuery(ev, normalized))
    const result = matched.slice(0, limit)

    if (import.meta.env.DEV) {
      console.log('[EventsAdapter.searchOfficialCache]', {
        query: normalized,
        cacheSize: cache.length,
        matchedCount: matched.length,
        returnedCount: result.length,
        matchedTitles: matched.map((e) => e.title),
      })
    }

    return result
  }

  mergeSearchResults(db: UJEvent[], cache: UJEvent[], limit = 24): UJEvent[] {
    return mergeEventLists([db, cache]).slice(0, limit)
  }

  async search(query: string, opts?: EventSearchOpts): Promise<UJEvent[]> {
    const limit = opts?.limit ?? 24
    const [db, cache] = await Promise.all([
      this.searchDb(query, opts).catch(() => [] as UJEvent[]),
      Promise.resolve(this.searchOfficialCache(query, opts)),
    ])
    return this.mergeSearchResults(db, cache, limit)
  }

  async fetchById(id: string): Promise<UJEvent | null> {
    const { data, error } = await supabase
      .from('events')
      .select(EVENTS_WITH_AUTHOR_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      throw new Error(error.message)
    }
    if (data) {
      const row = eventFromDbRow(data)
      if (row) return row
    }
    const fromCache = hydrateOfficialEventsFromStorage().find((ev) => ev.id === id)
    return fromCache ?? null
  }

  async listByUserId(userId: string, opts?: { includePast?: boolean }): Promise<UJEvent[]> {
    const includePast = opts?.includePast ?? true
    let builder = supabase
      .from('events')
      .select(EVENTS_WITH_AUTHOR_SELECT)
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (!includePast) {
      builder = builder.gte('date', startOfTodayIso())
    }

    const { data, error } = await builder
    if (error) {
      throw new Error(error.message)
    }
    return (data ?? []).map(eventFromDbRow).filter((e): e is UJEvent => e !== null)
  }

  toUnified(raw: UJEvent): UnifiedContent<EventMeta> | null {
    if (!raw.id || !raw.title) return null
    const title = UjverseSanitizer.normalizeTypography(raw.title)
    const body = UjverseSanitizer.cleanBody(raw.description)
    const isOfficial = Boolean(raw.is_official)

    const authorSubtitle = raw.faculty ?? raw.source_name ?? null
    const profileName = raw.author?.full_name?.trim()
    const profileHandle = raw.author?.username?.trim().replace(/^@+/, '')
    const authorFromProfile = profileName || (profileHandle ? `@${profileHandle}` : null)
    const authorDisplayName = authorFromProfile
      ? UjverseSanitizer.cleanAuthor(authorFromProfile) || authorFromProfile
      : null

    const actions: UnifiedContent<EventMeta>['actions'] = []
    if (raw.event_url) {
      actions.push({
        id: 'event-source',
        label: 'Strona wydarzenia',
        kind: 'link',
        href: raw.event_url,
      })
    }
    if (raw.mapUrl) {
      actions.push({ id: 'event-map', label: 'Mapa', kind: 'link', href: raw.mapUrl })
    }

    return {
      id: raw.id,
      type: 'event',
      title,
      author: {
        id: raw.author?.id ?? (raw.user_id ? `user:${raw.user_id}` : `event:${raw.id}`),
        displayName:
          authorDisplayName ??
          (isOfficial ? (raw.source_name ?? 'Uniwersytet Jagielloński') : 'Użytkownik'),
        subtitle: authorSubtitle,
        avatarUrl: raw.author?.avatar_url ?? null,
      },
      body,
      timestamp: raw.date instanceof Date ? raw.date.toISOString() : null,
      badges: isOfficial
        ? [
            {
              label: raw.faculty === 'WZiKS' ? 'WZiKS' : 'UJ',
              tone: 'gold',
              title: raw.source_name ?? undefined,
            },
          ]
        : [],
      metadata: {
        date: raw.date instanceof Date ? raw.date.toISOString() : new Date().toISOString(),
        location: raw.location,
        category: raw.category,
        isOfficial,
        faculty: raw.faculty ?? null,
        imageUrl: raw.imageUrl ?? null,
        attendees: raw.attendees,
        isAttending: raw.isAttending,
        externalId: raw.external_id ?? null,
        sourceName: raw.source_name ?? null,
        eventUrl: raw.event_url ?? null,
        mapUrl: raw.mapUrl ?? null,
        attendeeAvatars: raw.attendeeAvatars,
        ingestFromFallback: raw.ingest_from_fallback,
        authorUserId: raw.user_id ?? null,
      },
      actions,
    }
  }

  toUnifiedList(events: UJEvent[]): UnifiedContent<EventMeta>[] {
    const out: UnifiedContent<EventMeta>[] = []
    for (const e of events) {
      const uc = this.toUnified(e)
      if (uc) out.push(uc)
    }
    return out
  }
}

export const EventsAdapter = new EventsAdapterImpl()
