/**
 * Vercel serverless cron — scrapuje oficjalne wydarzenia z 3 stron UJ
 * (WZiKS, www.uj.edu.pl/wiadomosci, kalendarz UJ) i upsertuje do
 * `public.official_events`. Front czyta wyłącznie z Supabase — dzięki
 * temu nie ma już potrzeby trzymania proxy w `vite.config.ts` ani
 * publicznych CORS-proxy.
 *
 * Auth: `?token=${CRON_SECRET}` (kompatybilne ze `scrape-wziks`) lub
 *       `Authorization: Bearer ${CRON_SECRET}` (nagłówek dodawany
 *       automatycznie przez Vercel Cron gdy `CRON_SECRET` jest w env).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { load, type CheerioAPI } from 'cheerio'
import { createClient } from '@supabase/supabase-js'

/**
 * Subdomena `wziks.uj.edu.pl` jest publicznie niedostępna (ENOTFOUND z każdego
 * publicznego DNS-a, sprawdzone z Vercel iad1 + lokalnie z PL). UJ ją zwinął
 * albo wystawia tylko przez split-DNS dla studentów. Wydarzenia WZiKS-u i tak
 * pojawiają się w głównym kalendarzu `www.uj.edu.pl/kalendarz`, więc tracimy
 * niewiele.
 */
const UJ_NEWS_HUB_URL = 'https://www.uj.edu.pl/wiadomosci'
/** Stary `/wiadomosci/kalendarz` zwraca 404 — aktualny URL kalendarza UJ. */
const UJ_CALENDAR_URL = 'https://www.uj.edu.pl/kalendarz'

/**
 * Slugi w `/kalendarz/<slug>` które NIE są wydarzeniami tylko kategoriami
 * / formularzami / widokami. Wykrywane wprost — nie ma sensu kombinować
 * regexem, bo lista jest krótka i stabilna.
 */
const CALENDAR_NON_EVENT_SLUGS = new Set([
  'popularne',
  'konferencje',
  'konkursy',
  'konkurs',
  'formularz',
  'dodaj',
  'archiwum',
  'wszystkie',
  'kategorie',
  'kategoria',
])

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type Faculty = 'WZiKS' | 'Uniwersytet Jagielloński'

type ScrapedItem = {
  external_id: string
  title: string
  date: string
  category: string
  location: string
  description: string
  faculty: Faculty
  source_name: string
  event_url: string
  image_url: string | null
}

const PL_MONTH_RE =
  /(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|wrzesnia|października|pazdziernika|listopada|grudnia)\s+(\d{4})/i

const MONTH_MAP: Record<string, number> = {
  stycznia: 0,
  lutego: 1,
  marca: 2,
  kwietnia: 3,
  maja: 4,
  czerwca: 5,
  lipca: 6,
  sierpnia: 7,
  września: 8,
  wrzesnia: 8,
  października: 9,
  pazdziernika: 9,
  listopada: 10,
  grudnia: 11,
}

