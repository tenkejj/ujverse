import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  documentIdFor,
  mapAnnouncementToSearchDocument,
  mapPostToSearchDocument,
  type AnnouncementRecord,
  type PostProfile,
  type PostRecord,
  type SearchSyncDocument,
  type SearchSyncTable,
} from '../_shared/searchMapper.ts'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

const SEARCH_TABLES = new Set<SearchSyncTable>(['posts', 'announcements'])

function readSecret(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Brakuje sekretu ${name}`)
  return value
}

async function meiliFetch(path: string, init: RequestInit): Promise<Response> {
  const host = readSecret('MEILISEARCH_HOST')
  const adminKey = readSecret('MEILISEARCH_ADMIN_KEY')
  return fetch(`${host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

async function ensureIndex(indexUid: string): Promise<void> {
  const response = await meiliFetch('/indexes', {
    method: 'POST',
    body: JSON.stringify({ uid: indexUid, primaryKey: 'id' }),
  })
  if (response.ok || response.status === 409) return
  const body = await response.text()
  throw new Error(`Nie udało się utworzyć indeksu: ${body}`)
}

async function upsertDocument(indexUid: string, document: SearchSyncDocument): Promise<void> {
  let response = await meiliFetch(`/indexes/${encodeURIComponent(indexUid)}/documents`, {
    method: 'POST',
    body: JSON.stringify([document]),
  })
  if (response.status === 404) {
    await ensureIndex(indexUid)
    response = await meiliFetch(`/indexes/${encodeURIComponent(indexUid)}/documents`, {
      method: 'POST',
      body: JSON.stringify([document]),
    })
  }
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Błąd upsertu dokumentu: ${body}`)
  }
}

async function deleteDocument(indexUid: string, documentId: string): Promise<void> {
  const response = await meiliFetch(
    `/indexes/${encodeURIComponent(indexUid)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
  // Meilisearch może zwrócić 404 gdy dokumentu nie ma. To bezpieczny no-op.
  if (response.ok || response.status === 404) return
  const body = await response.text()
  throw new Error(`Błąd usuwania dokumentu: ${body}`)
}

function parsePayload(raw: unknown): WebhookPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as WebhookPayload
  if (!payload.type || !payload.table || payload.schema !== 'public') return null
  if (payload.type !== 'INSERT' && payload.type !== 'UPDATE' && payload.type !== 'DELETE') return null
  return payload
}

async function fetchPostProfile(userId: string): Promise<PostProfile | null> {
  const supabaseUrl = readSecret('SUPABASE_URL')
  const serviceKey = readSecret('SUPABASE_SERVICE_ROLE_KEY')
  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, username, department, is_banned')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as PostProfile
}

async function mapUpsertDocument(payload: WebhookPayload): Promise<SearchSyncDocument | null> {
  if (payload.table === 'announcements') {
    return mapAnnouncementToSearchDocument((payload.record ?? {}) as AnnouncementRecord)
  }

  if (payload.table === 'posts') {
    const record = (payload.record ?? {}) as PostRecord
    const userId = typeof record.user_id === 'string' ? record.user_id : null
    const profile = userId ? await fetchPostProfile(userId) : null
    return mapPostToSearchDocument(record, profile)
  }

  return null
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const webhookSecret = readSecret('SYNC_WEBHOOK_SECRET')
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${webhookSecret}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const parsed = parsePayload(await req.json())
    if (!parsed) return new Response('Invalid payload', { status: 400 })
    if (!SEARCH_TABLES.has(parsed.table as SearchSyncTable)) {
      return Response.json({ ok: false, error: 'Unsupported table' }, { status: 400 })
    }

    const indexUid = Deno.env.get('MEILISEARCH_INDEX')?.trim() || 'ujverse_content'
    const activeRecord = parsed.type === 'DELETE' ? parsed.old_record : parsed.record
    const sourceId = String(activeRecord?.id ?? '').trim()
    if (!sourceId) return new Response('Missing row id', { status: 400 })

    if (parsed.type === 'DELETE') {
      const docId = documentIdFor(parsed.table as SearchSyncTable, sourceId)
      await deleteDocument(indexUid, docId)
      return Response.json({ ok: true, action: 'delete', id: docId })
    }

    const document = await mapUpsertDocument(parsed)
    if (!document) {
      // rekord niekompletny lub zbanowany autor — usuwamy ewentualny stary wpis z indeksu
      const docId = documentIdFor(parsed.table as SearchSyncTable, sourceId)
      await deleteDocument(indexUid, docId)
      return Response.json({ ok: true, action: 'delete', id: docId })
    }

    await upsertDocument(indexUid, document)
    return Response.json({ ok: true, action: 'upsert', id: document.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[sync-search] error:', message)
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
})
