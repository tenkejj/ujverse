import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Meilisearch } from 'meilisearch'
import { ensureUsersIndexSettings } from '../lib/meilisearchIndexSettings'
import {
  documentIdFor,
  mapAnnouncementToSearchDocument,
  mapPostToSearchDocument,
  mapProfileToSearchDocument,
  type AnnouncementRecord,
  type PostProfile,
  type PostRecord,
  type ProfileRecord,
  type SearchSyncTable,
} from '../lib/searchSyncMapper'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema?: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

const CONTENT_INDEX = 'ujverse_content'
const USERS_INDEX = 'ujverse_users'
const SUPPORTED_TABLES = new Set<SearchSyncTable>(['posts', 'announcements', 'profiles'])

let usersIndexSettingsPromise: Promise<void> | null = null

function ensureUsersIndexSettingsOnce(client: Meilisearch): Promise<void> {
  if (!usersIndexSettingsPromise) {
    usersIndexSettingsPromise = ensureUsersIndexSettings(client)
  }
  return usersIndexSettingsPromise
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
  return table === 'profiles' ? USERS_INDEX : CONTENT_INDEX
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
  const supabaseUrl = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) return null

  const client = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, username, department, is_banned')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as PostProfile
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
    const documentId = documentIdFor(table, sourceId)

    if (payload.type === 'DELETE') {
      await deleteDocument(index, documentId)
      return res.status(200).json({ ok: true, action: 'delete', id: documentId, index: indexUid })
    }

    let document = null
    if (table === 'posts') {
      const record = payload.record as PostRecord | null
      const userId = typeof record?.user_id === 'string' ? record.user_id : null
      const profile = userId ? await fetchPostProfile(userId) : null
      document = mapPostToSearchDocument((record ?? {}) as PostRecord, profile)
    } else if (table === 'announcements') {
      document = mapAnnouncementToSearchDocument((payload.record ?? {}) as AnnouncementRecord)
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