function parsePolishOrNumericDate(text: string): Date | null {
  const pl = text.match(PL_MONTH_RE)
  if (pl) {
    const day = parseInt(pl[1], 10)
    const mon = MONTH_MAP[pl[2].toLowerCase()]
    const year = parseInt(pl[3], 10)
    if (mon !== undefined && !Number.isNaN(day) && !Number.isNaN(year)) {
      return new Date(year, mon, day, 12, 0, 0, 0)
    }
  }
  const num = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/)
  if (num) {
    const d = parseInt(num[1], 10)
    const m = parseInt(num[2], 10) - 1
    const y = parseInt(num[3], 10)
    return new Date(y, m, d, 12, 0, 0, 0)
  }
  return null
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function isLikelyArticleLink(absUrl: string): boolean {
  try {
    const u = new URL(absUrl)

    // Tylko główny serwis UJ — wcag.uj.edu.pl, sso, panele itp. nie są wydarzeniami.
    if (u.hostname !== 'www.uj.edu.pl' && u.hostname !== 'uj.edu.pl') return false

    // Strony-koncentratory i ścieżki techniczne.
    if (/^\/?(wiadomosci|kalendarz|aktualnosci)\/?$/i.test(u.pathname)) return false
    if (/^\/wiadomosci\/(aktualnosci|kalendarz)\/?$/i.test(u.pathname)) return false
    if (u.pathname.includes('/kategorie/')) return false
    if (/login|kandydaci/i.test(absUrl)) return false

    // Kalendarz UJ — odsiej kategorie / formularze (nie są to wydarzenia).
    if (u.pathname.startsWith('/kalendarz/')) {
      const seg = u.pathname.split('/').filter(Boolean)
      const after = seg[1] ?? ''
      if (!after) return false
      if (CALENDAR_NON_EVENT_SLUGS.has(after.toLowerCase())) return false
      return seg.length >= 2
    }

    // Mocne sygnały „to jest artykuł / wydarzenie" (Liferay journal_content, archetypy „/-/" itd.).
    if (/\/-\/|artykul|journal_content/i.test(u.pathname)) return true

    // Stary szablon: artykuły siedzą w `/wiadomosci/<kategoria>/<slug>`.
    if (u.pathname.includes('/wiadomosci/')) {
      const seg = u.pathname.split('/').filter(Boolean).length
      return seg >= 3
    }

    return false
  } catch {
    return false
  }
}

/** „więcej o XYZ" / „Read more about XYZ" itp. — wyciągnij właściwy tytuł. */
function cleanAnchorTitle(raw: string): string {
  const t = normalizeWhitespace(raw)
  const m = t.match(/^(?:więcej o|wiecej o|czytaj więcej o|czytaj wiecej o|read more about)\s+(.+)$/i)
  if (m && m[1]) return m[1].trim()
  return t
}

function externalIdFromUrl(absUrl: string, faculty: Faculty): string {
  try {
    const u = new URL(absUrl)
    const path = u.pathname.replace(/\/+$/, '')
    const seg = path.split('/').filter(Boolean)
    const tail = seg.slice(-3).join('/') || path
    const prefix = faculty === 'WZiKS' ? 'wziks' : 'uj'
    return `${prefix}:${tail}`.slice(0, 220)
  } catch {
    return `${faculty}:${absUrl.slice(0, 120)}`
  }
}

/**
 * Wspina się po przodkach linku w poszukiwaniu daty (tekst PL/numeryczny lub `<time datetime>`).
 */
