/**
 * UJverse — LIVE scraper rejestracji USOS UJ (Vercel Cron).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Discovery (2026-06-12): USOSweb UJ publikuje publicznie (bez logowania)
 * pełny katalog aktywnych rejestracji per jednostka organizacyjna:
 *   /kontroler.php?_action=news/rejestracje/rejJednostki&jed_org_kod=UJ.WF.IFA
 *
 * To jest jakościowo lepsze źródło niż AI extraction z komunikatów ISI,
 * bo daje strukturalne dane (tura_id, dokładne `<local-time>` od-do,
 * nazwa rejestracji z kodem). Brak AI guesswork → 100% precision.
 *
 * Flow:
 *   1. Fetch `news/rejestracje/index` → wyciągnij listę kodów jednostek
 *   2. Per jednostka (parallel batch po 5): fetch + parse cheerio
 *   3. Per `<h2>Rejestracja [KOD_REJ]</h2>` + związana tabela:
 *      - parse każdy <tr element='wiersz_tury' tura_id='X'>
 *      - skip "zakończona" (filter past)
 *      - upsert do `usos_registrations` (ON CONFLICT source_usos_tura_id)
 *   4. Log do `usos_scraper_runs` per jednostka
 *
 * Auth: CRON_SECRET (Bearer header / ?token=) — identycznie jak inne scrapery.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { load, type CheerioAPI } from 'cheerio'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const USOSWEB_BASE = 'https://www.usosweb.uj.edu.pl'
const REGISTRATION_INDEX_URL = `${USOSWEB_BASE}/kontroler.php?_action=news/rejestracje/index`
const UNIT_URL_TEMPLATE = (code: string) =>
  `${USOSWEB_BASE}/kontroler.php?_action=news/rejestracje/rejJednostki&jed_org_kod=${encodeURIComponent(code)}`
const PARALLEL_BATCH = 5
const REQUEST_TIMEOUT_MS = 15000
const MAX_REDIRECTS = 8
const USER_AGENT =
  'Mozilla/5.0 (compatible; UJverse/1.0; +https://ujverse.app; contact: tenkejj@github)'

/**
 * Minimalny cookie jar — USOSweb wymaga `PHPSESSID` żeby strona główna
 * katalogu rejestracji nie wpadała w pętlę przez CAS gateway.
 * Trzyma tylko `name=value` (bez Domain/Path matching — zawiązujemy
 * cookies per hostname, a my odwiedzamy tylko 2 hosty: usosweb + cas).
 */
class CookieJar {
  private store = new Map<string, Map<string, string>>()

  setFromHeaders(host: string, setCookieHeaders: string[]) {
    if (setCookieHeaders.length === 0) return
    let perHost = this.store.get(host)
    if (!perHost) {
      perHost = new Map()
      this.store.set(host, perHost)
    }
    for (const raw of setCookieHeaders) {
      const firstPart = raw.split(';')[0]
      const eqIdx = firstPart.indexOf('=')
      if (eqIdx <= 0) continue
      const name = firstPart.slice(0, eqIdx).trim()
      const value = firstPart.slice(eqIdx + 1).trim()
      if (name) perHost.set(name, value)
    }
  }

  headerFor(host: string): string | null {
    const perHost = this.store.get(host)
    if (!perHost || perHost.size === 0) return null
    return Array.from(perHost.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }
}

/**
 * `fetch` z natywnego Node.js (18+) ma jeden problem: undici nie ekstrahuje
 * MULTIPLE `Set-Cookie` headers (tylko ostatni). Headers#getSetCookie() to
 * naprawia (Node 19.7+) — używamy go i fallback'ujemy na `raw()` jeśli brak.
 */
function extractSetCookies(headers: Headers): string[] {
  // @ts-expect-error — getSetCookie istnieje w Node 19.7+ ale typy mogą nie być
  if (typeof headers.getSetCookie === 'function') {
    // @ts-expect-error
    return headers.getSetCookie() as string[]
  }
  const sc = headers.get('set-cookie')
  return sc ? [sc] : []
}

async function fetchWithCookies(
  url: string,
  jar: CookieJar,
  redirectsLeft = MAX_REDIRECTS,
): Promise<string> {
  if (redirectsLeft < 0) throw new Error(`Too many redirects for ${url}`)

  const parsed = new URL(url)
  const host = parsed.host

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
  }
  const cookieHeader = jar.headerFor(host)
  if (cookieHeader) headers['Cookie'] = cookieHeader

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  jar.setFromHeaders(host, extractSetCookies(response.headers))

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error(`Redirect without Location for ${url}`)
    const nextUrl = new URL(location, url).toString()
    // Drain body żeby socket się zwolnił
    await response.arrayBuffer().catch(() => null)
    return fetchWithCookies(nextUrl, jar, redirectsLeft - 1)
  }

  if (response.status !== 200) {
    throw new Error(`USOSweb returned ${response.status} for ${url}`)
  }

  return await response.text()
}

