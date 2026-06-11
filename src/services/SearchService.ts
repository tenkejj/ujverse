import type { Profile } from '../types'
import type { ChannelKind } from '../types/database'
import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'
import { normalizeAulaHit, normalizeContentHit, normalizeUserHit } from '../lib/normalizeSearchHits'
import { parseTagSearchQuery } from '../lib/postTags'
import {
  AULA_INDEX,
  meiliSearchInstance,
  readContentIndexName,
  USERS_INDEX,
} from '../lib/meilisearchClient'

type SearchOpts = {
  signal?: AbortSignal
  limit?: number
}

type UnifiedSearchOpts = SearchOpts & {
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
 * UWAGA — IZOLACJA ROCZNIKA:
 *   Meilisearch public search-key NIE ma RLS jak Supabase Postgres. Pole
 *   `cohortId` w `AulaSearchOpts` jest **MANDATORY** — bez niego user mógłby
 *   przeszukać cudze roczniki (front sprawdza, że wiadomości należą tylko
 *   do jego cohortu). Pobieraj `cohortId` z zaufanej ścieżki (`useMyCohort`),
 *   nigdy z URL / params od usera.
 */
export type AulaSearchOpts = SearchOpts & {
  cohortId: string
  authorId?: string
  hasAttachments?: boolean
  /**
   * Sub-channel filter. Konwencja:
   *   - `undefined` = bez filtru po kanale (cała Aula danego cohortu)
   *   - `null` = tylko #general (`channelId NOT EXISTS` w Meili)
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
   *     bo Sala główna nie ma `channelKind` w Meili.
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

  async searchUsers(query: string, opts?: SearchOpts & { department?: string }): Promise<SearchUserHit[]> {
    const { users } = await this.searchUnified(query, {
      ...opts,
      includeUsers: true,
      includeContent: false,
      userDepartmentFilter: opts?.department,
    })
    return users
  }

  async searchProfiles(query: string, opts?: SearchOpts & { department?: string }): Promise<Profile[]> {
    const users = await this.searchUsers(query, opts)
    return users.map(mapUserHitToProfile)
  }

  async searchUnified(query: string, opts?: UnifiedSearchOpts): Promise<UnifiedSearchResults> {
    const normalized = query.trim()
    const parsed = parseTagSearchQuery(normalized)
    const tagFilter = opts?.tag?.trim().toLowerCase() || parsed.tag
    const textQuery = parsed.textQuery

    if (!tagFilter && normalized.length < 2) {
      return { content: [], users: [] }
    }

    const limit = opts?.limit ?? 24
    const includeContent = opts?.includeContent !== false
    const includeUsers = tagFilter ? false : opts?.includeUsers !== false
    const indexName = readContentIndexName()
    const contentQuery = tagFilter && !textQuery ? '' : textQuery || normalized

    const queries: Parameters<typeof meiliSearchInstance.multiSearch>[0]['queries'] = []

    if (includeContent) {
      const escapedTag = tagFilter?.replaceAll('"', '\\"')
      queries.push({
        indexUid: indexName,
        q: contentQuery,
        limit,
        filter: escapedTag ? `tags = "${escapedTag}"` : undefined,
        attributesToHighlight: ['content', 'author', 'title'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      })
    }

    if (includeUsers) {
      queries.push({
        indexUid: USERS_INDEX,
        q: normalized,
        limit,
        filter: opts?.userDepartmentFilter
          ? `department = "${opts.userDepartmentFilter.replaceAll('"', '\\"')}"`
          : undefined,
        attributesToHighlight: ['fullName', 'username', 'department'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      })
    }

    if (queries.length === 0) {
      return { content: [], users: [] }
    }

    const response = await meiliSearchInstance.multiSearch(
      { queries },
      opts?.signal ? { signal: opts.signal } : undefined,
    )

    let content: SearchHit[] = []
    let users: SearchUserHit[] = []

    let resultOffset = 0
    if (includeContent) {
      const rawHits = response.results[resultOffset]?.hits ?? []
      content = rawHits
        .map((hit) => normalizeContentHit(hit as Record<string, unknown>))
        .filter((hit: SearchHit | null): hit is SearchHit => hit != null)
      resultOffset += 1
    }

    if (includeUsers) {
      const rawHits = response.results[resultOffset]?.hits ?? []
      users = rawHits
        .map((hit) => normalizeUserHit(hit as Record<string, unknown>))
        .filter((hit: SearchUserHit | null): hit is SearchUserHit => hit != null)
    }

    return { content, users }
  }

  /**
   * Wyszukiwanie w indeksie `ujverse_aula`. **Wymaga `cohortId`** — to jedyna
   * gwarancja izolacji rocznika (Meili public key nie ma RLS).
   *
   * Pusta `query` zwraca pusty wynik (nie wala do Meili), bo `?q=&filter=...`
   * w Meili oznacza "wszystko w tym cohortcie" — UX-owo niepożądane dla
   * "search-as-you-type". Filtrowanie listingiem to inny use-case (Faza 2).
   */
  async searchAula(query: string, opts: AulaSearchOpts): Promise<AulaSearchResults> {
    const cohortId = opts.cohortId?.trim()
    const trimmed = query.trim()
    if (!cohortId || trimmed.length === 0) {
      return { hits: [], estimatedTotalHits: 0 }
    }

    const escape = (v: string) => v.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    const filters: string[] = [`cohortId = "${escape(cohortId)}"`]
    if (opts.authorId) filters.push(`authorId = "${escape(opts.authorId)}"`)
    if (opts.hasAttachments === true) filters.push('hasAttachments = true')
    if (opts.channelId === null) {
      // #general — wiadomości bez channel_id. Meili "NOT EXISTS" odpowiada
      // dokumentom gdzie pola nie ma; dla istniejących dokumentów z
      // `channelId: null` używamy `channelId IS NULL` (`= null` nie działa).
      // Aby objąć oba przypadki: NOT EXISTS lub `IS NULL`.
      filters.push('(channelId IS NULL OR channelId NOT EXISTS)')
    } else if (typeof opts.channelId === 'number' && Number.isFinite(opts.channelId)) {
      filters.push(`channelId = ${opts.channelId}`)
    } else if (Array.isArray(opts.channelKinds) && opts.channelKinds.length > 0) {
      // Kind filter aktywny tylko gdy `channelId === undefined` (cohort-wide).
      const sanitized = Array.from(new Set(opts.channelKinds)).map(
        (k) => `"${escape(k)}"`,
      )
      filters.push(`channelKind IN [${sanitized.join(',')}]`)
    }
    if (typeof opts.since === 'number' && Number.isFinite(opts.since)) {
      filters.push(`createdAtTs >= ${Math.floor(opts.since)}`)
    }

    const response = await meiliSearchInstance.multiSearch(
      {
        queries: [
          {
            indexUid: AULA_INDEX,
            q: trimmed,
            limit: opts.limit ?? 20,
            offset: opts.offset ?? 0,
            filter: filters.join(' AND '),
            sort: ['createdAtTs:desc'],
            attributesToHighlight: ['content', 'fileNames'],
            attributesToCrop: ['content'],
            cropLength: 30,
            highlightPreTag: '<mark>',
            highlightPostTag: '</mark>',
          },
        ],
      },
      opts.signal ? { signal: opts.signal } : undefined,
    )

    const result = response.results[0]
    const rawHits = result?.hits ?? []
    const hits = rawHits
      .map((hit) => normalizeAulaHit(hit as Record<string, unknown>))
      .filter((hit): hit is AulaSearchHit => hit != null)

    const estimatedTotalHits =
      (result as { estimatedTotalHits?: number; totalHits?: number } | undefined)
        ?.estimatedTotalHits ??
      (result as { totalHits?: number } | undefined)?.totalHits ??
      hits.length

    return { hits, estimatedTotalHits }
  }
}

export const SearchService = new SearchServiceImpl()