function findDateNear($: CheerioAPI, anchor: ReturnType<CheerioAPI>, maxDepth: number): Date | null {
  let cur = anchor
  for (let i = 0; i < maxDepth && cur.length > 0; i++) {
    const t = cur.text()
    const d = parsePolishOrNumericDate(t)
    if (d && !Number.isNaN(d.getTime())) return d
    const timeEl = cur.find('time[datetime]').first()
    if (timeEl.length > 0) {
      const dt = timeEl.attr('datetime')
      if (dt) {
        const parsed = new Date(dt)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
    }
    cur = cur.parent()
  }
  return null
}

function findImageNear(
  $: CheerioAPI,
  anchor: ReturnType<CheerioAPI>,
  baseUrl: string,
  maxDepth: number,
): string | null {
  let cur = anchor
  for (let i = 0; i < maxDepth && cur.length > 0; i++) {
    const img = cur.find('img[src]').first()
    if (img.length > 0) {
      const src = img.attr('src')
      if (src && !src.includes('data:') && !/icon|logo|sprite|pixel/i.test(src)) {
        try {
          return new URL(src, baseUrl).href
        } catch {
          return src
        }
      }
    }
    cur = cur.parent()
  }
  return null
}

function findDescriptionNear(anchor: ReturnType<CheerioAPI>, maxDepth: number): string {
  let cur = anchor
  for (let i = 0; i < maxDepth && cur.length > 0; i++) {
    const p = cur.find('p').first()
    const text = p.text()
    if (text && text.trim().length > 40) {
      return normalizeWhitespace(text).slice(0, 500)
    }
    cur = cur.parent()
  }
  return ''
}

function parseListing(html: string, pageUrl: string, faculty: Faculty): ScrapedItem[] {
  const $ = load(html)
  const baseUrl = new URL(pageUrl).origin
  const sourceName = faculty === 'WZiKS' ? 'WZiKS UJ' : 'Uniwersytet Jagielloński'
  const location =
    faculty === 'WZiKS' ? 'WZiKS UJ, Kraków' : 'Uniwersytet Jagielloński, Kraków'

  const seen = new Set<string>()
  const items: ScrapedItem[] = []

  $('a[href]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    if (!href || href === '#') return

    let abs: string
    try {
      abs = new URL(href, pageUrl).href
    } catch {
      return
    }
    if (!isLikelyArticleLink(abs)) return
    if (seen.has(abs)) return

    const title = cleanAnchorTitle($a.text())
    if (title.length < 8 || title.length > 300) return
    if (/^(czytaj więcej|więcej|zobacz|pdf|tutaj)$/i.test(title)) return

    seen.add(abs)

    const date = findDateNear($, $a, 10) ?? new Date()
    const image = findImageNear($, $a, baseUrl, 8)
    const description = findDescriptionNear($a, 5)

    items.push({
      external_id: externalIdFromUrl(abs, faculty),
      title,
      date: date.toISOString(),
      category: 'Oficjalne',
      location,
      description: description || 'Treść z oficjalnego serwisu UJ.',
      faculty,
      source_name: sourceName,
      event_url: abs,
      image_url: image,
    })
  })

  return items.slice(0, 40)
}

async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      // Dodatkowe nagłówki maskujące — niektóre WAFy (np. Cloudflare na wziks.uj.edu.pl)
      // zwracają 503 gdy widzą czysto-serwerowy fingerprint bez Sec-Fetch-* itp.
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    timeout: 20000,
    responseType: 'text',
    transformResponse: [(d) => d],
    validateStatus: (s) => s >= 200 && s < 400,
  })
  if (typeof res.data !== 'string') throw new Error(`bad payload ${url}`)
  return res.data
}

/**
 * Wzbogaca pierwsze N pozycji o `og:image` / `og:description` / `<time datetime>`
 * z indywidualnej strony artykułu (najczęściej tam są poprawne dane).
 */
async function enrichWithOgMeta(items: ScrapedItem[], max = 8): Promise<ScrapedItem[]> {
  const head = items.slice(0, max)
  const tail = items.slice(max)
  const enriched: ScrapedItem[] = []

  for (const item of head) {
    try {
      const html = await fetchHtml(item.event_url)
      const $ = load(html)
      const ogI = $('meta[property="og:image"]').attr('content') ?? null
      const ogD =
        $('meta[property="og:description"]').attr('content') ??
        $('meta[name="description"]').attr('content') ??
        null
      const timeIso = $('time[datetime]').first().attr('datetime') ?? null

      let image_url = item.image_url
      if (ogI) {
        try {
          image_url = new URL(ogI, item.event_url).href
        } catch {
          image_url = ogI
        }
      }
      let description = item.description
      if (ogD && ogD.trim().length > 0) {
        description = normalizeWhitespace(ogD).slice(0, 650)
      }
      let date = item.date
      if (timeIso) {
        const parsed = new Date(timeIso)
        if (!Number.isNaN(parsed.getTime())) date = parsed.toISOString()
      }
      enriched.push({ ...item, image_url, description, date })
    } catch {
      enriched.push(item)
    }
  }

  return [...enriched, ...tail]
}

function dedupeByExternalId(items: ScrapedItem[]): ScrapedItem[] {
  const map = new Map<string, ScrapedItem>()
  for (const it of items) {
    if (!map.has(it.external_id)) map.set(it.external_id, it)
  }
  return [...map.values()]
}

