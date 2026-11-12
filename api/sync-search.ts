import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Meilisearch } from 'meilisearch'
import { ensureContentIndexSettings } from '../lib/meilisearchIndexSettings.js'
import {
  documentIdFor,
  mapAnnouncementToSearchDocument,
  type AnnouncementRecord,
} from '../lib/searchSyncMapper.js'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema?: string
  record?: Record<string, unknown> | null
  old_record?: Record<string, unknown> | null
}

const LEGACY_PRIVATE_TABLES = new Set([
  'posts',
  'profiles',
  'cohort_messages',
  'cohort_message_attachments',
])
let settingsPromise: Promise<void> | null = null

function parsePayload(raw: unknown): WebhookPayload | null {
  const value =
    typeof raw === 'string'
      ? JSON.parse(raw)
      : Buffer.isBuffer(raw)
        ? JSON.parse(raw.toString('utf8'))
        : raw
  if (!value || typeof value !== 'object') return null
  const payload = value as WebhookPayload
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(payload.type)) return null
  if (
    typeof payload.table !== 'string' ||
    (payload.schema && payload.schema !== 'public')
  )
    return null
  return payload
}

/**
 * Search reads Supabase directly. Legacy webhooks are acknowledged without
 * contacting a missing index service, and private rows are never indexed here.
 * An independently restricted public-only index can be enabled explicitly.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.SECRET_WEBHOOK_KEY?.trim()
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization
  if (!secret || authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  let payload: WebhookPayload | null
  try {
    payload = parsePayload(req.body)
  } catch {
    payload = null
  }
  if (!payload) return res.status(400).json({ error: 'Invalid payload' })
  if (LEGACY_PRIVATE_TABLES.has(payload.table)) {
    return res.status(200).json({
      ok: true,
      action: 'skipped',
      searchBackend: 'supabase',
      reason: 'private_data_uses_rls',
    })
  }
  if (payload.table !== 'announcements') {
    return res.status(400).json({ error: 'Unsupported table' })
  }
  const enabled = process.env.SEARCH_INDEX_SYNC_ENABLED?.trim() === '1'
  if (!enabled) {
    return res.status(200).json({
      ok: true,
      action: 'skipped',
      searchBackend: 'supabase',
      reason: 'database_primary',
    })
  }

  const host = process.env.MEILI_HOST?.trim()
  const key = process.env.MEILI_MASTER_KEY?.trim()
  // A new isolated index, never the old mixed content/users/Aula indexes.
  const indexUid =
    process.env.MEILI_PUBLIC_INDEX?.trim() || 'ujverse_public_information'
  if (['ujverse_content', 'ujverse_users', 'ujverse_aula'].includes(indexUid)) {
    return res.status(503).json({
      error: 'A separate public information index is required',
      code: 'unsafe_index_configuration',
    })
  }
  if (!host || !key) {
    return res.status(503).json({
      error: 'Public index is not configured',
      code: 'search_index_not_configured',
      searchBackend: 'supabase',
    })
  }
  const active = payload.type === 'DELETE' ? payload.old_record : payload.record
  const sourceId = String(active?.id ?? '').trim()
  if (!sourceId) return res.status(400).json({ error: 'Missing row id' })
  try {
    const client = new Meilisearch({ host, apiKey: key, timeout: 4000 })
    if (!settingsPromise) {
      settingsPromise = ensureContentIndexSettings(client, indexUid).catch(
        (error) => {
          settingsPromise = null
          throw error
        },
      )
    }
    await settingsPromise
    const index = client.index(indexUid)
    const document =
      payload.type === 'DELETE'
        ? null
        : mapAnnouncementToSearchDocument({
            ...active,
            lecturer_name:
              active?.lecturer_name || active?.source || 'Komunikat UJ',
          } as AnnouncementRecord)
    const task = document
      ? await index.addDocuments([document]).waitTask({ timeout: 4000 })
      : await index
          .deleteDocument(documentIdFor('announcements', sourceId))
          .waitTask({ timeout: 4000 })
    if (task.status !== 'succeeded') throw new Error('Public index task failed')
    return res.status(200).json({
      ok: true,
      action: document ? 'upsert' : 'delete',
      index: indexUid,
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    console.error('[sync-search] public index unavailable', {
      code: 'search_index_unavailable',
      status: typeof status === 'number' ? status : null,
    })
    return res.status(503).json({
      ok: false,
      error: 'Public index synchronization unavailable',
      code: 'search_index_unavailable',
      searchBackend: 'supabase',
    })
  }
}