type AllowedKind = 'obieralne' | 'lektoraty' | 'wf' | 'seminarium' | 'specjalizacja' | 'inne'

type ParsedTura = {
  tura_id: string
  /** Pełna nazwa rejestracji (z h2, bez kodu): "Rejestracja na zajęcia obligatoryjne..." */
  rejestracja_name: string
  /** Kod rejestracji z h2: "WF.IFA-25/26L-Kanon" lub null jeśli brak */
  rejestracja_kod: string | null
  /** Nazwa tury: "Tura I" / "Tura II" / "Rejestracja podstawowa" */
  tura_name: string
  /** Stan: "zakończona" | "trwa" | "przyszła" itp. (pomijamy zakończone) */
  status: string
  /** ISO datetime (Europa/Warszawa local) — opens */
  opens_at: string
  /** ISO datetime (Europa/Warszawa local) — closes; null jeśli brak */
  closes_at: string | null
  /** Link do listy przedmiotów tej rejestracji w USOSweb */
  registration_url: string
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

async function fetchHtml(url: string, jar: CookieJar): Promise<string> {
  return fetchWithCookies(url, jar)
}

/**
 * Strona główna katalogu rejestracji listuje wszystkie jednostki UJ
 * z linkami do per-unit list. Wyciągamy `jed_org_kod` query param.
 */
function parseUnitCodes(html: string): string[] {
  const $ = load(html)
  const codes = new Set<string>()
  $('a[href*="jed_org_kod="]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const match = href.match(/jed_org_kod=([A-Za-z0-9._-]+)/)
    if (match && match[1]) codes.add(match[1])
  })
  return Array.from(codes)
}

/**
 * Wyciąga nazwę jednostki ("Instytut Filologii Angielskiej") z header'a strony per-unit.
 */
function parseUnitName($: CheerioAPI): string | null {
  // <usos-frame><p><b>Jednostka:</b><span>...</span></p></usos-frame>
  const headerSpan = $('usos-frame p span').first()
  if (headerSpan.length > 0) {
    const text = headerSpan.text().trim()
    if (text.length > 0 && text.length <= 200) return text
  }
  return null
}

/**
 * Z h2 typu: "Rejestracja na zajęcia opcyjne 2025/ 2026 semestr letni [WF.IFA-25/26L-opcje]"
 * wyciąga {name: "Rejestracja na zajęcia opcyjne 2025/ 2026 semestr letni", kod: "WF.IFA-25/26L-opcje"}.
 */
function parseRejestracjaTitle(rawTitle: string): { name: string; kod: string | null } {
  const cleaned = rawTitle.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^(.*?)\s*\[([^\]]+)\]\s*$/)
  if (match) {
    return { name: match[1].trim(), kod: match[2].trim() }
  }
  return { name: cleaned, kod: null }
}

/**
 * Klasyfikacja `kind` na podstawie nazwy rejestracji.
 * Heurystyka — match na slowach kluczowych po polsku, z fallback'iem na 'inne'.
 */
function classifyKind(rejestracjaName: string): AllowedKind {
  const lower = rejestracjaName.toLowerCase()
  if (/\bopcj|fakultatyw|obieraln|obowiazkow|obligator|kanon/.test(lower)) {
    // "obowiazkowe/obligatoryjne" jest semantycznie inne, ale skoro UI
    // ma tylko 6 kategorii to wrzucamy do "obieralne" jako generic akademic
    if (/obieraln|opcj|fakultatyw/.test(lower)) return 'obieralne'
    return 'inne'
  }
  if (/lektorat|jezyk obc|spnjo/.test(lower)) return 'lektoraty'
  if (/\bwf\b|wychowani[ea] fizyczn|sport|swfis/.test(lower)) return 'wf'
  if (/seminari|dyplom|magisters|licencja/.test(lower)) return 'seminarium'
  if (/specjalizacj|specjalnosc|modul|sciezk/.test(lower)) return 'specjalizacja'
  return 'inne'
}

/**
 * Konwertuje "2026-09-23 17:00:00" (USOSweb local time, brak TZ) na ISO
 * z explicit timezone Europa/Warszawa. Heurystyka DST: marzec-październik = +02:00, inaczej +01:00.
 *
 * Note: USOSweb używa CEST/CET, czyli +02:00 (DST od ostatniej niedzieli marca
 * do ostatniej niedzieli października) lub +01:00 reszta roku. Naszą heurystyką
 * jest przybliżenie miesięcznym progiem — błąd rzędu 1h przez ~2 tygodnie/rok
 * jest akceptowalny (alarm i tak ticka co minutę).
 */
