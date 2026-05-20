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
const MEILI_HOST = process.env.MEILISEARCH_HOST?.trim() || 'http://localhost:7700'
const MEILI_KEY =
  process.env.MEILISEARCH_ADMIN_KEY?.trim() || process.env.MEILISEARCH_MASTER_KEY?.trim() || 'Truskawka777'
const INDEX_UID = process.env.MEILISEARCH_INDEX?.trim() || 'ujverse_content'
const BATCH_SIZE = 500

if (!SUPABASE_URL) {
  console.error('BŁĄD: Brak VITE_SUPABASE_URL (lub SUPABASE_URL) w .env.local')
  process.exit(1)
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('BŁĄD: Brak SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY })

async function ensureIndex(): Promise<void> {
  try {
    await meili.getIndex(INDEX_UID)
    console.log(`[force-resync] Indeks "${INDEX_UID}" istnieje.`)
  } catch {
    console.log(`[force-resync] Indeks "${INDEX_UID}" nie istnieje — tworzę z primaryKey="id".`)
    await meili.createIndex(INDEX_UID, { primaryKey: 'id' }).waitTask()
  }
}

async function wipeIndex(): Promise<void> {
  const index = meili.index(INDEX_UID)
  const stats = await index.getStats()
  console.log(`[force-resync] Dokumenty w indeksie przed czyszczeniem: ${stats.numberOfDocuments}`)
  if (stats.numberOfDocuments === 0) return
  await index.deleteAllDocuments().waitTask()
  console.log('[force-resync] Indeks wyczyszczony.')
}

async function collectPostDocuments(): Promise<SearchContentDocument[]> {
  const documents: SearchContentDocument[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, user_id, created_at, profiles(id, full_name, username, department, is_banned)')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const doc = mapPostToSearchDocument(
        { id: row.id, content: row.content, user_id: row.user_id, created_at: row.created_at },
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
      .select('id, body, lecturer_name, department, created_at')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      // Brak tabeli "announcements" w bazie to nie jest błąd krytyczny dla skryptu.
      const code = (error as { code?: string }).code
      if (code === '42P01' || /does not exist/i.test(error.message)) {
        console.warn('[force-resync] Tabela "announcements" nie istnieje — pomijam komunikaty.')
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
        lecturer_name: row.lecturer_name,
        department: row.department,
        created_at: row.created_at,
      })
      if (doc) documents.push(doc)
    }

    offset += BATCH_SIZE
    if (rows.length < BATCH_SIZE) break
  }
  return documents
}

async function pushDocuments(documents: SearchContentDocument[]): Promise<void> {
  if (documents.length === 0) {
    console.log('[force-resync] Nic do wepchnięcia.')
    return
  }
  const index = meili.index(INDEX_UID)
  const finished = await index.addDocuments(documents, { primaryKey: 'id' }).waitTask()
  if (finished.status !== 'succeeded') {
    console.error('[force-resync] Task Meili NIE zakończony sukcesem:', finished)
    process.exitCode = 1
    return
  }
  console.log(`[force-resync] Wepchnięto ${documents.length} dokumentów (task ${finished.uid}).`)
}

async function main(): Promise<void> {
  console.log(`[force-resync] Supabase: ${SUPABASE_URL}`)
  console.log(`[force-resync] Meilisearch: ${MEILI_HOST}, index="${INDEX_UID}"`)

  await ensureIndex()
  await wipeIndex()

  const [posts, announcements] = await Promise.all([
    collectPostDocuments(),
    collectAnnouncementDocuments(),
  ])

  console.log(
    `[force-resync] Zebrano z bazy: ${posts.length} postów, ${announcements.length} komunikatów.`,
  )

  await pushDocuments([...posts, ...announcements])

  const finalStats = await meili.index(INDEX_UID).getStats()
  console.log(`[force-resync] Dokumenty w indeksie po imporcie: ${finalStats.numberOfDocuments}`)
  console.log('[force-resync] Gotowe.')
}

main().catch((error) => {
  console.error('[force-resync] BŁĄD:', error)
  process.exit(1)
})
