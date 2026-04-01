/**
 * Silnik pobierania i normalizacji oficjalnych wydarzeń z serwisów UJ (WZiKS, kalendarz UJ).
 * Używa cache w localStorage (TTL 15 min) oraz proxy (Vite dev / allorigins) przy CORS.
 */

import type { UJEvent } from '../data/mockEvents'

export const WZIKS_NEWS_URL = 'https://wziks.uj.edu.pl/wiadomosci/aktualnosci'
export const UJ_CALENDAR_URL = 'https://www.uj.edu.pl/wiadomosci/kalendarz'

const OFFICIAL_CACHE_KEY = 'ujverse_official_ingest_v1'
export const OFFICIAL_CACHE_TTL_MS = 15 * 60 * 1000

let syncPromise: Promise<IngestSyncResult> | null = null

const CATEGORY_OFFICIAL = 'Oficjalne'

const FETCH_CHAIN_BUDGET_MS = 5000

const BROWSER_HEADERS: HeadersInit = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
}

export type IngestSyncResult = {
  events: UJEvent[]
  /** True gdy użyto zestawu awaryjnego (sieć niedostępna). */
  fromStaticFallback: boolean
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

export type IngestFaculty = 'WZiKS' | 'Uniwersytet Jagielloński'

type RawItem = {
  href: string
  title: string
  description: string
  imageUrl?: string
  date: Date
  faculty: IngestFaculty
}

function normalizeTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
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

function walkAncestorsDate(el: Element | null, maxDepth: number): Date | null {
  let cur: Element | null = el
  for (let i = 0; i < maxDepth && cur; i++) {
    const t = cur.textContent || ''
    const d = parsePolishOrNumericDate(t)
    if (d && !Number.isNaN(d.getTime())) return d
    const timeEl = cur.querySelector('time[datetime]')
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime')
      if (dt) {
        const parsed = new Date(dt)
        if (!Number.isNaN(parsed.getTime())) return parsed
      }
    }
    cur = cur.parentElement
  }
  return null
}

function findImageNear(el: Element | null, baseUrl: string, maxDepth: number): string | undefined {
  let cur: Element | null = el
  for (let i = 0; i < maxDepth && cur; i++) {
    const img = cur.querySelector('img[src]')
    if (img) {
      const src = img.getAttribute('src')
      if (src && !src.includes('data:') && !/icon|logo|sprite|pixel/i.test(src)) {
        try {
          return new URL(src, baseUrl).href
        } catch {
          return src
        }
      }
    }
    cur = cur.parentElement
  }
  return undefined
}

function isLikelyArticleLink(absUrl: string): boolean {
  try {
    const u = new URL(absUrl)
    if (!u.hostname.endsWith('uj.edu.pl') && !u.hostname.endsWith('wziks.uj.edu.pl')) return false
    if (!u.pathname.includes('/wiadomosci/')) return false
    if (/\/wiadomosci\/(aktualnosci|kalendarz)\/?$/i.test(u.pathname)) return false
    if (u.pathname.includes('/kategorie/')) return false
    if (/\/-\/|artykul|journal_content/i.test(u.pathname)) return true
    const seg = u.pathname.split('/').filter(Boolean).length
    if (seg < 4) return false
    if (/login|kandydaci/i.test(absUrl)) return false
    return true
  } catch {
    return false
  }
}

