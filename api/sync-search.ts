import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import {
  ensureAulaIndexSettings,
  ensureContentIndexSettings,
  ensureUsersIndexSettings,
  AULA_INDEX_UID,
} from '../lib/meilisearchIndexSettings.js'
import {
  aulaDocumentIdForMessage,
  documentIdFor,
  mapAnnouncementToSearchDocument,
  mapCohortMessageToSearchDocument,
  mapPostToSearchDocument,
  mapProfileToSearchDocument,
  type AnnouncementRecord,
  type CohortAttachmentRecord,
  type CohortChannelRecord,
  type CohortMessageAuthor,
  type CohortMessageRecord,
  type PostProfile,
  type PostRecord,
  type ProfileRecord,
  type SearchSyncTable,
} from '../lib/searchSyncMapper.js'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema?: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

const CONTENT_INDEX = 'ujverse_content'
const USERS_INDEX = 'ujverse_users'
const SUPPORTED_TABLES = new Set<SearchSyncTable>([
  'posts',
  'announcements',
  'profiles',
  'cohort_messages',
  'cohort_message_attachments',
])

let usersIndexSettingsPromise: Promise<void> | null = null
let contentIndexSettingsPromise: Promise<void> | null = null
let aulaIndexSettingsPromise: Promise<void> | null = null

function ensureUsersIndexSettingsOnce(client: Meilisearch): Promise<void> {
  if (!usersIndexSettingsPromise) {
    usersIndexSettingsPromise = ensureUsersIndexSettings(client)
  }
  return usersIndexSettingsPromise
}

function ensureContentIndexSettingsOnce(client: Meilisearch, indexUid: string): Promise<void> {
  if (!contentIndexSettingsPromise) {
    contentIndexSettingsPromise = ensureContentIndexSettings(client, indexUid)
  }
  return contentIndexSettingsPromise
}

function ensureAulaIndexSettingsOnce(client: Meilisearch): Promise<void> {
  if (!aulaIndexSettingsPromise) {
    aulaIndexSettingsPromise = ensureAulaIndexSettings(client)
  }
  return aulaIndexSettingsPromise
}

function getBearerToken(headerValue: string | string[] | undefined): string | null {
  if (!headerValue) return null
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue
  return raw ?? null
}

function parsePayload(raw: unknown): WebhookPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as Partial<WebhookPayload>

  if (!payload.type || !payload.table) return null
  if (payload.type !== 'INSERT' && payload.type !== 'UPDATE' && payload.type !== 'DELETE') return null
  if (payload.schema && payload.schema !== 'public') return null

  return {
    type: payload.type,
    table: payload.table,
    schema: payload.schema,
    record: (payload.record ?? null) as Record<string, unknown> | null,
    old_record: (payload.old_record ?? null) as Record<string, unknown> | null,
  }
}

function parseRequestBody(req: VercelRequest): unknown {
  if (req.body === undefined || req.body === null) return null
  if (typeof req.body === 'string') {
    return JSON.parse(req.body)
  }
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString('utf8'))
  }
  return req.body
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

function getIndexForTable(table: SearchSyncTable): string {
  if (table === 'profiles') return USERS_INDEX
  if (table === 'cohort_messages' || table === 'cohort_message_attachments') return AULA_INDEX_UID
  return CONTENT_INDEX
}

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey)
}

async function deleteDocument(index: ReturnType<Meilisearch['index']>, documentId: string): Promise<void> {
  try {
    await index.deleteDocument(documentId)
  } catch (error) {
    const status = (error as { status?: number; response?: { status?: number } }).status
      ?? (error as { response?: { status?: number } }).response?.status
    if (status === 404) return
    throw error
  }
}

async function fetchPostProfile(userId: string): Promise<PostProfile | null> {
  const client = getServiceClient()
  if (!client) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, username, department, is_banned')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as PostProfile
}

async function fetchCohortMessageAuthor(userId: string): Promise<CohortMessageAuthor | null> {
  const client = getServiceClient()
  if (!client) return null
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, username, is_banned')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortMessageAuthor
}

async function fetchAttachmentsForMessage(messageId: number | string): Promise<CohortAttachmentRecord[]> {
  const client = getServiceClient()
  if (!client) return []
  const { data, error } = await client
    .from('cohort_message_attachments')
    .select('id, message_id, file_name')
    .eq('message_id', messageId)
  if (error || !data) return []
  return data as CohortAttachmentRecord[]
}

