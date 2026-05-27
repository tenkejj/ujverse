import type { Meilisearch } from 'meilisearch'

export const USERS_INDEX_UID = 'ujverse_users'
export const CONTENT_INDEX_UID = 'ujverse_content'

/** Pola przeszukiwalne w indeksie profili (Meilisearch). */
export const USERS_SEARCHABLE_ATTRIBUTES = ['username', 'fullName', 'department'] as const

/** Pola filtrowalne w indeksie treści (posty + komunikaty). */
export const CONTENT_FILTERABLE_ATTRIBUTES = [
  'type',
  'department',
  'tags',
  'announcementStatus',
] as const

/**
 * Tworzy indeks użytkowników (jeśli brak) i ustawia searchableAttributes,
 * w tym department — umożliwia wyszukiwanie po wydziale (np. „developer”).
 */
export async function ensureUsersIndexSettings(client: Meilisearch): Promise<void> {
  try {
    await client.getIndex(USERS_INDEX_UID)
  } catch {
    await client.createIndex(USERS_INDEX_UID, { primaryKey: 'id' }).waitTask()
  }

  const index = client.index(USERS_INDEX_UID)
  await index.updateSearchableAttributes([...USERS_SEARCHABLE_ATTRIBUTES]).waitTask()
}

/**
 * Tworzy indeks treści (jeśli brak) i ustawia filterableAttributes,
 * w tym tags — umożliwia filtrowanie postów po hashtagu (#ankieta).
 */
export async function ensureContentIndexSettings(
  client: Meilisearch,
  indexUid: string = CONTENT_INDEX_UID,
): Promise<void> {
  try {
    await client.getIndex(indexUid)
  } catch {
    await client.createIndex(indexUid, { primaryKey: 'id' }).waitTask()
  }

  const index = client.index(indexUid)
  await index.updateFilterableAttributes([...CONTENT_FILTERABLE_ATTRIBUTES]).waitTask()
}
