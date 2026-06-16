/**
 * Masowy re-run ekstrakcji TL;DR (Versuś) + kalendarza dla istniejących
 * komunikatów. Używaj po zmianie promptu w `calendarExtraction.ts`.
 *
 * Flow:
 *   1. `?op=reset` — tylko `extraction_attempted_at = NULL` (jak migracja).
 *   2. `?op=run` (default) — przetwarza kolejkę `extraction_attempted_at IS NULL`
 *      aż do budżetu czasu (~4.5 min) lub wyczerpania kolejki / 429 Groqa.
 *
 * Auth: `CRON_SECRET` — Bearer lub `?token=`.
 *
 * Manual:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<host>/api/reextract-announcements?op=run"
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GroqProvider } from './_lib/GroqProvider.js'
import { runAnnouncementMetadataExtractionForRow } from './_lib/announcementMetadataPass.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

const BATCH_FETCH = 60 // docelowy rozmiar paczki pending (skan stronicowany)
/** Pauza po 429 z Groqa (ms). */
const RATE_LIMIT_PAUSE_MS = 6000
/** ~2s między ekstrakcjami ≈ 30 RPM (limit free tier Llama na Groq). */
const INTER_ROW_PAUSE_MS = 1800
/** Zostaw margines przed hard timeout Vercel (maxDuration 300). */
const MAX_WALL_MS = 270_000

let groqProviderInstance: GroqProvider | null = null
function getGroqProvider(): GroqProvider | null {
  if (groqProviderInstance) return groqProviderInstance
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  groqProviderInstance = new GroqProvider(apiKey)
  return groqProviderInstance
}

function isAuthorized(req: VercelRequest, cronSecret: string): boolean {
  const tokenParam = req.query.token
  const token =
    typeof tokenParam === 'string' ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : undefined
  if (token === cronSecret) return true
  const authHeader = req.headers['authorization']
  const header = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (header === `Bearer ${cronSecret}`) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Batchowy reset — paginacja po `created_at` (indeks), bez timeoutu na IS NULL. */
async function resetExtractionQueue(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  maxPages = 60,
): Promise<number> {
  let requeued = 0
  const PAGE = 120
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * PAGE
    const { data, error: selErr } = await supabase
      .from('announcements')
      .select('id, extraction_attempted_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (selErr) throw new Error(selErr.message)
    if (!data || data.length === 0) break

    const ids = data
      .filter((r) => r.extraction_attempted_at != null)
      .map((r) => r.id)
      .filter((id): id is string => typeof id === 'string')
    if (ids.length > 0) {
      const { error: updErr } = await supabase
        .from('announcements')
        .update({ extraction_attempted_at: null })
        .in('id', ids)
      if (updErr) throw new Error(updErr.message)
      requeued += ids.length
    }

    if (data.length < PAGE) break
  }
  return requeued
}

type PendingRow = {
  id: string
  body: string
  full_body: string | null
}

/**
 * Pobiera pending rows bez `WHERE extraction_attempted_at IS NULL` (timeout na
 * dużej tabeli). Skanuje strony po `created_at DESC` i filtruje w JS.
 */
async function fetchPendingPage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  page: number,
): Promise<{ rows: PendingRow[]; exhausted: boolean }> {
  const PAGE = 100
  const from = page * PAGE
  const { data, error } = await supabase
    .from('announcements')
    .select('id, body, full_body, extraction_attempted_at')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    return { rows: [], exhausted: true }
  }

  const rows: PendingRow[] = []
  for (const r of data) {
    if (r.extraction_attempted_at != null) continue
    if (typeof r.id !== 'string') continue
    rows.push({
      id: r.id,
      body: typeof r.body === 'string' ? r.body : '',
      full_body: typeof r.full_body === 'string' ? r.full_body : null,
    })
  }

  return { rows, exhausted: data.length < PAGE }
}

function queryOp(req: VercelRequest): 'reset' | 'run' | 'all' {
  const raw = req.query.op
  const op = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : 'run'
  if (op === 'reset') return 'reset'
  if (op === 'all') return 'all'
  return 'run'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET not configured' })
  if (!isAuthorized(req, cronSecret)) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseAdmin()
  const op = queryOp(req)
  const startedAt = Date.now()

  if (op === 'reset') {
    try {
      const requeued = await resetExtractionQueue(supabase)
      return res.status(200).json({ op: 'reset', requeued })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return res.status(500).json({ error: msg })
    }
  }

  let resetCount = 0
  if (op === 'all') {
    try {
      resetCount = await resetExtractionQueue(supabase)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return res.status(500).json({ error: msg, phase: 'reset' })
    }
  }

  const groqProvider = getGroqProvider()
  if (!groqProvider) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  let attempts = 0
  let extracted = 0
  let errors = 0
  let rateLimitedHits = 0
  let scanPage = 0
  let queueExhausted = false

  try {
    while (Date.now() - startedAt < MAX_WALL_MS) {
      const { rows: pending, exhausted } = await fetchPendingPage(supabase, scanPage)
      scanPage += 1
      if (exhausted && pending.length === 0) {
        queueExhausted = true
        break
      }
      if (pending.length === 0) {
        if (exhausted) {
          queueExhausted = true
          break
        }
        continue
      }

      for (const row of pending) {
        if (Date.now() - startedAt >= MAX_WALL_MS) break

        const fullBody =
          row.full_body && row.full_body.length > 0 ? row.full_body : null
        const text = fullBody ?? row.body
        if (text.trim().length < 20) {
          await supabase
            .from('announcements')
            .update({ extraction_attempted_at: new Date().toISOString() })
            .eq('id', row.id)
          continue
        }

        attempts += 1
        const outcome = await runAnnouncementMetadataExtractionForRow(
          supabase,
          groqProvider,
          { id: row.id, body: text },
          '[reextract-announcements]',
        )

        if (outcome.rateLimited) {
          rateLimitedHits += 1
          await sleep(RATE_LIMIT_PAUSE_MS)
          continue
        }
        if (outcome.ok) extracted += 1
        else errors += 1

        if (!outcome.rateLimited && INTER_ROW_PAUSE_MS > 0) {
          await sleep(INTER_ROW_PAUSE_MS)
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg, attempts, extracted, phase: 'run' })
  }

  return res.status(200).json({
    op: op === 'all' ? 'all' : 'run',
    resetCount: op === 'all' ? resetCount : undefined,
    attempts,
    extracted,
    errors,
    rateLimitedHits,
    queueExhausted,
    elapsedMs: Date.now() - startedAt,
    done: queueExhausted,
    hint:
      !queueExhausted || rateLimitedHits > 0
        ? 'Kolejka w toku — odpal ?op=run ponownie (wolniejsze tempo = mniej 429 z Groqa).'
        : undefined,
  })
}
