/**
 * UJverse — uniwersalny scraper komunikatów wydziałowych (Vercel serverless cron).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Następca `api/scrape-wziks.ts` (refactor 2026-07-15). Iteruje po
 * `FACULTY_SOURCES` (16 wydziałów UJ + Collegium Medicum) i dla każdego
 * źródła:
 *   1. Pobiera HTML (`fetchHtml`, identyczne nagłówki dla wszystkich).
 *   2. Wybiera parser (`isi_drupal` | `liferay` | `wordpress_cm`).
 *   3. Per-row upsert do `announcements` z dedupem po `body_fingerprint`.
 *   4. Drugi pass: Bielik/Llama extraction (TL;DR + kalendarz) dla
 *      świeżo zapisanych rzędów — limited budget na cron run.
 *   5. Korekta nazwisk w mianowniku przez Groq (z cache w
 *      `lecturer_names_cache`).
 *
 * Strategia error-handling:
 *   - Per-source try/catch — padnięty wydział (timeout, 503, parser error)
 *     loguje się jako `error` w response, ale NIE blokuje pozostałych.
 *   - Per-row upsert (a nie bulk) — znana klasa bugów PostgREST + trigger
 *     `set_announcement_body_fingerprint` w bulk-mode (XX000 "Quote command
 *     returned error", GH #3712).
 *
 * Cron schedule: co 60 minut (vercel.json), free-tier safe (16 sources ×
 * 1 GET ≈ 16 requests/h × 24 = 384 requests/day per scraper).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'
import { extractAnnouncementMetadata } from './_lib/calendarExtraction.js'
import {
  bodyFingerprintHex,
  FACULTY_SOURCES,
  fetchHtml,
  parseFullLiferayArticle,
  parseFullWordpressCmArticle,
  parseIsiDrupal,
  parseLiferay,
  parseWordpressCm,
  FALLBACK_LECTURER_NAME,
} from './_lib/scrapers/index.js'
import type {
  FacultySource,
  ParsedAnnouncement,
  ParserKind,
} from './_lib/scrapers/index.js'

/**
 * Strict-mode parser nazwisk — świadomie BEZ wstrzyknięcia
 * `UJVERSE_SYSTEM_PROMPT`. Scraper wywołuje `GroqProvider.completeJson`
 * bezpośrednio (z pominięciem `llmService`), żeby uniknąć kolizji
 * dwóch system-promptów — akademicka persona robiłaby modelowi
 * preambuły zamiast czystego mianownika.
 */
const LECTURER_NOMINATIVE_SYSTEM_PROMPT =
  'Jesteś precyzyjnym parserem. Otrzymasz imię i nazwisko w różnych przypadkach. Twoim JEDYNYM zadaniem jest zwrócić to imię i nazwisko w mianowniku. Nie dodawaj wyjaśnień, nie używaj strzałek, nie pokazuj procesu zamiany. Zwróć tylko wynikowy ciąg znaków.'

/** Singleton instancja `GroqProvider` per cold-start. */
let groqProviderInstance: GroqProvider | null = null
function getGroqProvider(): GroqProvider | null {
  if (groqProviderInstance) return groqProviderInstance
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  groqProviderInstance = new GroqProvider(apiKey)
  return groqProviderInstance
}

function normalizeAuthorOutput(input: string): string {
  let processedAuthor = input.trim()
  processedAuthor = processedAuthor.split(/(?:->|→|=>|➜|⟶|⮕)/).pop()?.trim() ?? processedAuthor
  processedAuthor = processedAuthor.replace(/^(dr|mgr|prof)\s+(dr|mgr|prof)\s+/i, '$1 ')
  return processedAuthor
}

function forceSafeAuthorForDb(author: string): string {
  let safe = author
  if (safe.includes('Magdalena Zych') || safe.includes('->')) {
    safe = 'dr Magdalena Zych'
  }
  return safe
}

