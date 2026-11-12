import type { Profile } from '../types'
import type { ChannelKind } from '../types/database'
import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'
import { parseTagSearchQuery } from '../lib/postTags'
import { supabase } from '../supabaseClient'
import { normalizeSearchQuery, toIlikePattern } from '../lib/info/search'
import { boundedSearchLimit } from '../lib/searchPolicy'
import {
  searchAnnouncementsFallback,
  searchAulaFallback,
  searchUnifiedFallback,
} from './searchFallback'

type SearchOpts = {
  signal?: AbortSignal
  limit?: number
}

export type UnifiedSearchOpts = SearchOpts & {
  includeUsers?: boolean
  includeContent?: boolean
  userDepartmentFilter?: string
  /** Filtruj posty po Smart Tag (np. z `#ankieta`). */
  tag?: string
}

export type UnifiedSearchResults = {
  content: SearchHit[]
  users: SearchUserHit[]
}

/**
 * cohortId narrows the search, but never authorizes it. Supabase verifies the
 * request JWT and cohort membership through RLS before returning messages.
 */
export type AulaSearchOpts = SearchOpts & {
  cohortId: string
  authorId?: string
  hasAttachments?: boolean
  /**
   * Sub-channel filter. Konwencja:
   *   - `undefined` = bez filtru po kanale (cała Aula danego cohortu)
   *   - `null` = tylko #general (`channel_id IS NULL` w bazie)
   *   - `number` = konkretny sub-kanał
   *
   * Use case: `AulaSearchModal` z toggle "Tylko ten kanał" przekazuje
   * `activeChannelId` (number lub null jeśli #general).
   */
  channelId?: number | null
  /**
   * Filter po typach zajęć (multi-select OR). Pusty/undefined = bez filtru.
   *
   * Mutex z `channelId`:
   *   - Gdy `channelId` jest konkretnym number → kind filter ignorujemy
   *     (jeden konkretny kanał i tak ma jednoznaczny `kind`).
   *   - Gdy `channelId === null` (#general / Sala główna) → też ignorujemy,
   *     bo Sala główna nie ma `channelKind` w danych.
   *   - Gdy `channelId === undefined` → kind filter działa cohort-wide.
   */
  channelKinds?: ChannelKind[]
  /** Unix seconds — `createdAtTs >= since`. */
  since?: number
  offset?: number
}

export type AulaSearchResults = {
  hits: AulaSearchHit[]
  estimatedTotalHits: number
}

function mapUserHitToProfile(hit: SearchUserHit): Profile {
  return {
    id: hit.id,
    full_name: hit.fullName ?? hit.username ?? 'Użytkownik',
    username: hit.username,
    avatar_url: hit.avatarUrl,
    department: hit.department,
  }
}

class SearchServiceImpl {
  async searchContent(query: string, opts?: SearchOpts): Promise<SearchHit[]> {
    const { content } = await this.searchUnified(query, {
      ...opts,
      includeUsers: false,
      includeContent: true,
    })
    return content
  }

  /** Public announcements only, read through the normal anon/session RLS client. */
  async searchAnnouncementIds(
    query: string,
    opts?: SearchOpts & { departments?: readonly string[] },
  ): Promise<string[]> {
    const pattern = toIlikePattern(query)
    if (!pattern) return []
    let request = supabase
      .from('announcements')
      .select('id')
      .or(
        `title.ilike.${pattern},body.ilike.${pattern},lecturer_name.ilike.${pattern}`,
      )
      .order('created_at', { ascending: false })
      .limit(boundedSearchLimit(opts?.limit, 20))
    if (opts?.departments?.length)
      request = request.in('department', [...opts.departments])
    if (opts?.signal) request = request.abortSignal(opts.signal)
    const { data, error } = await request
    if (error) throw error
    return (data ?? []).flatMap((row) =>
      typeof row.id === 'string' ? [row.id] : [],
    )
  }

  async searchUsers(
    query: string,
    opts?: SearchOpts & { department?: string },
  ): Promise<SearchUserHit[]> {
    const { users } = await this.searchUnified(query, {
      ...opts,
      includeUsers: true,
      includeContent: false,
      userDepartmentFilter: opts?.department,
    })
    return users
  }

  async searchProfiles(
    query: string,
    opts?: SearchOpts & { department?: string },
  ): Promise<Profile[]> {
    const users = await this.searchUsers(query, opts)
    return users.map(mapUserHitToProfile)
  }

  async searchUnified(
    query: string,
    opts?: UnifiedSearchOpts,
  ): Promise<UnifiedSearchResults> {
    const normalized = normalizeSearchQuery(query)
    const parsed = parseTagSearchQuery(normalized)
    const tagFilter = opts?.tag?.trim().toLowerCase() || parsed.tag
    const textQuery = parsed.textQuery
    if (!tagFilter && !toIlikePattern(normalized))
      return { content: [], users: [] }
    const safeOpts = { ...opts, limit: boundedSearchLimit(opts?.limit, 24) }

    // This guard avoids requesting account data for guests; PostgREST RLS is
    // the independent authorization boundary and verifies the actual JWT.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return {
        content:
          opts?.includeContent === false || tagFilter
            ? []
            : await searchAnnouncementsFallback(
                supabase,
                normalized,
                safeOpts.limit,
                opts?.signal,
              ),
        users: [],
      }
    }
    return searchUnifiedFallback(supabase, normalized, safeOpts, tagFilter, textQuery)
  }

  /** Search member-only Aula rows using the session JWT and database RLS. */
  async searchAula(
    query: string,
    opts: AulaSearchOpts,
  ): Promise<AulaSearchResults> {
    const cohortId = opts.cohortId?.trim()
    const normalized = normalizeSearchQuery(query)
    if (!cohortId || !toIlikePattern(normalized))
      return { hits: [], estimatedTotalHits: 0 }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return { hits: [], estimatedTotalHits: 0 }
    return searchAulaFallback(supabase, normalized, {
      ...opts,
      cohortId,
      limit: boundedSearchLimit(opts.limit, 20),
    })
  }
}

export const SearchService = new SearchServiceImpl()
