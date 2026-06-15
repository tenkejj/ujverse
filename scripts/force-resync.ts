import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import * as dotenv from 'dotenv'

import { activeAnnouncementCutoff } from '../src/lib/announcementRecency.ts';
import { extractPostTags } from '../src/lib/postTags.ts';
import { 
  ensureContentIndexSettings, 
  ensureUsersIndexSettings, 
  USERS_INDEX_UID 
} from '../lib/meilisearchIndexSettings';
import { 
  mapAnnouncementToSearchDocument,
  mapPostToSearchDocument,
  mapProfileToSearchDocument,
  type ProfileRecord,
  type SearchContentDocument,
  type SearchUserDocument,
} from '../lib/searchSyncMapper';
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

async function wipeIndex(indexUid: string, label: string): Promise<void> {
  const index = meili.index(indexUid)
  const before = await index.getStats()
  console.log(`[force-resync] ${label} — dokumenty przed czyszczeniem: ${before.numberOfDocuments}`)
  const wiped = await index.deleteAllDocuments().waitTask()
  if (wiped.status !== 'succeeded') {
    throw new Error(`[force-resync] ${label} — deleteAllDocuments nie powiodło się: ${wiped.status}`)
  }
  const after = await index.getStats()
  console.log(`[force-resync] ${label} — indeks wyczyszczony (pozostało: ${after.numberOfDocuments}).`)
}

async function collectPostDocuments(): Promise<SearchContentDocument[]> {
  const documents: SearchContentDocument[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, tags, user_id, created_at, profiles(id, full_name, username, department, is_banned)')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const dbTags = Array.isArray(row.tags) ? row.tags : []
      const tags =
        dbTags.length > 0 ? dbTags : extractPostTags(typeof row.content === 'string' ? row.content : '')
      const doc = mapPostToSearchDocument(
        {
          id: row.id,
          content: row.content,
          tags,
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
  const cutoffIso = activeAnnouncementCutoff().toISOString()
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('announcements')
      .select(
        'id, body, full_body, title, lecturer_name, department, source, source_kind, source_url, status, created_at',
      )
      .gte('created_at', cutoffIso)
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

async function collectProfileDocuments(): Promise<SearchUserDocument[]> {
  const documents: SearchUserDocument[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, department, is_banned, is_searchable')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const doc = mapProfileToSearchDocument(row as ProfileRecord)
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

async function pushUserDocuments(documents: SearchUserDocument[]): Promise<void> {
  if (documents.length === 0) {
    console.log('[force-resync] Brak profili do wepchnięcia do ujverse_users.')
    return
  }
  const index = meili.index(USERS_INDEX_UID)
  const finished = await index.addDocuments(documents, { primaryKey: 'id' }).waitTask()
  if (finished.status !== 'succeeded') {
    console.error('[force-resync] Task Meili (ujverse_users) NIE zakończony sukcesem:', finished)
    process.exitCode = 1
    return
  }
  console.log(`[force-resync] Wepchnięto ${documents.length} profilów do ujverse_users.`)
}

async function main(): Promise<void> {
  console.log(`[force-resync] Supabase: ${SUPABASE_URL}`)
  console.log(`[force-resync] Meilisearch: ${MEILI_HOST}, index="${INDEX_UID}"`)

  await ensureIndex()
  await ensureContentIndexSettings(meili, INDEX_UID)
  await ensureUsersIndexSettings(meili)
  console.log('[force-resync] Indeks treści: filterableAttributes type, department, tags, announcementStatus.')
  console.log('[force-resync] Indeks użytkowników: searchableAttributes username, fullName, department.')
  await wipeIndex(INDEX_UID, 'ujverse_content')
  await wipeIndex(USERS_INDEX_UID, 'ujverse_users')

  const [posts, announcements, profiles] = await Promise.all([
    collectPostDocuments(),
    collectAnnouncementDocuments(),
    collectProfileDocuments(),
  ])

  console.log(
    `[force-resync] Zebrano z bazy: ${posts.length} postów, ${announcements.length} komunikatów, ${profiles.length} profili.`,
  )

  await pushDocuments([...posts, ...announcements])
  await pushUserDocuments(profiles)

  const contentStats = await meili.index(INDEX_UID).getStats()
  const usersStats = await meili.index(USERS_INDEX_UID).getStats()
  console.log(`[force-resync] ujverse_content — dokumenty po imporcie: ${contentStats.numberOfDocuments}`)
  console.log(`[force-resync] ujverse_users — dokumenty po imporcie: ${usersStats.numberOfDocuments}`)
  console.log('[force-resync] Gotowe.')
}

main().catch((error) => {
  console.error('[force-resync] BŁĄD:', error)
  process.exit(1)
})
