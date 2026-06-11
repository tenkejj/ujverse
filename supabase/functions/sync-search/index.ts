import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  aulaDocumentIdForMessage,
  documentIdFor,
  mapAnnouncementToSearchDocument,
  mapCohortMessageToSearchDocument,
  mapPostToSearchDocument,
  type AnnouncementRecord,
  type CohortAttachmentRecord,
  type CohortChannelRecord,
  type CohortMessageAuthor,
  type CohortMessageRecord,
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

const SEARCH_TABLES = new Set<SearchSyncTable>([
  'posts',
  'announcements',
  'cohort_messages',
  'cohort_message_attachments',
])

const AULA_INDEX_UID = 'ujverse_aula'

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

function getAdminClient() {
  const supabaseUrl = readSecret('SUPABASE_URL')
  const serviceKey = readSecret('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceKey)
}

async function fetchPostProfile(userId: string): Promise<PostProfile | null> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, username, department, is_banned')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as PostProfile
}

async function fetchCohortMessageAuthor(userId: string): Promise<CohortMessageAuthor | null> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, username, is_banned')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortMessageAuthor
}

async function fetchAttachmentsForMessage(messageId: number | string): Promise<CohortAttachmentRecord[]> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('cohort_message_attachments')
    .select('id, message_id, file_name')
    .eq('message_id', messageId)
  if (error || !data) return []
  return data as CohortAttachmentRecord[]
}

async function fetchCohortMessageById(messageId: number | string): Promise<CohortMessageRecord | null> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('cohort_messages')
    .select('id, cohort_id, user_id, parent_id, channel_id, content, created_at, deleted_at')
    .eq('id', messageId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortMessageRecord
}

async function fetchChannelById(channelId: number | string): Promise<CohortChannelRecord | null> {
  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('cohort_channels')
    .select('id, slug, name, kind')
    .eq('id', channelId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortChannelRecord
}

async function buildAulaDocumentForMessage(record: CohortMessageRecord) {
  const userId = typeof record.user_id === 'string' ? record.user_id : null
  const channelId =
    record.channel_id == null ? null : Number(record.channel_id)
  const [author, attachments, channel] = await Promise.all([
    userId ? fetchCohortMessageAuthor(userId) : Promise.resolve(null),
    fetchAttachmentsForMessage(record.id),
    channelId != null && Number.isFinite(channelId)
      ? fetchChannelById(channelId)
      : Promise.resolve(null),
  ])
  return mapCohortMessageToSearchDocument(record, author, attachments, channel)
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

  if (payload.table === 'cohort_messages') {
    const record = (payload.record ?? {}) as CohortMessageRecord
    if (record.deleted_at != null) return null
    return await buildAulaDocumentForMessage(record)
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
    const table = parsed.table as SearchSyncTable
    if (!SEARCH_TABLES.has(table)) {
      return Response.json({ ok: false, error: 'Unsupported table' }, { status: 400 })
    }

    const contentIndexUid = Deno.env.get('MEILISEARCH_INDEX')?.trim() || 'ujverse_content'
    const indexUid =
      table === 'cohort_messages' || table === 'cohort_message_attachments'
        ? AULA_INDEX_UID
        : contentIndexUid

    const activeRecord = parsed.type === 'DELETE' ? parsed.old_record : parsed.record
    const sourceId = String(activeRecord?.id ?? '').trim()
    if (!sourceId) return new Response('Missing row id', { status: 400 })

    // Routing: cohort_message_attachments — re-index parent message.
    if (table === 'cohort_message_attachments') {
      const parentMessageIdRaw =
        (activeRecord?.message_id as number | string | undefined) ??
        (parsed.record?.message_id as number | string | undefined) ??
        (parsed.old_record?.message_id as number | string | undefined)
      if (parentMessageIdRaw == null) {
        return new Response('Missing message_id on attachment', { status: 400 })
      }
      const parentDocId = aulaDocumentIdForMessage(parentMessageIdRaw)
      const parentMessage = await fetchCohortMessageById(parentMessageIdRaw)
      if (!parentMessage) {
        await deleteDocument(indexUid, parentDocId)
        return Response.json({ ok: true, action: 'delete', id: parentDocId })
      }
      const document = await buildAulaDocumentForMessage(parentMessage)
      if (!document) {
        await deleteDocument(indexUid, parentDocId)
        return Response.json({ ok: true, action: 'delete', id: parentDocId })
      }
      await upsertDocument(indexUid, document)
      return Response.json({ ok: true, action: 'upsert', id: document.id })
    }

    if (parsed.type === 'DELETE') {
      const docId = documentIdFor(table, sourceId)
      await deleteDocument(indexUid, docId)
      return Response.json({ ok: true, action: 'delete', id: docId })
    }

    const document = await mapUpsertDocument(parsed)
    if (!document) {
      // rekord niekompletny / zbanowany autor / soft-deleted → DELETE z indeksu.
      const docId = documentIdFor(table, sourceId)
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
