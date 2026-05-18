import { Meilisearch } from 'meilisearch'
import type { SearchDocument, SearchHit } from '../types/search'

const DEFAULT_INDEX = 'ujverse_content'

let cachedClient: Meilisearch | null = null

function readSearchConfig() {
  const host = import.meta.env.VITE_MEILISEARCH_HOST?.trim() ?? ''
  const apiKey = import.meta.env.VITE_MEILISEARCH_SEARCH_KEY?.trim() ?? ''
  const index = import.meta.env.VITE_MEILISEARCH_INDEX?.trim() || DEFAULT_INDEX
  return { host, apiKey, index }
}

function getClient(): Meilisearch {
  if (cachedClient) return cachedClient
  const { host, apiKey } = readSearchConfig()
  if (!host || !apiKey) {
    throw new Error('Brakuje konfiguracji wyszukiwarki. Ustaw VITE_MEILISEARCH_HOST i VITE_MEILISEARCH_SEARCH_KEY.')
  }
  cachedClient = new Meilisearch({ host, apiKey })
  return cachedClient
}

type SearchOpts = {
  signal?: AbortSignal
  limit?: number
}

class SearchServiceImpl {
  async searchContent(query: string, opts?: SearchOpts): Promise<SearchHit[]> {
    const normalized = query.trim()
    if (normalized.length < 2) return []
    const { index } = readSearchConfig()
    const client = getClient()
    const response = await client.index<SearchDocument>(index).search(normalized, {
      limit: opts?.limit ?? 24,
      attributesToHighlight: ['content', 'author'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      signal: opts?.signal,
    })
    return (response.hits as SearchHit[]) ?? []
  }
}

export const SearchService = new SearchServiceImpl()
