import type { Meilisearch } from 'meilisearch'

export const USERS_INDEX_UID = 'ujverse_users'

/** Pola przeszukiwalne w indeksie profili (Meilisearch). */
export const USERS_SEARCHABLE_ATTRIBUTES = ['username', 'fullName', 'department'] as const

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