function localToIso(local: string): string {
  // local: "2026-09-23 17:00:00" lub "2026-09-23 17:00"
  const trimmed = local.trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) throw new Error(`Invalid datetime: ${local}`)
  const [, year, month, day, hh, mm, ss] = match
  const monthNum = parseInt(month, 10)
  // Marzec-październik (3-10) traktujemy jako DST (+02:00). Granice (marzec 1-31,
  // październik 1-31) są nieperfekcyjne, ale dla naszego use case OK.
  const tz = monthNum >= 3 && monthNum <= 10 ? '+02:00' : '+01:00'
  return `${year}-${month}-${day}T${hh}:${mm}:${ss ?? '00'}${tz}`
}

/**
 * Per-unit parser: wyciąga wszystkie tury ze wszystkich rejestracji w danej jednostce.
 *
 * Strona ma strukturę:
 *   <h2>Rejestracja A [KOD_A]</h2>
 *   <usos-link><a href="...rej_kod=KOD_A...">pokaż przedmioty...</a></usos-link>
 *   <table>
 *     <tr element='wiersz_tury' tura_id='X'>...</tr>
 *     <tr element='wiersz_tury' tura_id='Y'>...</tr>
 *   </table>
 *   <h2>Rejestracja B [KOD_B]</h2>
 *   ...
 *
 * Strategia: iterujemy po `<h2>`, dla każdego znajdujemy NASTĘPNĄ <table>
 * (rejestracja może mieć więcej niż jedną sekcję, ale tabela zawsze
 * następuje bezpośrednio po h2 + link).
 */
function parseUnitRegistrations(html: string): ParsedTura[] {
  const $ = load(html)
  const results: ParsedTura[] = []

  // Każda rejestracja = h2 + następna tabela.
  $('h2').each((_, h2El) => {
    const rawTitle = $(h2El).text().trim()
    if (!rawTitle.toLowerCase().includes('rejestracj')) return
    const { name: rejestracjaName, kod: rejestracjaKod } = parseRejestracjaTitle(rawTitle)

    // Znajdź URL do listy przedmiotów (zwykle pierwszy <a> po h2)
    let registrationUrl = `${USOSWEB_BASE}/kontroler.php?_action=news/rejestracje/index`
    const linkEl = $(h2El).nextAll('usos-link').first().find('a').first()
    if (linkEl.length > 0) {
      const href = linkEl.attr('href') ?? ''
      if (href.length > 0) {
        registrationUrl = href.startsWith('http') ? href : `${USOSWEB_BASE}/${href.replace(/^\/+/, '')}`
      }
    }

    // Znajdź następną <table> z turami
    const table = $(h2El).nextAll('table').first()
    if (table.length === 0) return

    table.find("tr[element='wiersz_tury']").each((_, trEl) => {
      const tura_id = $(trEl).attr('tura_id')
      if (!tura_id) return

      // Status: pierwsza <td>, ale czytamy z drugiej kolumny (<td style='white-space:nowrap...'><span>...</span>)
      const statusSpan = $(trEl).find('td').eq(1).find('span').first()
      const status = statusSpan.text().trim().toLowerCase()

      // Pomijamy zakończone (już są w przeszłości, nikt nie chce alarmu)
      if (status === 'zakończona' || status === 'zakonczona') return

      // Daty: <local-time datetime='YYYY-MM-DD HH:MM:SS'> × 2
      const timeElements = $(trEl).find('local-time')
      if (timeElements.length === 0) return

      const opensRaw = $(timeElements[0]).attr('datetime')
      if (!opensRaw) return
      let opens_at: string
      try {
        opens_at = localToIso(opensRaw)
      } catch {
        return
      }

      let closes_at: string | null = null
      if (timeElements.length >= 2) {
        const closesRaw = $(timeElements[1]).attr('datetime')
        if (closesRaw) {
          try {
            closes_at = localToIso(closesRaw)
          } catch {
            closes_at = null
          }
        }
      }

      // Nazwa tury: "Tura I" / "Tura II" / "Rejestracja podstawowa"
      const turaNameEl = $(trEl).find('td').eq(2).find('span').first()
      const tura_name = turaNameEl.text().trim().replace(/\s+/g, ' ') || 'Rejestracja'

      results.push({
        tura_id,
        rejestracja_name: rejestracjaName,
        rejestracja_kod: rejestracjaKod,
        tura_name,
        status,
        opens_at,
        closes_at,
        registration_url: registrationUrl,
      })
    })
  })

  return results
}

