/**
 * scripts/resync-search-final.ts
 *
 * Samodzielny skrypt resync postów (Supabase -> Meilisearch ujverse_content) z
 * naciskiem na pole `tags`. Świadomie zero importów z `lib/` ani `src/` — cała
 * logika (mapper, parser hashtagów, ensure-settings) jest wklejona inline, żeby
 * uniknąć błędu `ERR_MODULE_NOT_FOUND` w trybie ESM Node'a.
 *
 * Uruchomienie:
 *   npx tsx scripts/resync-search-final.ts
 *
 * Wymagane zmienne środowiskowe (z `.env` lub `.env.local`):
 *   SUPABASE_URL              (fallback: VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_KEY      (fallback: SUPABASE_SERVICE_ROLE_KEY)
 *   MEILISEARCH_HOST          (fallback: VITE_MEILISEARCH_HOST, default: http://localhost:7700)
 *   MEILISEARCH_MASTER_KEY    (fallback: MEILI_MASTER_KEY / VITE_MEILISEARCH_MASTER_KEY, default: "admin")
 *   MEILISEARCH_INDEX         (fallback: VITE_MEILISEARCH_INDEX, default: "ujverse_content")
 */

import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import * as dotenv from 'dotenv'

// ────────────────────────────────────────────────────────────────────────────
// 1. Wczytanie env (najpierw `.env`, potem `.env.local` jako override)
// ────────────────────────────────────────────────────────────────────────────

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
).trim()

const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim()

const MEILI_HOST = (
  process.env.MEILISEARCH_HOST ||
  process.env.VITE_MEILISEARCH_HOST ||
  'http://localhost:7700'
).trim()

const MEILI_KEY = (
  process.env.MEILISEARCH_MASTER_KEY ||
  process.env.MEILI_MASTER_KEY ||
  process.env.VITE_MEILISEARCH_MASTER_KEY ||
  'admin'
).trim()

const INDEX_UID = (
  process.env.MEILISEARCH_INDEX ||
  process.env.VITE_MEILISEARCH_INDEX ||
  'ujverse_content'
).trim()

const BATCH_SIZE = 500

