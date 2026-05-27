import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import * as dotenv from 'dotenv'

import { ensureContentIndexSettings } from '../lib/meilisearchIndexSettings'
import {
  mapAnnouncementToSearchDocument,
  mapPostToSearchDocument,
  type AnnouncementRecord,
  type PostProfile,
  type SearchContentDocument,
} from '../lib/searchSyncMapper'
import { extractPostTags } from '../src/lib/postTags'

dotenv.config({ path: '.env.local' })

const BATCH_SIZE = 500

function requireEnv(name: string, fallbacks: readonly string[] = []): string {
  const candidates = [name, ...fallbacks]
  for (const candidate of candidates) {
    const value = process.env[candidate]?.trim()
    if (value) return value
  }
  throw new Error(`Missing env (tried: ${candidates.join(', ')})`)
}

function resolveEnv(names: readonly string[], fallback: string): string {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return fallback
}

const MEILI_HOST = resolveEnv(
  ['MEILISEARCH_HOST', 'VITE_MEILISEARCH_HOST'],
  'http://localhost:7700',
)
const MEILI_KEY = resolveEnv(
  [
    'MEILISEARCH_MASTER_KEY',
    'VITE_MEILISEARCH_MASTER_KEY',
    'MEILISEARCH_ADMIN_KEY',
  ],
  'admin',
)

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL'])
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const indexUid = resolveEnv(
    ['MEILISEARCH_INDEX', 'VITE_MEILISEARCH_INDEX'],
    'ujverse_content',
  )
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const meili = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY })
  await ensureContentIndexSettings(meili, indexUid)
  const index = meili.index(indexUid)

  let postsOffset = 0
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, tags, user_id, created_at, profiles(id, full_name, username, department, is_banned)')
      .order('id', { ascending: true })
      .range(postsOffset, postsOffset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    const docs: SearchContentDocument[] = rows
      .map((row) => {
        const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as PostProfile | null
        const dbTags = Array.isArray(row.tags) ? row.tags : []
        const tags =
          dbTags.length > 0
            ? dbTags
            : extractPostTags(typeof row.content === 'string' ? row.content : '')
        return mapPostToSearchDocument(
          {
            id: row.id,
            content: row.content,
            tags,
            user_id: row.user_id,
            created_at: row.created_at,
          },
          profile,
        )
      })
      .filter((doc): doc is SearchContentDocument => doc !== null)

    if (docs.length > 0) {
      await index.addDocuments(docs).waitTask()
    }
    postsOffset += BATCH_SIZE
    console.log(`[backfill-search] synced posts: ${postsOffset}`)
  }

  let announcementsOffset = 0
  while (true) {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, body, lecturer_name, department, source, status, created_at')
      .order('id', { ascending: true })
      .range(announcementsOffset, announcementsOffset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    const docs: SearchContentDocument[] = rows
      .map((row) =>
        mapAnnouncementToSearchDocument({
          id: row.id,
          body: row.body,
          lecturer_name: row.lecturer_name,
          department: row.department,
          source: row.source,
          status: row.status,
          created_at: row.created_at,
        } as AnnouncementRecord),
      )
      .filter((doc): doc is SearchContentDocument => doc !== null)

    if (docs.length > 0) {
      await index.addDocuments(docs).waitTask()
    }
    announcementsOffset += BATCH_SIZE
    console.log(`[backfill-search] synced announcements: ${announcementsOffset}`)
  }

  console.log('[backfill-search] done')
}

main().catch((error) => {
  console.error('[backfill-search] failed', error)
  process.exitCode = 1
})
