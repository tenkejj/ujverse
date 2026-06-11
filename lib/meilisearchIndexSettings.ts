import type { Meilisearch } from 'meilisearch'

export const USERS_INDEX_UID = 'ujverse_users'
export const CONTENT_INDEX_UID = 'ujverse_content'
export const AULA_INDEX_UID = 'ujverse_aula'

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
 * Pola przeszukiwalne w indeksie wiadomości Auli — kolejność = priorytet
 * Meilisearch przy rankingu domyślnym ("attribute" rule).
 */
export const AULA_SEARCHABLE_ATTRIBUTES = ['content', 'authorName', 'fileNames'] as const

/**
 * Pola filtrowalne — `cohortId` jest MANDATORY do izolacji rocznika;
 * publiczny search-key Meili nie ma RLS, więc filtr na froncie jest jedynym
 * mechanizmem prywatności.
 */
export const AULA_FILTERABLE_ATTRIBUTES = [
  'cohortId',
  'channelId',
  'channelKind',
  'authorId',
  'hasAttachments',
  'createdAtTs',
] as const

/** Sortable po dacie — recency-first listing w UI. */
export const AULA_SORTABLE_ATTRIBUTES = ['createdAtTs'] as const

/**
 * Ranking rules: domyślny pipeline Meili + `createdAtTs:desc` jako ostatni
 * tie-breaker (przy równym relevance preferuj nowsze wiadomości).
 */
export const AULA_RANKING_RULES = [
  'words',
  'typo',
  'proximity',
  'attribute',
  'sort',
  'exactness',
  'createdAtTs:desc',
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

/**
 * Tworzy indeks wiadomości Auli i ustawia atrybuty wyszukiwania, filtrowania
 * i sortowania. Wywoływane lazy z `api/sync-search.ts` przy pierwszym zapisie
 * do indeksu (analogicznie do `ensureContentIndexSettings`).
 */
export async function ensureAulaIndexSettings(
  client: Meilisearch,
  indexUid: string = AULA_INDEX_UID,
): Promise<void> {
  try {
    await client.getIndex(indexUid)
  } catch {
    await client.createIndex(indexUid, { primaryKey: 'id' }).waitTask()
  }

  const index = client.index(indexUid)
  await Promise.all([
    index.updateSearchableAttributes([...AULA_SEARCHABLE_ATTRIBUTES]).waitTask(),
    index.updateFilterableAttributes([...AULA_FILTERABLE_ATTRIBUTES]).waitTask(),
    index.updateSortableAttributes([...AULA_SORTABLE_ATTRIBUTES]).waitTask(),
    index.updateRankingRules([...AULA_RANKING_RULES]).waitTask(),
  ])
}