function externalIdFromUrl(absUrl: string, faculty: IngestFaculty): string {
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

function rawToUjEvent(raw: RawItem, ingestFromFallback = false): UJEvent {
  const ext = externalIdFromUrl(raw.href, raw.faculty)
  return {
    id: `ext:ingest:${ext.replace(/[^a-zA-Z0-9:_-]/g, '_')}`,
    external_id: ext,
    title: raw.title,
    date: raw.date,
    category: CATEGORY_OFFICIAL,
    location: raw.faculty === 'WZiKS' ? 'WZiKS UJ, Kraków' : 'Uniwersytet Jagielloński, Kraków',
    description: raw.description || 'Treść z oficjalnego serwisu UJ.',
    attendees: 0,
    is_official: true,
    faculty: raw.faculty,
    source_name: raw.faculty === 'WZiKS' ? 'WZiKS UJ' : 'Uniwersytet Jagielloński',
    event_url: raw.href,
    imageUrl: raw.imageUrl,
    ingest_from_fallback: ingestFromFallback || undefined,
  }
}

function dedupeByExternalId(items: UJEvent[]): UJEvent[] {
  const map = new Map<string, UJEvent>()
  for (const e of items) {
    const key = e.external_id ?? e.id
    if (!map.has(key)) map.set(key, e)
  }
  return [...map.values()]
}

async function fetchWithTimeout(
  resource: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const c = new AbortController()
  const t = window.setTimeout(() => c.abort(), timeoutMs)
  try {
    return await fetch(resource, { ...init, signal: c.signal })
  } finally {
    window.clearTimeout(t)
  }
}

function isUnusableHtml(body: string): boolean {
  const s = body.slice(0, 800).toLowerCase()
  if (body.length < 200) return true
  if (s.includes('<title>status</title>')) return true
  if (/error code:\s*52\d/.test(s)) return true
  if (s.includes('502 bad gateway') || s.includes('bad gateway')) return true
  if (s.includes('520:') || s.includes('522:')) return true
  if (s.includes('cloudflare') && s.includes('error')) return true
  return false
}

/**
 * Pobiera HTML: łańcuch proxy (Vite → corsproxy.io → allorigins), limit czasu na całość łańcucha.
 */
export async function fetchHtml(url: string): Promise<string> {
  const deadline = Date.now() + FETCH_CHAIN_BUDGET_MS
  const timeLeft = () => Math.max(200, deadline - Date.now())

  type Attempt = { label: string; buildUrl: () => string; sameOrigin?: boolean }
  const attempts: Attempt[] = []

  if (import.meta.env.DEV) {
    if (url === WZIKS_NEWS_URL) {
      attempts.push({ label: 'vite-proxy /api/ingest-wziks', buildUrl: () => '/api/ingest-wziks', sameOrigin: true })
    }
    if (url === UJ_CALENDAR_URL) {
      attempts.push({
        label: 'vite-proxy /api/ingest-uj-cal',
        buildUrl: () => '/api/ingest-uj-cal',
        sameOrigin: true,
      })
    }
    attempts.push({
      label: 'vite-query /api/ingest?url=',
      buildUrl: () => `/api/ingest?url=${encodeURIComponent(url)}`,
      sameOrigin: true,
    })
  }

  attempts.push({
    label: 'corsproxy.io',
    buildUrl: () => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  })
  attempts.push({
    label: 'allorigins',
    buildUrl: () => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  })

  let lastErr: unknown = null
  for (const { label, buildUrl, sameOrigin } of attempts) {
    const ms = timeLeft()
    if (ms < 250) {
      console.warn('[Ingestor] Limit 5s — przerywam kolejne próby dla', url)
      break
    }
    console.log(`[Ingestor] Próba przez ${label}…`)
    try {
      const r = await fetchWithTimeout(
        buildUrl(),
        {
          credentials: 'omit',
          mode: sameOrigin ? 'same-origin' : 'cors',
          headers: BROWSER_HEADERS,
        },
        ms,
      )
      if (!r.ok) {
        lastErr = new Error(`${label} HTTP ${r.status}`)
        continue
      }
      const t = await r.text()
      if (t.startsWith('error code:')) {
        lastErr = new Error(`${label}: ${t.slice(0, 60)}`)
        continue
      }
      if (isUnusableHtml(t)) {
        lastErr = new Error(`${label}: nieprawidłowa treść (502/520/status)`)
        continue
      }
      return t
    } catch (e) {
      lastErr = e
      console.warn(`[Ingestor] Błąd sieci (${label}):`, e)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** Zestaw awaryjny — WZiKS / UJ (demo), gdy cała sieć zawiedzie. */
export function getStaticFallbackOfficialEvents(): UJEvent[] {
  const y = new Date().getFullYear()
  const m = new Date().getMonth()
  const demoBase = 'https://wziks.uj.edu.pl/wiadomosci/aktualnosci'
  const mk = (
    i: number,
    title: string,
    desc: string,
    dayOffset: number,
    faculty: IngestFaculty,
  ): UJEvent => {
    const d = new Date(y, m, Math.min(28, new Date().getDate() + dayOffset), 12, 0, 0, 0)
    const href =
      faculty === 'WZiKS'
        ? `${demoBase}#offline-demo-${i}`
        : `https://www.uj.edu.pl/wiadomosci/kalendarz#offline-demo-${i}`
    const raw: RawItem = {
      href,
      title,
      description: desc,
      date: d,
      faculty,
    }
    return rawToUjEvent(raw, true)
  }

  return dedupeByExternalId([
    mk(
      1,
      'WZiKS — aktualności wydziału (tryb offline)',
      'To jest przykładowy wpis awaryjny. Po przywróceniu sieci zobaczysz prawdziwe dane z wziks.uj.edu.pl.',
      2,
      'WZiKS',
    ),
    mk(
      2,
      'Wydarzenia i ogłoszenia dla studentów WZiKS',
      'Zestaw demonstracyjny przy błędzie CORS lub przekroczeniu limitu proxy.',
      7,
      'WZiKS',
    ),
    mk(
      3,
      'Kalendarz UJ — tryb archiwalny',
      'Przykładowe wydarzenie ze strony głównej UJ (dane offline).',
      14,
      'Uniwersytet Jagielloński',
    ),
    mk(
      4,
      'Spotkania informacyjne — WZiKS',
      'Kolejny wpis awaryjny; odśwież stronę po naprawie połączenia.',
      21,
      'WZiKS',
    ),
  ])
}

function parseNewsListing(html: string, pageUrl: string, faculty: IngestFaculty): RawItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const baseUrl = new URL(pageUrl).origin
  const anchors = doc.querySelectorAll<HTMLAnchorElement>('a[href]')
  const seen = new Set<string>()
  const out: RawItem[] = []

  for (const a of anchors) {
    const href = a.getAttribute('href')
    if (!href || href === '#') continue
    let abs: string
    try {
      abs = new URL(href, pageUrl).href
    } catch {
      continue
    }
    if (!isLikelyArticleLink(abs)) continue
    if (seen.has(abs)) continue

    const title = normalizeTitle(a.textContent || '')
    if (title.length < 8 || title.length > 220) continue
    if (/^(czytaj więcej|więcej|zobacz|pdf|tutaj)$/i.test(title)) continue

    seen.add(abs)

    const date = walkAncestorsDate(a, 10) ?? new Date()
    const imageUrl = findImageNear(a, baseUrl, 8)
    let description = ''
    let p = a.parentElement
    for (let i = 0; i < 5 && p; i++) {
      const ps = p.querySelector('p')
      if (ps?.textContent && ps.textContent.trim().length > 40) {
        description = normalizeTitle(ps.textContent).slice(0, 500)
        break
      }
      p = p.parentElement
    }

    out.push({
      href: abs,
      title,
      description,
      imageUrl,
      date,
      faculty,
    })
  }

  return out.slice(0, 40)
}

async function enrichWithOgMeta(items: RawItem[], max = 8, concurrency = 2): Promise<RawItem[]> {
  const head = items.slice(0, max)
  const tail = items.slice(max)
  const result: RawItem[] = []

  for (let i = 0; i < head.length; i += concurrency) {
    const chunk = head.slice(i, i + concurrency)
    const done = await Promise.all(
      chunk.map(async (item) => {
        try {
          const html = await fetchHtml(item.href)
          const doc = new DOMParser().parseFromString(html, 'text/html')
          const ogI = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
          const ogD =
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
            doc.querySelector('meta[name="description"]')?.getAttribute('content')
          let imageUrl = item.imageUrl
          if (ogI) {
            try {
              imageUrl = new URL(ogI, item.href).href
            } catch {
              imageUrl = ogI
            }
          }
          const description = (ogD || item.description || '').trim().slice(0, 650)
          const t = doc.querySelector('time[datetime]')?.getAttribute('datetime')
          let date = item.date
          if (t) {
            const parsed = new Date(t)
            if (!Number.isNaN(parsed.getTime())) date = parsed
          }
          return { ...item, imageUrl, description, date }
        } catch {
          return item
        }
      }),
    )
    result.push(...done)
  }

  return [...result, ...tail]
}

type CachedPayload = {
  ts: number
  events: Array<Record<string, unknown>>
}

function serializeOfficial(e: UJEvent): Record<string, unknown> {
  return {
    ...e,
    date: e.date.toISOString(),
  }
}

function reviveFromCache(raw: Record<string, unknown>): UJEvent | null {
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  const d = raw.date
  const date =
    typeof d === 'string'
      ? new Date(d)
      : d instanceof Date
        ? d
        : null
  if (!date || Number.isNaN(date.getTime())) return null
  const ev: UJEvent = {
    id: raw.id,
    title: raw.title,
    date,
    category: typeof raw.category === 'string' ? raw.category : CATEGORY_OFFICIAL,
    location: typeof raw.location === 'string' ? raw.location : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    attendees: typeof raw.attendees === 'number' ? raw.attendees : 0,
    is_official: true,
  }
  if (typeof raw.external_id === 'string') ev.external_id = raw.external_id
  if (typeof raw.source_name === 'string') ev.source_name = raw.source_name
  if (typeof raw.event_url === 'string') ev.event_url = raw.event_url
  if (typeof raw.imageUrl === 'string') ev.imageUrl = raw.imageUrl
  if (typeof raw.faculty === 'string') ev.faculty = raw.faculty as UJEvent['faculty']
  if (typeof raw.ingest_from_fallback === 'boolean') ev.ingest_from_fallback = raw.ingest_from_fallback
  return ev
}

/** Odczyt ważnego cache (do inicjalizacji stanu przed siecią). */
export function readOfficialEventsFromCache(): UJEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(OFFICIAL_CACHE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as CachedPayload
    if (typeof data.ts !== 'number' || !Array.isArray(data.events)) return []
    if (Date.now() - data.ts > OFFICIAL_CACHE_TTL_MS) return []
    return data.events
      .map((o) => reviveFromCache(o))
      .filter((e): e is UJEvent => e !== null)
  } catch {
    return []
  }
}

function writeOfficialCache(events: UJEvent[]) {
  try {
    const payload: CachedPayload = {
      ts: Date.now(),
      events: events.map(serializeOfficial),
    }
    localStorage.setItem(OFFICIAL_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

/**
 * Synchronizacja z WZiKS + kalendarzem UJ. Szanuje cache 15 min (chyba że force).
 */
async function runSyncExternal(force: boolean): Promise<IngestSyncResult> {
  if (!force) {
    try {
      const raw = localStorage.getItem(OFFICIAL_CACHE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as CachedPayload
        if (typeof data.ts === 'number' && Date.now() - data.ts < OFFICIAL_CACHE_TTL_MS) {
          const revived = data.events
            .map((o) => reviveFromCache(o))
            .filter((e): e is UJEvent => e !== null)
          if (revived.length > 0) {
            return { events: dedupeByExternalId(revived), fromStaticFallback: false }
          }
        }
      }
    } catch {
      /* fetch fresh */
    }
  }

  let wziksItems: RawItem[] = []
  let ujItems: RawItem[] = []

  try {
    const [wzHtml, ujHtml] = await Promise.all([
      fetchHtml(WZIKS_NEWS_URL).catch((e) => {
        console.warn('[Ingestor] Błąd pobierania WZiKS:', e)
        return ''
      }),
      fetchHtml(UJ_CALENDAR_URL).catch((e) => {
        console.warn('[Ingestor] Błąd pobierania kalendarza UJ:', e)
        return ''
      }),
    ])
    if (wzHtml) wziksItems = parseNewsListing(wzHtml, WZIKS_NEWS_URL, 'WZiKS')
    if (ujHtml) ujItems = parseNewsListing(ujHtml, UJ_CALENDAR_URL, 'Uniwersytet Jagielloński')
  } catch (e) {
    console.warn('[Ingestor] Błąd podczas przetwarzania list:', e)
  }

  let combined = [...wziksItems, ...ujItems]
  if (combined.length > 0) {
    try {
      combined = await enrichWithOgMeta(combined, 8, 2)
    } catch (e) {
      console.warn('[Ingestor] Wzbogacenie meta — pominięte:', e)
    }
  }

  let events = dedupeByExternalId(combined.map((r) => rawToUjEvent(r, false)))

  if (events.length === 0) {
    const stale = readStaleOfficialFromStorage()
    if (stale.length > 0) {
      console.log('[Ingestor] Używam ostatniego zapisanego cache (poza TTL).')
      return { events: dedupeByExternalId(stale), fromStaticFallback: false }
    }
    console.warn('[Ingestor] Błąd sieci, ładuję dane awaryjne.')
    return { events: getStaticFallbackOfficialEvents(), fromStaticFallback: true }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime())
  writeOfficialCache(events)
  return { events, fromStaticFallback: false }
}

export async function syncExternalEvents(force = false): Promise<IngestSyncResult> {
  if (typeof window === 'undefined') {
    return { events: [], fromStaticFallback: false }
  }
  if (!force && syncPromise) return syncPromise

  syncPromise = (async (): Promise<IngestSyncResult> => {
    try {
      return await runSyncExternal(force)
    } catch (e) {
      console.error('[Ingestor] Nieoczekiwany błąd — dane awaryjne.', e)
      return { events: getStaticFallbackOfficialEvents(), fromStaticFallback: true }
    } finally {
      syncPromise = null
    }
  })()

  return syncPromise
}

/** Odczyt ostatniego zapisanego cache niezależnie od TTL (fallback przy błędzie sieci). */
function readStaleOfficialFromStorage(): UJEvent[] {
  try {
    const raw = localStorage.getItem(OFFICIAL_CACHE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as CachedPayload
    if (!Array.isArray(data.events)) return []
    return data.events
      .map((o) => reviveFromCache(o))
      .filter((e): e is UJEvent => e !== null)
  } catch {
    return []
  }
}

/** Ostatni znany zestaw oficjalnych (świeży cache lub przeterminowany — na pierwszy render). */
export function hydrateOfficialEventsFromStorage(): UJEvent[] {
  const fresh = readOfficialEventsFromCache()
  if (fresh.length > 0) return fresh
  return readStaleOfficialFromStorage()
}
