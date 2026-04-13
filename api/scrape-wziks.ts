import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { load, type CheerioAPI } from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { lecturerNameToNominativeWithCache } from '../src/lib/ai-utils'

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

  const newsItems = $('.news-item')
  if (newsItems.length > 0) {
    const fromItems = newsItems
      .map((_, el) => cleanWhitespace($(el).text()))
      .get()
      .filter((t) => t.length >= 20)
    if (fromItems.length > 0) return fromItems
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
  return splitBlocksByDashLines(text)
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
  const namePart = String.raw`[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźżę]+(?:\s+[A-ZĆŁŚŹŻÓŃĄĘ][a-ząćęłńóśźżę]+)?`
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

export function parsePage(html: string): Row[] {
  const blocks = extractBlocksFromHtml(html)

  const rows: Row[] = []
  for (const raw of blocks) {
    let body = cleanupAnnouncementText(raw)
    body = stripLecturerIntroPhrases(body)
    if (junkBlock(body)) continue
    rows.push({
      lecturer_name: extractLecturer(body),
      body,
      status: detectStatus(body),
      department: DEPARTMENT,
      source: ANNOUNCEMENT_SOURCE,
    })
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tokenParam = req.query.token
  const token =
    typeof tokenParam === 'string' ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : undefined

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  if (token !== cronSecret) {
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
        if (normalized.lecturer_name === original.lecturer_name) return null
        return {
          body_fingerprint: bodyFingerprintHex(original.body),
          from: original.lecturer_name,
          to: normalized.lecturer_name,
        }
      })
      .filter(Boolean) as Array<{ body_fingerprint: string; from: string; to: string }>

    /** Musi zawierać `body_fingerprint` — PostgREST rozwiązuje konflikt po unikalnym indeksie; bez tej kolumny w payloadzie zachowanie bywa niejednoznaczne. Wartość = ta sama co w triggerze `set_announcement_body_fingerprint` (md5 treści UTF-8). */
    const rowsForDb = finalRows.map((r) => ({
      ...r,
      body_fingerprint: bodyFingerprintHex(r.body),
    }))

    const { error } = await supabase.from('announcements').upsert(rowsForDb, {
      onConflict: 'body_fingerprint',
    })

    if (error) {
      return res.status(500).json({ error: error.message })
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

    return res.status(200).json({ ok: true, upserted: finalRows.length, scanned: finalRows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
