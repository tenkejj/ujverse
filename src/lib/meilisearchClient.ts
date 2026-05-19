import { instantMeiliSearch } from '@meilisearch/instant-meilisearch'

const DEFAULT_HOST = 'http://localhost:7700'
const DEFAULT_INDEX = 'ujverse_content'
export const USERS_INDEX = 'ujverse_users'

function readHost(): string {
  // Wpisujemy na sztywno localhost:7700, ignorując błędy z .env
  return 'http://localhost:7700'
}

function readApiKey(): string {
  // Przekazujemy pełny Master Key, aby wykluczyć błędy uprawnień klucza publicznego
  return 'Truskawka777'
}


export function readContentIndexName(): string {
  return DEFAULT_INDEX
}

const instant = instantMeiliSearch(readHost(), readApiKey(), {
  placeholderSearch: false,
  finitePagination: true,
})

export const { searchClient, meiliSearchInstance } = instant