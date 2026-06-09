/**
 * UJverse — ISI UJ communiqués scraper (Vercel serverless cron endpoint).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
// Serverless cron endpoint: scrapes ISI UJ communiqués → upserts into announcements.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { load, type CheerioAPI } from 'cheerio'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { GroqProvider, GroqProviderError } from './_lib/GroqProvider.js'

/** Zgodne z triggerem DB `md5(body)` — jawny klucz dla `upsert(..., onConflict: 'body_fingerprint')`. */
function bodyFingerprintHex(body: string): string {
  return crypto.createHash('md5').update(body, 'utf8').digest('hex')
}

export const WZIK_ISI_KOMUNIKATY_URL = 'https://isi.uj.edu.pl/studenci/news/komunikaty'
const SOURCE_URL = WZIK_ISI_KOMUNIKATY_URL
const DEPARTMENT = 'WZiKS'
/** Źródło danych zapisywane przy każdym upsercie (komunikaty ISI). */
const ANNOUNCEMENT_SOURCE = 'ISI UJ'

/** Tekst zastępczy gdy nie uda się wyciągnąć wykładowcy. */
const FALLBACK_LECTURER_NAME = 'Komunikat ISI / WZiKS'

/**
 * Strict-mode parser nazwisk: świadomie BEZ wstrzyknięcia `UJVERSE_SYSTEM_PROMPT`.
 * Scraper wywołuje `GroqProvider.completeJson` bezpośrednio (z pominięciem
 * `llmService`), żeby uniknąć kolizji dwóch system-promptów — akademicka
 * persona robiłaby modelowi preambuły zamiast czystego mianownika.
 */
const LECTURER_NOMINATIVE_SYSTEM_PROMPT =
  'Jesteś precyzyjnym parserem. Otrzymasz imię i nazwisko w różnych przypadkach. Twoim JEDYNYM zadaniem jest zwrócić to imię i nazwisko w mianowniku. Nie dodawaj wyjaśnień, nie używaj strzałek, nie pokazuj procesu zamiany. Zwróć tylko wynikowy ciąg znaków.'

/**
 * Singleton instancja `GroqProvider` per cold-start funkcji.
 * Inicjalizowana lazy, żeby brak `GROQ_API_KEY` nie wywalał całego scrapera
 * przy imporcie modułu (nazwy nazwisk to feature opcjonalny — bez Groqa
 * scraper i tak zapisuje surowe nazwiska).
 */
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
  // Keep last segment when model includes a transformation trace.
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
 * Wywołanie Groq z graceful degradation per-iteracja:
 *
 * - 429 (rate limit / quota): logujemy z prefixem `[scrape-wziks] Groq 429`,
 *   zwracamy surowe nazwisko `{ value: raw, cacheable: false }` — scraper
 *   leci dalej, nie zapisuje wątpliwego rezultatu do cache'u, kolejna
 *   iteracja cron-jobu spróbuje ponownie.
 * - inne błędy HTTP / sieć / pusty content: ten sam fallback, ale bez
 *   specjalnego logu.
 *
 * Nigdy nie rzuca — to świadomy "best-effort" w cron-jobie, błąd jednego
 * nazwiska nie może wywalić całego upsertu komunikatów.
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
      console.warn('[scrape-wziks] Groq returned empty content for:', raw)
      return { value: raw, cacheable: false }
    }
    const result = sanitizeNominativeModelOutput(processedAuthor, raw)
    console.log('Poprawiono:', raw, '->', result)
    return { value: result, cacheable: true }
  } catch (error) {
    if (error instanceof GroqProviderError && error.status === 429) {
      console.error(
        '[scrape-wziks] Groq 429 (rate limit) for lecturer name:',
        raw,
        '— skipping nominative correction for this iteration',
      )
      return { value: raw, cacheable: false }
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[scrape-wziks] Groq error for', raw, '—', msg, '(falling back to raw)')
    return { value: raw, cacheable: false }
  }
}