if (!SUPABASE_URL) {
  console.error('[resync] BŁĄD: brak SUPABASE_URL / VITE_SUPABASE_URL w .env')
  process.exit(1)
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('[resync] BŁĄD: brak SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY w .env')
  process.exit(1)
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Lokalne typy + logika mapowania (kopia z `lib/searchSyncMapper.ts` i
//    `src/lib/postTags.ts`, świadomie zduplikowane, żeby skrypt nie zależał
//    od ścieżek relatywnych do `src/`/`lib/`).
// ────────────────────────────────────────────────────────────────────────────

type PostRow = {
  id: string | number
  content: string | null
  tags: string[] | null
  user_id: string | null
  created_at: string | null
  profiles: PostProfile | PostProfile[] | null
}

type PostProfile = {
  id: string | null
  full_name: string | null
  username: string | null
  department: string | null
  is_banned: boolean | null
}

type SearchContentDocument = {
  id: string
  sourceId: string
  type: 'post'
  content: string
  author: string
  authorId: string | null
  department: string | null
  createdAt: string
  tags: string[]
}

const HASHTAG_RE = /#([a-zA-Z0-9_]+)/g

/** Wyciągnij unikalne lowercase'owe hashtagi z treści (bez prefiksu `#`). */
function extractPostTagsFromContent(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(HASHTAG_RE)) {
    if (m[1]) found.push(m[1].toLowerCase())
  }
  return [...new Set(found)]
}

/**
 * Defensywna normalizacja tablicy tagów z DB:
 *  - tylko stringi (type-guard),
 *  - trim + lowercase,
 *  - bez pustych po trim,
 *  - deduplikacja.
 */
function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return [
    ...new Set(
      input
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

function normalizeDate(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return new Date().toISOString()
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function selectProfile(joined: PostRow['profiles']): PostProfile | null {
  if (!joined) return null
  if (Array.isArray(joined)) return joined[0] ?? null
  return joined
}

function mapPostToSearchDocument(row: PostRow): SearchContentDocument | null {
  const sourceId = String(row.id ?? '').trim()
  const content = (row.content ?? '').trim()
  if (!sourceId || !content) return null

  const profile = selectProfile(row.profiles)
  if (profile?.is_banned === true) return null

  const author =
    profile?.full_name?.trim() || profile?.username?.trim() || 'Użytkownik'

  // Najpierw normalizowane tagi z kolumny `posts.tags`. Jeśli pusto (np. stare
  // posty sprzed wprowadzenia kolumny lub bez backfillu), wyłuskaj #hashtagi
  // bezpośrednio z `content` — celem skryptu jest, by każdy post miał
  // poprawnie zindeksowane `tags`, niezależnie od stanu DB.
  const dbTags = normalizeTags(row.tags)
  const tags = dbTags.length > 0 ? dbTags : extractPostTagsFromContent(content)

  return {
    id: `post-${sourceId}`,
    sourceId,
    type: 'post',
    content,
    author,
    authorId: profile?.id ?? row.user_id ?? null,
    department: profile?.department?.trim() || null,
    createdAt: normalizeDate(row.created_at),
    tags,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Klienci + ustawienia indeksu
// ────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY })

/** Pola filtrowalne w indeksie treści — bez `tags` Meili odrzuci filtr `#tag`. */
const CONTENT_FILTERABLE_ATTRIBUTES = [
  'type',
  'department',
  'tags',
  'announcementStatus',
] as const

async function ensureContentIndex(): Promise<void> {
  try {
    await meili.getIndex(INDEX_UID)
    console.log(`[resync] Indeks "${INDEX_UID}" istnieje.`)
  } catch {
    console.log(`[resync] Indeks "${INDEX_UID}" nie istnieje — tworzę z primaryKey="id".`)
    await meili.createIndex(INDEX_UID, { primaryKey: 'id' }).waitTask()
  }

  const index = meili.index(INDEX_UID)
  const task = await index
    .updateFilterableAttributes([...CONTENT_FILTERABLE_ATTRIBUTES])
    .waitTask()
  if (task.status !== 'succeeded') {
    throw new Error(
      `[resync] updateFilterableAttributes nie powiodło się: ${task.status} / ${JSON.stringify(task.error)}`,
    )
  }
  console.log(
    `[resync] filterableAttributes: [${CONTENT_FILTERABLE_ATTRIBUTES.join(', ')}].`,
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Pobranie postów (batch) + zebranie dokumentów
// ────────────────────────────────────────────────────────────────────────────

type CollectResult = {
  documents: SearchContentDocument[]
  totalRows: number
  withDbTags: number
  withFallbackTags: number
  withoutAnyTags: number
}

async function collectPostDocuments(): Promise<CollectResult> {
  const documents: SearchContentDocument[] = []
  let totalRows = 0
  let withDbTags = 0
  let withFallbackTags = 0
  let withoutAnyTags = 0
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, content, tags, user_id, created_at, profiles(id, full_name, username, department, is_banned)',
      )
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = (data ?? []) as unknown as PostRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      totalRows += 1
      const dbTagCount = normalizeTags(row.tags).length
      const doc = mapPostToSearchDocument(row)
      if (!doc) continue
      documents.push(doc)
      if (dbTagCount > 0) {
        withDbTags += 1
      } else if (doc.tags.length > 0) {
        withFallbackTags += 1
      } else {
        withoutAnyTags += 1
      }
    }

    console.log(
      `[resync] Pobrano ${rows.length} postów (offset ${offset}, łącznie ${totalRows}).`,
    )

    offset += BATCH_SIZE
    if (rows.length < BATCH_SIZE) break
  }

  return { documents, totalRows, withDbTags, withFallbackTags, withoutAnyTags }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Upsert do Meilisearch w paczkach
// ────────────────────────────────────────────────────────────────────────────

async function upsertDocuments(documents: SearchContentDocument[]): Promise<void> {
  if (documents.length === 0) {
    console.log('[resync] Brak dokumentów do upsertu.')
    return
  }
  const index = meili.index(INDEX_UID)

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const chunk = documents.slice(i, i + BATCH_SIZE)
    const finished = await index
      .addDocuments(chunk, { primaryKey: 'id' })
      .waitTask()
    if (finished.status !== 'succeeded') {
      console.error('[resync] Task Meili NIE zakończony sukcesem:', finished)
      process.exitCode = 1
      return
    }
    console.log(
      `[resync] Upsert paczki ${i / BATCH_SIZE + 1}: ${chunk.length} dokumentów (task ${finished.uid}).`,
    )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Main
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[resync] Supabase: ${SUPABASE_URL}`)
  console.log(`[resync] Meilisearch: ${MEILI_HOST}, index="${INDEX_UID}"`)

  await ensureContentIndex()

  const result = await collectPostDocuments()
  console.log(
    `[resync] Posty łącznie: ${result.totalRows} | indeksowanych: ${result.documents.length} | DB tags: ${result.withDbTags} | fallback z #content: ${result.withFallbackTags} | bez tagów: ${result.withoutAnyTags}`,
  )

  await upsertDocuments(result.documents)

  const stats = await meili.index(INDEX_UID).getStats()
  console.log(
    `[resync] ujverse_content — łączna liczba dokumentów po imporcie: ${stats.numberOfDocuments}`,
  )

  // Szybka kontrola sanity: jeśli były posty z tagami, spróbuj filtru po
  // pierwszym napotkanym tagu. Pomaga wykryć, czy filterableAttributes
  // faktycznie zaczęły obowiązywać przed pierwszym zapytaniem aplikacji.
  const sampleTag = result.documents.find((doc) => doc.tags.length > 0)?.tags[0]
  if (sampleTag) {
    const sample = await meili.index(INDEX_UID).search('', {
      filter: `tags = "${sampleTag.replaceAll('"', '\\"')}"`,
      limit: 1,
    })
    console.log(
      `[resync] Sanity check: filter tags = "${sampleTag}" zwraca estimatedTotalHits=${sample.estimatedTotalHits ?? sample.hits.length}.`,
    )
  } else {
    console.log('[resync] Sanity check pominięty — żaden post nie miał tagów.')
  }

  console.log('[resync] Gotowe.')
}

main().catch((error: unknown) => {
  console.error('[resync] BŁĄD:', error)
  process.exit(1)
})