async function fetchCohortMessageById(messageId: number | string): Promise<CohortMessageRecord | null> {
  const client = getServiceClient()
  if (!client) return null
  const { data, error } = await client
    .from('cohort_messages')
    .select('id, cohort_id, user_id, parent_id, channel_id, content, created_at, deleted_at')
    .eq('id', messageId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortMessageRecord
}

async function fetchChannelById(channelId: number | string): Promise<CohortChannelRecord | null> {
  const client = getServiceClient()
  if (!client) return null
  const { data, error } = await client
    .from('cohort_channels')
    .select('id, slug, name, kind')
    .eq('id', channelId)
    .maybeSingle()
  if (error || !data) return null
  return data as CohortChannelRecord
}

/**
 * Buduje pełny `AulaSyncDocument` dla wiadomości — fetch autora + załączników
 * + (opcjonalnie) channel. Używane przy UPSERT cohort_messages ORAZ przy
 * INSERT/DELETE attachmentu (wtedy re-index parent message, żeby `fileNames`
 * / `hasAttachments` było aktualne).
 *
 * Channel fetch tylko gdy `record.channel_id IS NOT NULL` — #general jest
 * virtual i nie ma rekordu w `cohort_channels`.
 */
async function buildAulaDocumentForMessage(
  record: CohortMessageRecord,
): Promise<ReturnType<typeof mapCohortMessageToSearchDocument>> {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const webhookSecret = process.env.SECRET_WEBHOOK_KEY?.trim()
    const authHeader = getBearerToken(req.headers.authorization)
    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    let payload: WebhookPayload | null = null
    try {
      payload = parsePayload(parseRequestBody(req))
    } catch {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    if (!payload) return res.status(400).json({ error: 'Invalid payload' })
    if (!SUPPORTED_TABLES.has(payload.table as SearchSyncTable)) {
      return res.status(400).json({ error: 'Unsupported table' })
    }

    const table = payload.table as SearchSyncTable
    const activeRecord = payload.type === 'DELETE' ? payload.old_record : payload.record
    const sourceId = String(activeRecord?.id ?? '').trim()
    if (!sourceId) return res.status(400).json({ error: 'Missing row id' })

    const meiliHost = readRequiredEnv('MEILI_HOST')
    const meiliMasterKey = readRequiredEnv('MEILI_MASTER_KEY')
    const meiliClient = new Meilisearch({ host: meiliHost, apiKey: meiliMasterKey })
    const indexUid = getIndexForTable(table)
    const index = meiliClient.index(indexUid)

    // Routing #1: cohort_message_attachments — re-index parent message, nigdy
    // własnego dokumentu nie tworzymy. Webhook na INSERT/UPDATE/DELETE.
    if (table === 'cohort_message_attachments') {
      const parentMessageIdRaw =
        (activeRecord?.message_id as number | string | undefined) ??
        (payload.record?.message_id as number | string | undefined) ??
        (payload.old_record?.message_id as number | string | undefined)
      if (parentMessageIdRaw == null) {
        return res.status(400).json({ error: 'Missing message_id on attachment' })
      }
      const parentMessage = await fetchCohortMessageById(parentMessageIdRaw)
      const parentDocId = aulaDocumentIdForMessage(parentMessageIdRaw)
      if (!parentMessage) {
        // Parent message hard-deleted (CASCADE) — atachmenty już zostały usunięte
        // razem z dokumentem przy DELETE cohort_messages. No-op.
        await deleteDocument(index, parentDocId)
        return res.status(200).json({ ok: true, action: 'delete', id: parentDocId, index: indexUid })
      }
      await ensureAulaIndexSettingsOnce(meiliClient)
      const document = await buildAulaDocumentForMessage(parentMessage)
      if (!document) {
        await deleteDocument(index, parentDocId)
        return res.status(200).json({ ok: true, action: 'delete', id: parentDocId, index: indexUid })
      }
      await index.addDocuments([document])
      return res.status(200).json({ ok: true, action: 'upsert', id: document.id, index: indexUid })
    }

    const documentId = documentIdFor(table, sourceId)

    if (payload.type === 'DELETE') {
      await deleteDocument(index, documentId)
      return res.status(200).json({ ok: true, action: 'delete', id: documentId, index: indexUid })
    }

    if (table === 'posts' || table === 'announcements') {
      await ensureContentIndexSettingsOnce(meiliClient, indexUid)
    }

    let document = null
    if (table === 'posts') {
      const record = payload.record as PostRecord | null
      const userId = typeof record?.user_id === 'string' ? record.user_id : null
      const profile = userId ? await fetchPostProfile(userId) : null
      document = mapPostToSearchDocument((record ?? {}) as PostRecord, profile)
    } else if (table === 'announcements') {
      document = mapAnnouncementToSearchDocument((payload.record ?? {}) as AnnouncementRecord)
    } else if (table === 'cohort_messages') {
      await ensureAulaIndexSettingsOnce(meiliClient)
      const record = (payload.record ?? {}) as CohortMessageRecord
      // Soft-delete = DELETE z indeksu (mapper i tak zwróci null, ale jawne
      // dla czytelności)
      if (record.deleted_at != null) {
        await deleteDocument(index, documentId)
        return res.status(200).json({ ok: true, action: 'delete', id: documentId, index: indexUid })
      }
      document = await buildAulaDocumentForMessage(record)
    } else {
      await ensureUsersIndexSettingsOnce(meiliClient)
      document = mapProfileToSearchDocument((payload.record ?? {}) as ProfileRecord)
    }

    if (!document) {
      await deleteDocument(index, documentId)
      return res.status(200).json({ ok: true, action: 'delete', id: documentId, index: indexUid })
    }

    await index.addDocuments([document])
    return res.status(200).json({ ok: true, action: 'upsert', id: document.id, index: indexUid })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/sync-search] error:', message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