async function lecturerNameToNominativeWithCache(supabase: SupabaseClient, raw: string): Promise<string> {
  const key = raw.trim()
  const originalName = key
  if (!key) return raw
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
    console.log('DEBUG CACHE: Próbuję zapisać do cache:', originalName)
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

/** Wzorce typowych fraz przed nazwiskiem w tekście komunikatu (usuwanie szumu). */
const LECTURER_INTRO_PHRASES: RegExp[] = [
  /\bzajęcia\s+prowadzone\s+przez\s*:?\s*/gi,
  /\bzajecia\s+prowadzone\s+przez\s*:?\s*/gi,
  /\bzajęcia\s+poprowadzi\s*:?\s*/gi,
  /\bwykład\s+prowadzony\s+przez\s*:?\s*/gi,
  /\bwyklad\s+prowadzony\s+przez\s*:?\s*/gi,
]

export function stripLecturerIntroPhrases(text: string): string {
  let t = text
  for (const re of LECTURER_INTRO_PHRASES) t = t.replace(re, '')
  return cleanWhitespace(t)
}

/** Chrome na macOS — wygląda jak zwykła przeglądarka (mniej „bot” w logach WAF). */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export type ParsedWziksAnnouncement = {
  lecturer_name: string
  body: string
  status: 'cancelled' | 'remote' | 'duty'
  department: string
  source: string
}

type Row = ParsedWziksAnnouncement
const SCRAPER_DEBUG_RAW = process.env.SCRAPER_DEBUG_RAW === '1'

function cleanWhitespace(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Usuwa szum UI UJ (nagłówki widoku, okruszki), tabulatory i puste linie na początku. */
export function cleanupAnnouncementText(text: string): string {
  let t = text.replace(/\u00a0/g, ' ')
  const noise = [
    'Widok zawartości stron',
    'Nawigacja okruszkowa',
    '\t\t\t\t            Komunikaty',
    '\t\t\tNawigacja okruszkowa',
  ]
  for (const phrase of noise) {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(esc, 'gi'), '\n')
  }
  t = t.replace(/\t+/g, ' ')
  t = t.replace(/[ \t]+$/gm, '')
  t = t.replace(/^\s*\n+/, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return cleanWhitespace(t)
}

/** Po wyciągnięciu godności + nazwiska: obetnij przed „oraz”, przecinkiem przed prof. UJ, max ~4 słowa po tytule. */
function clipLecturerPhrase(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim()
  s = s.split(/\s+oraz\b/i)[0]?.trim() ?? s
  s = s.split(/\s*,\s*prof\.\s*uj\b/i)[0]?.trim() ?? s
  s = s.replace(/,\s*$/, '').trim()

  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length <= 6) return s

  const titleLower = new Set([
    'dr',
    'dr.',
    'hab.',
    'prof.',
    'mgr',
    'mgr.',
    'inż.',
    'inz.',
    'inż',
    'inz',
    'uj',
  ])
  const out: string[] = []
  let i = 0
  while (i < parts.length) {
    const p = parts[i]
    const pl = p.toLowerCase()
    if (titleLower.has(pl) || /^[a-ząćęłńóśźż]{1,4}\.$/i.test(p)) {
      out.push(p)
      i++
      continue
    }
    break
  }
  let nameWords = 0
  const maxName = 3
  while (i < parts.length && nameWords < maxName) {
    out.push(parts[i])
    i++
    nameWords++
  }
  return out.join(' ') || s.slice(0, 120)
}

/**
 * Linia-separator: krótsze ciągi myślników/underscore itd. (≥5 znaków),
 * przy czym znacząca część znaku to „kreski” (strona UJ bywa niespójna).
 */
function isSeparatorLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 5) return false
  const dashLike = (t.match(/[-─–—_.=~·]+/g) ?? []).join('').length
  return dashLike / t.length >= 0.55
}