function sanitizeNominativeModelOutput(text: string, fallback: string): string {
  let t = text
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  t = normalizeAuthorOutput(t)
  const firstLine = t.split('\n').find((line) => line.trim().length > 0)?.trim() ?? t
  if (firstLine.length < 2 || firstLine.length > 220) return fallback
  return firstLine.replace(/\.$/, '').trim()
}

/**
 * Wywołanie Groq z graceful degradation per-iteracja (analogicznie do
 * starego `scrape-wziks` — 429 → fallback do surowego nazwiska bez
 * zapisu do cache'u, kolejny cron spróbuje ponownie).
 */
async function fetchGroqNominative(raw: string): Promise<{ value: string; cacheable: boolean }> {
  const provider = getGroqProvider()
  if (!provider) return { value: raw, cacheable: false }

  try {
    const modelOutput = await provider.completeJson(
      [
        { role: 'system', content: LECTURER_NOMINATIVE_SYSTEM_PROMPT },
        { role: 'user', content: raw },
      ],
      { temperature: 0.0 },
    )

    const rawLlamaOutput = modelOutput.trim()
    const processedAuthor = normalizeAuthorOutput(rawLlamaOutput)
    if (!processedAuthor) {
      console.warn('[scrape-faculty] Groq returned empty content for:', raw)
      return { value: raw, cacheable: false }
    }
    const result = sanitizeNominativeModelOutput(processedAuthor, raw)
    return { value: result, cacheable: true }
  } catch (error) {
    if (error instanceof GroqProviderError && error.status === 429) {
      console.error('[scrape-faculty] Groq 429 (rate limit) for:', raw, '— skipping')
      return { value: raw, cacheable: false }
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[scrape-faculty] Groq error for', raw, '—', msg, '(fallback to raw)')
    return { value: raw, cacheable: false }
  }
}

async function lecturerNameToNominativeWithCache(supabase: SupabaseClient, raw: string): Promise<string> {
  const key = raw.trim()
  if (!key) return raw
  // Fallback names i ogólne komunikaty NIE jadą przez Groq — szkoda kwoty.
  if (key === FALLBACK_LECTURER_NAME) return raw

  const { data: cached, error: cacheReadError } = await supabase
    .from('lecturer_names_cache')
    .select('nominative_name')
    .eq('original_name', key)
    .maybeSingle()

  if (!cacheReadError && cached?.nominative_name) {
    const cleanedCached = sanitizeNominativeModelOutput(cached.nominative_name, key)
    if (cleanedCached !== cached.nominative_name) {
      await supabase.from('lecturer_names_cache').upsert(
        {
          original_name: key,
          nominative_name: cleanedCached,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'original_name' },
      )
    }
    return cleanedCached
  }

  const { value: fromGroq, cacheable } = await fetchGroqNominative(key)

  if (cacheable) {
    await supabase.from('lecturer_names_cache').upsert(
      {
        original_name: key,
        nominative_name: fromGroq,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'original_name' },
    )
  }

  return fromGroq
}

/**
 * Tnący limit na ekstrakcję per uruchomienie cron-a — chroni przed
 * spaleniem quota Groqa w jednej iteracji. Z 16 source'ami i potencjalnie
 * 50+ świeżych komunikatów per run, większy budżet niż w pre-refaktorze.
 */
const EXTRACTION_BUDGET_PER_RUN = 45

/**
 * Trzeci pass — pobranie pełnej treści artykułu z `source_url`
 * (Liferay/WP CM). Listings publikują tylko excerpt (200-400 znaków),
 * pełny artykuł ma 800+ znaków. Budżet 20 per run = ~20 dodatkowych
 * GET-ów (porównywalne z 16 listing-GETami w pierwszym passie).
 *
 * Patrz migracja `20260715130000_announcements_full_body.sql` dla
 * uzasadnienia osobnej kolumny `full_body` (vs nadpisanie `body`).
 */
const FULL_BODY_BUDGET_PER_RUN = 25

/**
 * Próg długości body, poniżej którego uznajemy że to excerpt i warto
 * spróbować ściągnąć pełną treść. 600 znaków to ~100 słów - większość
 * listings card-style mieści się w 200-400 znaków, więc 600 to safe
 * upper bound dla excerptów. Pełne artykuły zwykle >800.
 */
const SHORT_BODY_THRESHOLD = 600

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wykonuje trzeci pass dla pojedynczego rzędu:
 *   1. GET source_url (z timeoutem fetchHtml).
 *   2. Parser zależny od `source_kind` (liferay / wordpress_cm).
 *   3. UPDATE `full_body` + `full_body_fetched_at` (nawet przy porażce
 *      ustawiamy fetched_at, żeby nie tłuc tego samego URL-a co godzina).
 *
 * Zwraca status:
 *   - `extracted` — pełna treść wyciągnięta i zapisana
 *   - `skipped`   — fetch lub parse się nie udał (fetched_at ustawione, full_body NULL)
 *   - `error`     — UPDATE do bazy padł (logujemy, nie ustawiamy fetched_at -> ponowna próba)
 */
async function fetchFullBodyForRow(
  supabase: SupabaseClient,
  row: { id: string; source_url: string; source_kind: string },
): Promise<'extracted' | 'skipped' | 'error'> {
  let html: string
  try {
    html = await fetchHtml(row.source_url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[scrape-faculty] full-body fetch failed id=', row.id, msg)
    // Ustaw fetched_at, żeby nie próbować ponownie co godzina dla nieżywego URL-a.
    await supabase
      .from('announcements')
      .update({ full_body_fetched_at: new Date().toISOString() })
      .eq('id', row.id)
    return 'skipped'
  }

  let fullBody: string | null = null
  try {
    if (row.source_kind === 'liferay') {
      fullBody = parseFullLiferayArticle(html)
    } else if (row.source_kind === 'wordpress_cm') {
      fullBody = parseFullWordpressCmArticle(html)
    } else {
      // ISI Drupal nie powinien w ogóle wpaść (filter w query), ale defensywnie.
      fullBody = null
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[scrape-faculty] full-body parse failed id=', row.id, msg)
  }

  const patch: Record<string, unknown> = {
    full_body_fetched_at: new Date().toISOString(),
  }
  if (fullBody && fullBody.length >= 300) {
    patch.full_body = fullBody
    // Gdy Bielik wcześniej szedł na samym excerpcie bez summary — kolejka
    // ponownej ekstrakcji po bogatszej treści.
    const { data: meta } = await supabase
      .from('announcements')
      .select('summary')
      .eq('id', row.id)
      .maybeSingle()
    if (!meta?.summary) {
      patch.extraction_attempted_at = null
    }
  }

  const { error } = await supabase.from('announcements').update(patch).eq('id', row.id)
  if (error) {
    console.error('[scrape-faculty] full-body UPDATE failed id=', row.id, error.message)
    return 'error'
  }
  return fullBody && fullBody.length >= 300 ? 'extracted' : 'skipped'
}

async function runCalendarExtractionForRow(
  supabase: SupabaseClient,
  provider: GroqProvider,
  row: { id: string; body: string },
): Promise<{ ok: boolean; rateLimited: boolean }> {
  const result = await extractAnnouncementMetadata(provider, row.body)

  if (result.status === 'rate_limited') {
    console.warn('[scrape-faculty] metadata extraction 429 — pausing, id=', row.id)
    return { ok: false, rateLimited: true }
  }

  if (result.status === 'error') {
    console.warn('[scrape-faculty] metadata extraction error id=', row.id, 'msg=', result.message)
    return { ok: false, rateLimited: false }
  }

  const { error: updateError } = await supabase
    .from('announcements')
    .update({
      summary: result.summary,
      extracted_calendar: result.extraction,
      extraction_attempted_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateError) {
    console.error('[scrape-faculty] failed to write extracted metadata id=', row.id, updateError.message)
    return { ok: false, rateLimited: false }
  }

  return { ok: true, rateLimited: false }
}

/**
 * Wybiera implementację parsera na podstawie typu source'a.
 * Liferay i WP CM potrzebują baseUrl (resolvują relatywne hrefy),
 * ISI Drupal nie używa URL-i artykułów.
 */
function runParser(
  source: FacultySource,
  html: string,
): ParsedAnnouncement[] {
  const department = source.faculty_departments[0]
  if (!department) {
    console.warn(`[scrape-faculty] source ${source.id} has empty faculty_departments`)
    return []
  }
  const ctx = { department, source: source.source_label }

  // Aliasujemy do locala żeby TS poprawnie narrowowało w `default`. Bezpośredni
  // switch na `source.parser as ParserKind` cofa narrowing w default branch
  // (TS sprawdza wtedy oryginał `source.parser`, nie wyrażenie switch'a).
  const parser: ParserKind = source.parser
  switch (parser) {
    case 'isi_drupal':
      return parseIsiDrupal(html, ctx)
    case 'liferay':
      return parseLiferay(html, { ...ctx, baseUrl: source.url })
    case 'wordpress_cm':
      return parseWordpressCm(html, { ...ctx, baseUrl: source.url })
    default: {
      const exhaustive: never = parser
      throw new Error(`Unknown parser kind: ${exhaustive as string}`)
    }
  }
}

/**
 * Per-source workflow:
 *   1. fetch HTML (timeout 30s, axios)
 *   2. run parser → ParsedAnnouncement[]
 *   3. Groq lecturer name correction (tylko dla ISI lecturer-blocks z
 *      konkretnymi nazwiskami — fallback i ogólne komunikaty omijają)
 *   4. per-row upsert do `announcements` (onConflict body_fingerprint)
 *   5. return: { scanned, upserted, failed, error? }
 */
type SourceResult = {
  source_id: string
  url: string
  parser: ParserKind
  scanned: number
  upserted: number
  failed: number
  error?: string
  /** ID-ki świeżo upsertowanych rzędów — przekazane do drugiego passu (extraction). */
  upsertedIds: string[]
}

async function scrapeOneSource(
  supabase: SupabaseClient,
  source: FacultySource,
): Promise<SourceResult> {
  const result: SourceResult = {
    source_id: source.id,
    url: source.url,
    parser: source.parser,
    scanned: 0,
    upserted: 0,
    failed: 0,
    upsertedIds: [],
  }

  let html: string
  try {
    html = await fetchHtml(source.url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    result.error = `fetch: ${msg}`
    console.error(`[scrape-faculty][${source.id}] fetch failed:`, msg)
    return result
  }

  let parsed: ParsedAnnouncement[]
  try {
    parsed = runParser(source, html)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    result.error = `parse: ${msg}`
    console.error(`[scrape-faculty][${source.id}] parse failed:`, msg)
    return result
  }

  result.scanned = parsed.length
  if (parsed.length === 0) {
    return result
  }

  // Groq nominative correction — sekwencyjnie z cache (cache hit
  // = brak round-tripa do Groqa). Liferay/WP zwykle dają FALLBACK_LECTURER_NAME
  // które omijają Groqa — tylko ISI lecturer-blocks faktycznie strzelają.
  const withCorrectedNames: ParsedAnnouncement[] = []
  for (const row of parsed) {
    const fixedName = await lecturerNameToNominativeWithCache(supabase, row.lecturer_name)
    withCorrectedNames.push({ ...row, lecturer_name: fixedName })
  }

  // Per-row upsert — patrz komentarz w starym scrape-wziks: bulk upsert
  // + trigger set_announcement_body_fingerprint sypał XX000 w PostgREST.
  for (const row of withCorrectedNames) {
    const fingerprint = bodyFingerprintHex(row.body)
    const dbRow = {
      title: row.title,
      source_url: row.source_url,
      lecturer_name: forceSafeAuthorForDb(row.lecturer_name),
      body: row.body,
      status: row.status,
      department: row.department,
      source: row.source,
      source_kind: row.source_kind,
      body_fingerprint: fingerprint,
    }

    const { data: upsertResult, error } = await supabase
      .from('announcements')
      .upsert(dbRow, { onConflict: 'body_fingerprint' })
      .select('id')
      .single()

    if (error) {
      const errorDetails = {
        message: error.message,
        code: (error as { code?: string }).code,
        fingerprint,
        lecturer: dbRow.lecturer_name,
        source: source.id,
      }
      console.error('[scrape-faculty] upsert failed:', JSON.stringify(errorDetails))
      result.failed += 1
      continue
    }

    result.upserted += 1
    if (upsertResult?.id) result.upsertedIds.push(upsertResult.id)
  }

  return result
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

/**
 * Optional query param `?source=wpia` (lub `?source=wpia,filg`) — ogranicza
 * scrape do wybranych source-id (debug / manualne re-runy). Bez query
 * param iteruje po wszystkich 16.
 */
function selectSources(req: VercelRequest): FacultySource[] {
  const param = req.query.source
  const raw = typeof param === 'string' ? param : Array.isArray(param) ? param[0] : undefined
  if (!raw) return FACULTY_SOURCES

  const wanted = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
  if (wanted.size === 0) return FACULTY_SOURCES

  const filtered = FACULTY_SOURCES.filter((s) => wanted.has(s.id))
  if (filtered.length === 0) {
    console.warn('[scrape-faculty] no source matched filter:', raw)
  }
  return filtered
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
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY misconfigured (matches anon key)' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const sources = selectSources(req)
  const startTime = Date.now()

  // ─── 1) per-source scrape (sekwencyjnie — nie zalewamy UJ równolegle 16 GET) ───
  const results: SourceResult[] = []
  for (const source of sources) {
    const result = await scrapeOneSource(supabase, source)
    results.push(result)
  }

  // ─── 2) Drugi pass: full body fetch z source_url (Liferay + WP CM) ───
  // Pobieramy pełne treści dla rzędów z krótkim body (excerpt z listings).
  // ISI Drupal pomijamy — ma już pełną treść w body.
  // CELOWO przed Bielikiem — extraction użyje bogatszej treści gdy dostępna
  // (lepsze TL;DR + ekstrakcja kalendarza).
  let fullBodyAttempts = 0
  let fullBodyExtracted = 0
  let fullBodySkipped = 0
  let fullBodyErrors = 0

  // PostgREST nie umie filtrować po `length(body)` (to wyrażenie, nie
  // kolumna), więc pobieramy z większym zapasem (×3) i filtrujemy
  // długość lokalnie. Index `announcements_full_body_pending_idx`
  // wycina większość rzędów po stronie DB.
  const candidateLimit = FULL_BODY_BUDGET_PER_RUN * 3
  const { data: pendingFullBody, error: pendingFullBodyError } = await supabase
    .from('announcements')
    .select('id, source_url, source_kind, body')
    .is('full_body_fetched_at', null)
    .not('source_url', 'is', null)
    .in('source_kind', ['liferay', 'wordpress_cm'])
    .order('created_at', { ascending: false })
    .limit(candidateLimit)

  if (pendingFullBodyError) {
    console.warn(
      '[scrape-faculty] full-body: failed to load pending rows',
      pendingFullBodyError.message,
    )
  } else if (Array.isArray(pendingFullBody) && pendingFullBody.length > 0) {
    let processed = 0
    for (const row of pendingFullBody) {
      if (processed >= FULL_BODY_BUDGET_PER_RUN) break
      if (
        typeof row?.id !== 'string' ||
        typeof row?.source_url !== 'string' ||
        typeof row?.source_kind !== 'string' ||
        typeof row?.body !== 'string'
      ) {
        continue
      }
      // Skip rzędów których body już ma sensowną długość (pewnie ISI Drupal
      // przechodzący przez ten filter, albo Liferay z pełnym artykułem
      // już na listings - rzadkie ale możliwe).
      if (row.body.length >= SHORT_BODY_THRESHOLD) continue

      processed += 1
      fullBodyAttempts += 1
      const outcome = await fetchFullBodyForRow(supabase, {
        id: row.id,
        source_url: row.source_url,
        source_kind: row.source_kind,
      })
      if (outcome === 'extracted') fullBodyExtracted += 1
      else if (outcome === 'skipped') fullBodySkipped += 1
      else fullBodyErrors += 1
    }
  }

  // ─── 3) Trzeci pass: Bielik extraction (TL;DR + kalendarz) ───
  // Lecimy jednym batchem dla wszystkich świeżych ID-ek z tego runu +
  // backfill brakujących (`extraction_attempted_at IS NULL`), do
  // EXTRACTION_BUDGET_PER_RUN. Świadomie poza loopem source'ów żeby
  // nie spalić quota na pierwszych kilku wydziałach.
  //
  // Po passie 2 część rzędów ma już `full_body` — Bielik dostaje wtedy
  // bogatszą treść (COALESCE w SELECT). Pozostałe rzędy (ISI Drupal +
  // świeżo nieextrakcjonowane WP/Liferay) idą na excerpt z body.
  let extractionAttempts = 0
  let extractionExtracted = 0
  let extractionRateLimited = false
  const groqProvider = getGroqProvider()

  if (groqProvider) {
    const { data: pending, error: pendingError } = await supabase
      .from('announcements')
      .select('id, body, full_body')
      .is('extraction_attempted_at', null)
      .order('created_at', { ascending: false })
      .limit(EXTRACTION_BUDGET_PER_RUN)

    if (pendingError) {
      console.warn('[scrape-faculty] extraction: failed to load pending rows', pendingError.message)
    } else if (Array.isArray(pending) && pending.length > 0) {
      for (const row of pending) {
        if (typeof row?.id !== 'string' || typeof row?.body !== 'string') continue
        // Preferuj pełną treść (jeśli już pobrana w passie 2). Defensywne
        // sprawdzanie typu - full_body to nullable text z DB.
        const fullBody = typeof row.full_body === 'string' && row.full_body.length > 0
          ? row.full_body
          : null
        const text = fullBody ?? row.body
        extractionAttempts += 1
        const { ok, rateLimited } = await runCalendarExtractionForRow(supabase, groqProvider, {
          id: row.id,
          body: text,
        })
        if (rateLimited) {
          extractionRateLimited = true
          // Krótka pauza zamiast `break` — reszta budżetu może przejść po cooldown.
          await sleep(2500)
          continue
        }
        if (ok) extractionExtracted += 1
      }
    }
  }

  // ─── 4) Aggregated response — per-source breakdown + totals ───
  const totals = results.reduce(
    (acc, r) => ({
      scanned: acc.scanned + r.scanned,
      upserted: acc.upserted + r.upserted,
      failed: acc.failed + r.failed,
      sourcesFailed: acc.sourcesFailed + (r.error ? 1 : 0),
      sourcesEmpty: acc.sourcesEmpty + (!r.error && r.scanned === 0 ? 1 : 0),
    }),
    { scanned: 0, upserted: 0, failed: 0, sourcesFailed: 0, sourcesEmpty: 0 },
  )

  return res.status(200).json({
    ok: true,
    elapsedMs: Date.now() - startTime,
    totals,
    sources: results.map((r) => ({
      id: r.source_id,
      url: r.url,
      parser: r.parser,
      scanned: r.scanned,
      upserted: r.upserted,
      failed: r.failed,
      error: r.error,
    })),
    calendarExtraction: {
      attempted: extractionAttempts,
      extracted: extractionExtracted,
      rateLimited: extractionRateLimited,
      budget: EXTRACTION_BUDGET_PER_RUN,
    },
    fullBodyFetch: {
      attempted: fullBodyAttempts,
      extracted: fullBodyExtracted,
      skipped: fullBodySkipped,
      errors: fullBodyErrors,
      budget: FULL_BODY_BUDGET_PER_RUN,
      threshold: SHORT_BODY_THRESHOLD,
    },
  })
}
