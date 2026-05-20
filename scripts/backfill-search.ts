import { createClient } from '@supabase/supabase-js'

type SearchDocument = {
  id: string
  sourceId: string
  type: 'post' | 'komunikat'
  content: string
  author: string
  authorId?: string | null
  department?: string | null
  createdAt: string
}

const BATCH_SIZE = 500

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

async function meiliUpsertDocuments(indexUid: string, docs: SearchDocument[]) {
  if (docs.length === 0) return
  const host = requireEnv('MEILISEARCH_HOST')
  const key = requireEnv('MEILISEARCH_ADMIN_KEY')
  const response = await fetch(`${host}/indexes/${encodeURIComponent(indexUid)}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(docs),
  })
  if (response.ok) return
  if (response.status === 404) {
    const createResponse = await fetch(`${host}/indexes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: indexUid, primaryKey: 'id' }),
    })
    if (!createResponse.ok && createResponse.status !== 409) {
      throw new Error(`Could not create index: ${await createResponse.text()}`)
    }
    await meiliUpsertDocuments(indexUid, docs)
    return
  }
  throw new Error(`Meilisearch upsert failed: ${await response.text()}`)
}

function postDocumentId(id: string | number): string {
  return `post-${String(id)}`
}

function announcementDocumentId(id: string | number): string {
  return `announcement-${String(id)}`
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const indexUid = process.env.MEILISEARCH_INDEX?.trim() || 'ujverse_content'
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let postsOffset = 0
  while (true) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, content, user_id, created_at, profiles(id, full_name, username, department, is_banned)')
      .order('id', { ascending: true })
      .range(postsOffset, postsOffset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    const docs: SearchDocument[] = rows
      .map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        if (profile?.is_banned === true) return null
        const content = typeof row.content === 'string' ? row.content.trim() : ''
        if (!content) return null
        const sourceId = String(row.id)
        return {
          id: postDocumentId(sourceId),
          sourceId,
          type: 'post' as const,
          content,
          author: profile?.full_name?.trim() || profile?.username?.trim() || 'Użytkownik',
          authorId: typeof row.user_id === 'string' ? row.user_id : null,
          department: profile?.department ?? null,
          createdAt: row.created_at ?? new Date().toISOString(),
        }
      })
      .filter((doc): doc is SearchDocument => doc !== null)

    await meiliUpsertDocuments(indexUid, docs)
    postsOffset += BATCH_SIZE
    console.log(`[backfill-search] synced posts: ${postsOffset}`)
  }

  let announcementsOffset = 0
  while (true) {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, body, lecturer_name, department, created_at')
      .order('id', { ascending: true })
      .range(announcementsOffset, announcementsOffset + BATCH_SIZE - 1)

    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    const docs: SearchDocument[] = rows
      .map((row) => {
        const content = typeof row.body === 'string' ? row.body.trim() : ''
        const author = typeof row.lecturer_name === 'string' ? row.lecturer_name.trim() : ''
        if (!content || !author) return null
        const sourceId = String(row.id)
        return {
          id: announcementDocumentId(sourceId),
          sourceId,
          type: 'komunikat' as const,
          content,
          author,
          department: typeof row.department === 'string' ? row.department : null,
          createdAt: row.created_at ?? new Date().toISOString(),
        }
      })
      .filter((doc): doc is SearchDocument => doc !== null)

    await meiliUpsertDocuments(indexUid, docs)
    announcementsOffset += BATCH_SIZE
    console.log(`[backfill-search] synced announcements: ${announcementsOffset}`)
  }

  console.log('[backfill-search] done')
}

main().catch((error) => {
  console.error('[backfill-search] failed', error)
  process.exitCode = 1
})