/** Dzielenie po liniach z samymi (głównie) myślnikami — bez wymogu \n przed/po. */
function splitBlocksByDashLines(text: string): string[] {
  const lines = text.split(/\n/)
  const blocks: string[] = []
  let cur: string[] = []

  for (const line of lines) {
    if (isSeparatorLine(line)) {
      const chunk = cur.join('\n').trim()
      if (chunk.length >= 20) blocks.push(chunk)
      cur = []
    } else {
      cur.push(line)
    }
  }
  const last = cur.join('\n').trim()
  if (last.length >= 20) blocks.push(last)
  return blocks
}

function fallbackRootText($: CheerioAPI): string {
  const root =
    $('main').first().length > 0
      ? $('main').first()
      : $('[role="main"]').first().length > 0
        ? $('[role="main"]').first()
        : $('article').first().length > 0
          ? $('article').first()
          : $('.layout-content, .region-content, .node__content').first().length > 0
            ? $('.layout-content, .region-content, .node__content').first()
            : $('body')

  return cleanWhitespace(root.text())
}

/**
 * Tekst z treści komunikatów: najpierw typowe klasy ISI / Drupal,
 * potem ogólny main / article.
 */
function extractBlocksFromHtml(html: string): string[] {
  const $ = load(html)

  // ISI/Drupal variants differ between templates, so collect from multiple selectors.
  const itemSelectors = '.news-item, .views-row, .node--type-news, .article-list-item, .news-list-item'
  const newsItems = $(itemSelectors)
  if (newsItems.length > 0) {
    const fromItems = newsItems
      .map((i, el) => {
        const rawHtml = $(el).html() ?? ''
        const text = cleanWhitespace($(el).text())
        if (SCRAPER_DEBUG_RAW) {
          console.log(`[SCRAPER_DEBUG_RAW][item:${i}] RAW_HTML_START`)
          console.log(rawHtml)
          console.log(`[SCRAPER_DEBUG_RAW][item:${i}] RAW_HTML_END`)
          console.log(`[SCRAPER_DEBUG_RAW][item:${i}] RAW_TEXT_START`)
          console.log(text)
          console.log(`[SCRAPER_DEBUG_RAW][item:${i}] RAW_TEXT_END`)
        }
        return text
      })
      .get()
      .filter((t) => t.length >= 20)
    if (fromItems.length > 0) return Array.from(new Set(fromItems))
  }

  const articleRoots = $('.article-content, .field--name-body, .node__content, .article .content')
  if (articleRoots.length > 0) {
    const combined = cleanWhitespace(
      articleRoots
        .map((_, el) => $(el).text())
        .get()
        .join('\n'),
    )
    if (combined.length >= 20) {
      const dashed = splitBlocksByDashLines(combined)
      if (dashed.length > 0) return dashed
      return [combined]
    }
  }

  const text = fallbackRootText($)
  return Array.from(new Set(splitBlocksByDashLines(text)))
}

function detectStatus(block: string): 'cancelled' | 'remote' | 'duty' {
  const t = block.toLowerCase()
  if (/odwołan|odwolany|odwołane|zostają odwołane|zostaja odwolane|anulowan/.test(t)) return 'cancelled'
  if (/zdaln|zdalnie|tryb zdalny|ms teams|platformie pegaz|asynchroniczn/.test(t)) return 'remote'
  if (/dyżur|dyzur/.test(t)) return 'duty'
  return 'duty'
}

function extractLecturer(block: string): string {
  const oneLine = block.replace(/\s+/g, ' ').trim()
  // Keep support for short surnames (e.g. Zych) and hyphenated forms.
  const namePart = String.raw`[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+(?:-[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+)?(?:\s+[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+(?:-[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźż]+)?)?`
  const patterns: RegExp[] = [
    new RegExp(String.raw`\b(dr\s+hab\.\s+${namePart}(?:\s*,\s*prof\.\s+UJ)?)`, 'i'),
    new RegExp(String.raw`\b(dr\.?\s+inż\.?\s+${namePart})`, 'i'),
    new RegExp(String.raw`\b(dr\.?\s+${namePart})`),
    new RegExp(String.raw`\b(prof\.?\s+${namePart})`, 'i'),
    new RegExp(String.raw`\b(mgr\.?\s+${namePart})`, 'i'),
  ]
  for (const re of patterns) {
    const m = oneLine.match(re)
    if (m?.[1]) return clipLecturerPhrase(m[1])
  }
  return FALLBACK_LECTURER_NAME
}