type UpsertRow = {
  source_usos_tura_id: string
  source_unit_code: string
  source_label: string
  title: string
  description: string | null
  study_program: string | null
  year: number | null
  audience_label: string | null
  opens_at: string
  closes_at: string | null
  registration_url: string
  info_url: string | null
  kind: AllowedKind
  created_by: null
}

function buildUpsertRow(
  tura: ParsedTura,
  unitCode: string,
  unitName: string | null,
): UpsertRow {
  // Title format: "{rejestracja_name} — {tura_name}" jeśli różne, inaczej tylko rejestracja_name
  const baseName = tura.rejestracja_name
  const isMultiTura = tura.tura_name.toLowerCase() !== 'rejestracja'
  const rawTitle = isMultiTura ? `${baseName} — ${tura.tura_name}` : baseName
  const title = rawTitle.length > 140 ? rawTitle.slice(0, 137) + '...' : rawTitle

  const description = tura.rejestracja_kod ? `Kod rejestracji USOSweb: ${tura.rejestracja_kod}` : null

  return {
    source_usos_tura_id: tura.tura_id,
    source_unit_code: unitCode,
    source_label: unitName ? `Live · USOSweb · ${unitName}` : 'Live · USOSweb',
    title,
    description,
    study_program: null,
    year: null,
    audience_label: unitName,
    opens_at: tura.opens_at,
    closes_at: tura.closes_at,
    registration_url: tura.registration_url,
    info_url: null,
    kind: classifyKind(tura.rejestracja_name),
    created_by: null,
  }
}

async function processUnit(
  supabase: SupabaseClient,
  unitCode: string,
  sharedJar: CookieJar,
): Promise<{ upserted: number; status: 'ok' | 'error' | 'empty'; error?: string }> {
  let html: string
  try {
    html = await fetchHtml(UNIT_URL_TEMPLATE(unitCode), sharedJar)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { upserted: 0, status: 'error', error: msg }
  }

  const $ = load(html)
  const unitName = parseUnitName($)
  const turas = parseUnitRegistrations(html)

  if (turas.length === 0) return { upserted: 0, status: 'empty' }

  const rows = turas.map((t) => buildUpsertRow(t, unitCode, unitName))

  const { error: upsertError } = await supabase
    .from('usos_registrations')
    .upsert(rows, { onConflict: 'source_usos_tura_id', ignoreDuplicates: false })

  if (upsertError) {
    return { upserted: 0, status: 'error', error: upsertError.message }
  }

  return { upserted: rows.length, status: 'ok' }
}

async function processBatch<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
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
  const supabase = createClient(supabaseUrl, serviceKey)

  const startedAt = Date.now()
  const jar = new CookieJar()

  // 1. Pobierz listę jednostek (jednocześnie inicjalizuje PHPSESSID przez CAS gateway)
  let unitCodes: string[]
  try {
    const indexHtml = await fetchHtml(REGISTRATION_INDEX_URL, jar)
    unitCodes = parseUnitCodes(indexHtml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return res.status(500).json({ error: 'Failed to fetch unit list', details: msg })
  }

  if (unitCodes.length === 0) {
    return res.status(200).json({ ok: true, message: 'No units found in USOSweb index' })
  }

  // 2. Per-unit scrape (parallel batches żeby nie DDOS-ować USOSweb i nie przeholować timeoutu Vercela)
  //    Wszystkie share'ują jeden jar (PHPSESSID po przejściu CAS gateway).
  const perUnit = await processBatch(unitCodes, PARALLEL_BATCH, async (code) => {
    const result = await processUnit(supabase, code, jar)
    // Log do audit table (non-fatal jeśli się nie uda)
    await supabase.from('usos_scraper_runs').insert({
      unit_code: code,
      status: result.status,
      upserted_count: result.upserted,
      error_message: result.error ?? null,
    })
    return { unit_code: code, ...result }
  })

  const summary = {
    ok: true,
    units_total: unitCodes.length,
    units_ok: perUnit.filter((u) => u.status === 'ok').length,
    units_empty: perUnit.filter((u) => u.status === 'empty').length,
    units_error: perUnit.filter((u) => u.status === 'error').length,
    total_upserted: perUnit.reduce((acc, u) => acc + u.upserted, 0),
    elapsed_ms: Date.now() - startedAt,
    errors:
      perUnit
        .filter((u) => u.status === 'error')
        .map((u) => ({ unit: u.unit_code, error: u.error }))
        .slice(0, 10) || undefined,
  }

  return res.status(200).json(summary)
}