type ScrapeDiagnostic = {
  url: string
  faculty: Faculty
  status: number | null
  htmlBytes: number
  parsed: number
  /** Pierwsze ~160 znaków HTML — sygnatura WAF/Cloudflare/innej treści. */
  htmlPreview: string
  error: string | null
}

type ScrapeOutcome = { items: ScrapedItem[]; diag: ScrapeDiagnostic }

/**
 * Porażka jednego źródła nie psuje pozostałych. Zawsze zwraca diagnostykę
 * (status HTTP, długość HTML, podgląd) — przydatne do debug curlem.
 */
async function safeScrape(url: string, faculty: Faculty): Promise<ScrapeOutcome> {
  const diag: ScrapeDiagnostic = {
    url,
    faculty,
    status: null,
    htmlBytes: 0,
    parsed: 0,
    htmlPreview: '',
    error: null,
  }
  try {
    const res = await axios.get<string>(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      timeout: 20000,
      responseType: 'text',
      transformResponse: [(d) => d],
      validateStatus: () => true,
    })
    diag.status = res.status
    const html = typeof res.data === 'string' ? res.data : ''
    diag.htmlBytes = html.length
    diag.htmlPreview = html.slice(0, 160).replace(/\s+/g, ' ').trim()

    if (res.status >= 400 || html.length < 200) {
      diag.error = `http ${res.status}, ${html.length} bytes`
      return { items: [], diag }
    }

    const items = parseListing(html, url, faculty)
    diag.parsed = items.length
    return { items, diag }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    diag.error = msg
    console.warn(`[scrape-uj-events] ${faculty} ${url} failed:`, msg)
    return { items: [], diag }
  }
}

function isAuthorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

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

  if (!process.env.CRON_SECRET) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  if (!isAuthorized(req)) {
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

  const debug = req.query.debug === '1' || req.query.debug === 'true'

  try {
    const [ujNewsOut, ujCalOut] = await Promise.all([
      safeScrape(UJ_NEWS_HUB_URL, 'Uniwersytet Jagielloński'),
      safeScrape(UJ_CALENDAR_URL, 'Uniwersytet Jagielloński'),
    ])

    const combined = dedupeByExternalId([...ujNewsOut.items, ...ujCalOut.items])

    const diagnostics = {
      ujNews: ujNewsOut.diag,
      ujCal: ujCalOut.diag,
    }

    if (combined.length === 0) {
      return res.status(200).json({
        ok: true,
        upserted: 0,
        scanned: 0,
        sources: {
          ujNews: ujNewsOut.items.length,
          ujCal: ujCalOut.items.length,
        },
        diagnostics,
        message: 'No items parsed from any source',
      })
    }

    const enriched = await enrichWithOgMeta(combined, 8)

    const supabase = createClient(supabaseUrl, serviceKey)
    const rows = enriched.map((it) => ({
      external_id: it.external_id,
      title: it.title,
      date: it.date,
      category: it.category,
      location: it.location,
      description: it.description,
      faculty: it.faculty,
      source_name: it.source_name,
      event_url: it.event_url,
      image_url: it.image_url,
      scraped_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('official_events')
      .upsert(rows, { onConflict: 'external_id' })

    if (error) {
      return res.status(500).json({ error: error.message, diagnostics })
    }

    const response: Record<string, unknown> = {
      ok: true,
      upserted: rows.length,
      scanned: combined.length,
      sources: {
        ujNews: ujNewsOut.items.length,
        ujCal: ujCalOut.items.length,
      },
      diagnostics,
    }
    if (debug) {
      response.sampleTitles = enriched.slice(0, 30).map((it) => ({
        title: it.title,
        faculty: it.faculty,
        date: it.date,
        url: it.event_url,
        imageUrl: it.image_url,
      }))
    }
    return res.status(200).json(response)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}