function isTechnicalJunkBlock(block: string): boolean {
  const t = block
  if (/jQuery\s*\(/i.test(t)) return true
  if (/document\.ready/i.test(t)) return true
  if (/\.hidden\s*\{/i.test(t)) return true
  if (/\.placeholder\s*\{/i.test(t) && /\.resizing/i.test(t)) return true
  if (/var\s+vid_w\s*=/i.test(t)) return true
  if (/\bfunction\s*\([^)]*\)\s*\{/.test(t) && t.includes('jQuery')) return true
  if (/@media\s+all\s+and/i.test(t) && /\{\s*display\s*:/i.test(t)) return true
  if (/html\.aui|#p_p_id_/i.test(t)) return true
  return false
}

function junkBlock(block: string): boolean {
  if (block.length < 30) return true
  if (isTechnicalJunkBlock(block)) return true
  const urls = block.match(/https?:\/\//g)
  if (urls && urls.length >= 4 && block.length < 500) return true
  if (/^\s*[-•*]\s+\[/.test(block) && block.includes('rekrutacja')) return true
  return false
}

const ANNOUNCEMENT_START_RE = /(Szanowni Państwo|Drogie Studentki,\s*Drodzy Studenci)/gi

function splitCandidateAnnouncements(block: string): string[] {
  const starts = Array.from(block.matchAll(ANNOUNCEMENT_START_RE))
  if (starts.length === 0) return [block]
  const slices: string[] = []
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]?.index ?? 0
    const nextStart = starts[i + 1]?.index ?? block.length
    const chunk = block.slice(start, nextStart).trim()
    if (chunk.length >= 20) slices.push(chunk)
  }
  return slices.length > 0 ? slices : [block]
}

export function parsePage(html: string): Row[] {
  const blocks = extractBlocksFromHtml(html)

  const rows: Row[] = []
  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i]
    if (SCRAPER_DEBUG_RAW) {
      console.log(`[SCRAPER_DEBUG_RAW][block:${i}] PRE_FILTER_START`)
      console.log(raw)
      console.log(`[SCRAPER_DEBUG_RAW][block:${i}] PRE_FILTER_END`)
    }

    const cleaned = cleanupAnnouncementText(raw)
    const candidates = splitCandidateAnnouncements(cleaned)

    for (let c = 0; c < candidates.length; c++) {
      let body = stripLecturerIntroPhrases(candidates[c] ?? '')
      if (junkBlock(body)) {
        if (SCRAPER_DEBUG_RAW) {
          console.log(`[SCRAPER_DEBUG_RAW][block:${i}][candidate:${c}] SKIPPED_AS_JUNK`)
        }
        continue
      }
      rows.push({
        lecturer_name: extractLecturer(body),
        body,
        status: detectStatus(body),
        department: DEPARTMENT,
        source: ANNOUNCEMENT_SOURCE,
      })
    }
  }
  if (SCRAPER_DEBUG_RAW) {
    const uniqueBodies = new Set(rows.map((r) => bodyFingerprintHex(r.body)))
    console.log('[SCRAPER_DEBUG_RAW] parsed rows:', rows.length, 'unique body hashes:', uniqueBodies.size)
    if (uniqueBodies.size !== rows.length) {
      console.log('[SCRAPER_DEBUG_RAW] potential duplicate bodies detected in scrape payload')
    }
  }
  return rows
}

/** Pobiera HTML z ISI i zwraca sparsowane wiersze (bez Groq). */
async function scrapeData(): Promise<Row[]> {
  const { data: html, status } = await axios.get<string>(SOURCE_URL, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    timeout: 30000,
    responseType: 'text',
    transformResponse: [(d) => d],
  })

  if (status !== 200 || typeof html !== 'string') {
    throw new Error('Bad response from ISI')
  }

  return parsePage(html)
}

/**
 * Vercel Cron wstrzykuje `Authorization: Bearer ${CRON_SECRET}` jako header
 * (a nie query param), więc obsługujemy obie formy — query token dla
 * manualnych curli i Bearer dla Vercel Cron. Bez tego cron leciałby 401
 * i komunikaty stałyby w miejscu (regresja sprzed 9.06.2026).
 */
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

  try {
    const rows = await scrapeData()
    if (rows.length === 0) {
      return res.status(200).json({ ok: true, upserted: 0, scanned: 0, message: 'No blocks parsed' })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const originalRows = rows.map((r) => ({ ...r }))
    const finalRows: Row[] = []
    for (const row of rows) {
      const fixedName = await lecturerNameToNominativeWithCache(supabase, row.lecturer_name)
      finalRows.push({ ...row, lecturer_name: fixedName })
    }

    const renamedRows = originalRows
      .map((original, i) => {
        const normalized = finalRows[i]
        if (!normalized) return null
        return {
          body_fingerprint: bodyFingerprintHex(original.body),
          from: original.lecturer_name,
          to: normalized.lecturer_name,
        }
      })
      .filter(Boolean) as Array<{ body_fingerprint: string; from: string; to: string }>

    /** Musi zawierać `body_fingerprint` — PostgREST rozwiązuje konflikt po unikalnym indeksie; bez tej kolumny w payloadzie zachowanie bywa niejednoznaczne. Wartość = ta sama co w triggerze `set_announcement_body_fingerprint` (md5 treści UTF-8). */
    const rowsForDb = finalRows.map((r) => {
      const author = forceSafeAuthorForDb(r.lecturer_name)
      console.log('FINAL AUTHOR BEFORE DB:', author)
      return {
        ...r,
        lecturer_name: author,
        body_fingerprint: bodyFingerprintHex(r.body),
      }
    })

    /**
     * Pojedyncze upserty zamiast batcha — PostgREST + trigger
     * `set_announcement_body_fingerprint` w bulk-mode rzuca niejasne
     * XX000 "Quote command returned error" (znana klasa bugów PostgREST,
     * GH #3712). Per-row daje: 1) izolację sypiącego rzędu, 2) idempotentność
     * po `body_fingerprint`, 3) atomowość per-komunikat zamiast all-or-nothing.
     */
    let upsertedCount = 0
    const failedRows: Array<{ fingerprint: string; lecturer: string; error: string }> = []
    for (const row of rowsForDb) {
      const { error } = await supabase.from('announcements').upsert(row, {
        onConflict: 'body_fingerprint',
      })
      if (error) {
        const errorDetails = {
          message: error.message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
          fingerprint: row.body_fingerprint,
          lecturer: row.lecturer_name,
          bodyLength: row.body.length,
        }
        console.error('[scrape-wziks] single row upsert failed:', JSON.stringify(errorDetails))
        failedRows.push({
          fingerprint: row.body_fingerprint,
          lecturer: row.lecturer_name,
          error: error.message,
        })
        continue
      }
      upsertedCount += 1
    }

    if (upsertedCount === 0 && failedRows.length > 0) {
      return res.status(500).json({
        error: 'All upserts failed',
        failedRows,
      })
    }

    if (renamedRows.length > 0) {
      await Promise.all(
        renamedRows.map(async (row) => {
          await supabase
            .from('announcements')
            .update({ lecturer_name: row.to })
            .eq('body_fingerprint', row.body_fingerprint)
        }),
      )
    }

    return res.status(200).json({
      ok: true,
      upserted: upsertedCount,
      scanned: finalRows.length,
      failed: failedRows.length,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
