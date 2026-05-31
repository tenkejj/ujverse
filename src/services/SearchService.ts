import type { Profile } from '../types'
import type { SearchHit, SearchUserHit } from '../types/search'
import { normalizeContentHit, normalizeUserHit } from '../lib/normalizeSearchHits'
import { parseTagSearchQuery } from '../lib/postTags'
import { meiliSearchInstance, readContentIndexName, USERS_INDEX } from '../lib/meilisearchClient'

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
}

export const SearchService = new SearchServiceImpl()
