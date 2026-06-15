import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import * as dotenv from 'dotenv'

import {
  mapAnnouncementToSearchDocument,
  mapPostToSearchDocument,
  type SearchContentDocument,
} from '../lib/searchSyncMapper'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const MEILI_HOST =
  process.env.MEILISEARCH_HOST?.trim() ||
  process.env.VITE_MEILISEARCH_HOST?.trim() ||
  'http://localhost:7700'
const MEILI_KEY =
  process.env.MEILISEARCH_MASTER_KEY?.trim() ||
  process.env.VITE_MEILISEARCH_MASTER_KEY?.trim() ||
  process.env.MEILISEARCH_ADMIN_KEY?.trim() ||
  'admin'
const INDEX_UID =
  process.env.MEILISEARCH_INDEX?.trim() ||
  process.env.VITE_MEILISEARCH_INDEX?.trim() ||
  'ujverse_content'
const BATCH_SIZE = 500
const MEILI_PAGE_SIZE = 1000
const POLL_INTERVAL_MS = Number(process.env.SYNC_LISTENER_INTERVAL_MS) || 2000

if (!SUPABASE_URL) {
  console.error('❌ BŁĄD: Brak VITE_SUPABASE_URL (lub SUPABASE_URL) w .env.local')
  process.exit(1)
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ BŁĄD: Brak SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY })

async function ensureIndex(): Promise<void> {
  try {
    await meili.getIndex(INDEX_UID)
  } catch {
    console.log(
      `[sync-listener] Indeks "${INDEX_UID}" nie istnieje — tworzę z primaryKey="id".`,
    )
    await meili.createIndex(INDEX_UID, { primaryKey: 'id' }).waitTask()
  }
}

async function collectPostDocuments(): Promise<SearchContentDocument[]> {
  const documents: SearchContentDocument[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select(
        'id, content, user_id, created_at, profiles(id, full_name, username, department, is_banned)',
      )
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const doc = mapPostToSearchDocument(
        {
          id: row.id,
          content: row.content,
          user_id: row.user_id,
          created_at: row.created_at,
        },
        profile ?? null,
      )
      if (doc) documents.push(doc)
    }

    offset += BATCH_SIZE
    if (rows.length < BATCH_SIZE) break
  }
  return documents
}

async function collectAnnouncementDocuments(): Promise<SearchContentDocument[]> {
  const documents: SearchContentDocument[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('announcements')
      .select(
        'id, body, full_body, title, lecturer_name, department, source, source_kind, source_url, status, created_at',
      )
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01' || /does not exist/i.test(error.message)) {
        return documents
      }
      throw error
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const doc = mapAnnouncementToSearchDocument({
        id: row.id,
        body: row.body,
        full_body: row.full_body,
        title: row.title,
        lecturer_name: row.lecturer_name,
        department: row.department,
        source: row.source,
        source_kind: row.source_kind,
        source_url: row.source_url,
        status: row.status,
        created_at: row.created_at,
      })
      if (doc) documents.push(doc)
    }

    offset += BATCH_SIZE
    if (rows.length < BATCH_SIZE) break
  }
  return documents
}

async function collectMeiliDocumentIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const index = meili.index(INDEX_UID)
  let offset = 0
  while (true) {
    const page = await index.getDocuments<{ id: string }>({
      limit: MEILI_PAGE_SIZE,
      offset,
      fields: ['id'],
    })
    for (const doc of page.results) {
      if (typeof doc.id === 'string' && doc.id.length > 0) {
        ids.add(doc.id)
      }
    }
    if (page.results.length < MEILI_PAGE_SIZE) break
    offset += MEILI_PAGE_SIZE
  }
  return ids
}

let cycleInFlight = false
let firstCycleLogged = false

async function runSyncCycle(): Promise<void> {
  if (cycleInFlight) return
  cycleInFlight = true
  try {
    const [posts, announcements] = await Promise.all([
      collectPostDocuments(),
      collectAnnouncementDocuments(),
    ])
    const expected = [...posts, ...announcements]
    const expectedById = new Map<string, SearchContentDocument>()
    for (const doc of expected) expectedById.set(doc.id, doc)

    const existingIds = await collectMeiliDocumentIds()

    const toAdd: SearchContentDocument[] = []
    for (const doc of expected) {
      if (!existingIds.has(doc.id)) toAdd.push(doc)
    }

    const toRemove: string[] = []
    for (const id of existingIds) {
      if (!expectedById.has(id)) toRemove.push(id)
    }

    const index = meili.index(INDEX_UID)

    if (toRemove.length > 0) {
      console.log(
        `[sync-listener] 🗑️  Usuwam ${toRemove.length} nieaktualnych dokumentów (przestarzałe ID / zbanowani / usunięte).`,
      )
      await index.deleteDocuments(toRemove).waitTask()
    }

    if (toAdd.length > 0) {
      console.log(
        `[sync-listener] 📥 Dorzucam ${toAdd.length} nowych dokumentów (post-/announcement-).`,
      )
      await index.addDocuments(toAdd, { primaryKey: 'id' }).waitTask()
    }

    if (!firstCycleLogged) {
      console.log(
        `[sync-listener] ✅ Pierwszy cykl OK. Baza: ${expected.length} (posty: ${posts.length}, komunikaty: ${announcements.length}). Meili: ${existingIds.size}.`,
      )
      firstCycleLogged = true
    }
  } catch (err) {
    console.error('[sync-listener] ❌ Błąd cyklu synchronizacji:', err)
    if (err instanceof Error) console.error('   ', err.message)
  } finally {
    cycleInFlight = false
  }
}

async function main(): Promise<void> {
  console.log('🚀 UJverse State-Diff Search Sync uruchomiony...')
  console.log(`[sync-listener] Supabase: ${SUPABASE_URL}`)
  console.log(`[sync-listener] Meilisearch: ${MEILI_HOST}, index="${INDEX_UID}"`)

  await ensureIndex()
  await runSyncCycle()
  setInterval(runSyncCycle, POLL_INTERVAL_MS)
}

main().catch((err) => {
  console.error('[sync-listener] ❌ BŁĄD krytyczny przy starcie:', err)
  process.exit(1)
})
