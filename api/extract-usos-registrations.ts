/**
 * UJverse — Vercel Cron: AI extractor rejestracji USOS z ogłoszeń wydziałowych.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Flow:
 *   1. Pobierz N najnowszych `announcements` gdzie `usos_extraction_attempted_at IS NULL`
 *   2. Dla każdego puść Groq (`usosExtraction.ts`)
 *   3. Jeśli wynik = wpis rejestracji → INSERT do `usos_registrations`
 *      z `source_announcement_id` (partial UNIQUE = idempotencja)
 *   4. ZAWSZE zaktualizuj `usos_extraction_attempted_at = now()` (nawet
 *      negatywne wyniki — nie powtarzamy LLM calls)
 *
 * Throttling:
 *   - `BATCH_SIZE = 12` per cron run (∼7s budżet Groq, < 10 RPM safe)
 *   - sequential (await w pętli) — nie palimy quota burst
 *   - rate_limited = przerwij batch, kolejny cron dokończy
 *
 * Auth: identyczny pattern jak `scrape-wziks.ts` — `CRON_SECRET` jako
 * `Authorization: Bearer ...` (Vercel Cron) lub `?token=` (manual curl).
 *
 * Schedule (vercel.json): codziennie 06:00 UTC (08:00 PL — przed peak'iem
 * studenta) + dodatkowo o 18:00 UTC (20:00 PL) żeby wieczorne ogłoszenia
 * leciały na noc.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GroqProvider } from './_lib/GroqProvider.js'
import { extractUsosRegistrationFromAnnouncement } from './_lib/usosExtraction.js'

const BATCH_SIZE = 12
const SOURCE_LABEL = 'AI · ogłoszenie wydziału'

type AnnouncementRow = {
  id: string
  body: string
  department: string | null
  created_at: string
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET not configured' })
  if (!isAuthorized(req, cronSecret)) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (anonKey && serviceKey === anonKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY misconfigured (matches anon key)' })
  }
  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' })

  const supabase = createClient(supabaseUrl, serviceKey)
  const groq = new GroqProvider(groqApiKey)

  // 1. Pobierz batch ogłoszeń do przeanalizowania
  const { data: pendingAnnouncements, error: fetchError } = await supabase
    .from('announcements')
    .select('id, body, department, created_at')
    .is('usos_extraction_attempted_at', null)
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE)

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to fetch announcements', details: fetchError.message })
  }

  const announcements = (pendingAnnouncements ?? []) as AnnouncementRow[]
  if (announcements.length === 0) {
    return res.status(200).json({ ok: true, processed: 0, created: 0, message: 'No pending announcements' })
  }

  const now = new Date()
  let processed = 0
  let created = 0
  let rateLimitedAt: number | null = null
  const errors: Array<{ id: string; error: string }> = []

  for (const ann of announcements) {
    const result = await extractUsosRegistrationFromAnnouncement(groq, ann.body, now)

    if (result.status === 'rate_limited') {
      rateLimitedAt = processed
      break // przerwij batch — kolejny cron dokończy
    }

    if (result.status === 'error') {
      errors.push({ id: ann.id, error: result.message })
      // NIE oznaczamy jako attempted — pozwalamy retry przy następnym cronie
      continue
    }

    // status === 'ok'
    if (result.extraction) {
      const ex = result.extraction
      // INSERT z partial UNIQUE na source_announcement_id — jeśli już
      // istnieje dla tego ogłoszenia (race condition), Postgres zwróci
      // błąd; obsługujemy go silently.
      const { error: insertError } = await supabase.from('usos_registrations').insert({
        created_by: null,
        title: ex.title,
        description: ex.description,
        study_program: ex.study_program,
        year: ex.year,
        audience_label: ex.audience_label ?? ann.department,
        opens_at: ex.opens_at,
        closes_at: ex.closes_at,
        registration_url: ex.registration_url,
        info_url: ex.info_url,
        kind: ex.kind,
        source_announcement_id: ann.id,
        source_label: SOURCE_LABEL,
      })

      if (insertError) {
        // Duplicate (UNIQUE violation) jest OK — oznacz attempted i jedź dalej.
        const isDuplicate = insertError.code === '23505'
        if (!isDuplicate) {
          errors.push({ id: ann.id, error: `Insert failed: ${insertError.message}` })
        }
      } else {
        created++
      }
    }

    // ZAWSZE oznaczamy jako attempted (nawet negatywne wyniki — nie powtarzamy LLM)
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ usos_extraction_attempted_at: now.toISOString() })
      .eq('id', ann.id)
    if (updateError) {
      errors.push({ id: ann.id, error: `Update attempted_at failed: ${updateError.message}` })
    }

    processed++
  }

  return res.status(200).json({
    ok: true,
    batch_size: BATCH_SIZE,
    fetched: announcements.length,
    processed,
    created,
    rate_limited_at: rateLimitedAt,
    errors: errors.length > 0 ? errors : undefined,
  })
}
