/**
 * UJverse — cron endpoint: generuje tygodniowe briefingi dla wszystkich
 * userów z aktywnym planem lub subskrypcjami.
 *
 * Vercel Cron schedule: pn 06:00 UTC (= 08:00 CEST / 07:00 CET — kompromis
 * DST). Wpisany w `vercel.json`. Manualny trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://ujverse.vercel.app/api/generate-briefings
 *
 * Idempotentne: RPC `generate_weekly_briefings_for_week` ma ON CONFLICT na
 * (user_id, week_start) — re-runy w tym samym tygodniu nadpisują payload
 * (refresh danych), notyfikacje nie duplikują się (ON CONFLICT briefing_id).
 *
 * Wzorzec autoryzacji i config dokładnie taki sam jak `scrape-wziks.ts` —
 * jednolity contract dla wszystkich naszych cronjobów.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function isAuthorized(req: VercelRequest, cronSecret: string): boolean {
  const tokenParam = req.query.token
  const token =
    typeof tokenParam === 'string'
      ? tokenParam
      : Array.isArray(tokenParam)
        ? tokenParam[0]
        : undefined
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
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  if (!isAuthorized(req, cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (anonKey && serviceKey === anonKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY misconfigured (matches anon key)',
    })
  }

  // Override przez query param `week_start=YYYY-MM-DD` — przydatne do
  // backfill historycznych tygodni manualnym curlem. Bez parametru RPC
  // bierze bieżący poniedziałek Europe/Warsaw.
  const weekStartParam = req.query.week_start
  const weekStart =
    typeof weekStartParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)
      ? weekStartParam
      : null

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const startedAt = Date.now()
  const { data, error } = await supabase.rpc('generate_weekly_briefings_for_week', {
    p_week_start: weekStart,
  })

  if (error) {
    return res.status(500).json({
      error: error.message,
      hint: error.hint ?? undefined,
      details: error.details ?? undefined,
    })
  }

  return res.status(200).json({
    ok: true,
    week_start: weekStart ?? 'current_warsaw_week',
    generated_count: typeof data === 'number' ? data : 0,
    elapsed_ms: Date.now() - startedAt,
  })
}
