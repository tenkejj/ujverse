import { instantMeiliSearch } from '@meilisearch/instant-meilisearch'

const DEFAULT_HOST = 'http://localhost:7700'
const DEFAULT_INDEX = 'ujverse_content'
const DEFAULT_API_KEY = 'admin'
export const USERS_INDEX = 'ujverse_users'

function readHost(): string {
  return import.meta.env.VITE_MEILISEARCH_HOST?.trim() || DEFAULT_HOST
}

function readApiKey(): string {
  // Front MOŻE używać wyłącznie search-only key — master/admin key wpadłby do bundla JS.
  return (
    import.meta.env.VITE_MEILISEARCH_SEARCH_KEY?.trim() ||
    DEFAULT_API_KEY
  )
}

export function readContentIndexName(): string {
  return import.meta.env.VITE_MEILISEARCH_INDEX?.trim() || DEFAULT_INDEX
}

const instant = instantMeiliSearch(readHost(), readApiKey(), {
  placeholderSearch: false,
  finitePagination: true,
})

export const { searchClient, meiliSearchInstance } = instant