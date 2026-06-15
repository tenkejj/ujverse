/**
 * Vercel serverless cron — pobiera nowe zniżki studenckie z zewnętrznych
 * źródeł (Samorząd UJ, ewentualnie inne agregatorzy) i upsertuje do
 * `public.student_discounts`. Drugi tryb `?op=expire` ukrywa zniżki, których
 * `valid_until < CURRENT_DATE` (soft-delete przez `hidden_at`).
 *
 * Auth: `?token=${CRON_SECRET}` lub `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Tryby:
 *   - default (bez query) lub `?op=scrape` → fetch + upsert
 *   - `?op=expire`                         → soft-delete wygasłych
 *
 * Idempotentność:
 *   - Scraper używa partial unique index `uniq_student_discounts_business_seed`
 *     z migracji 20260625100100, ale TYLKO dla `created_by IS NULL`. Scraper
 *     też wstawia z `created_by = NULL`, więc unique działa. ON CONFLICT DO
 *     NOTHING — istniejące wpisy są pomijane (nie nadpisujemy ręcznie
 *     edytowanych). Limit `MAX_NEW_PER_RUN`.
 *   - Expire: idempotent UPDATE.
 *
 * Defensive:
 *   - 404 / pusty HTML źródła → log warn, return `{ok:true, fetched:0}`.
 *   - Każde źródło scrapowane niezależnie (porażka jednego nie blokuje innych).
 *   - Wpisy bez `business_name` lub `discount_headline` są odrzucane.
 *
 * Verified flow:
 *   - Wpisy z scrapera dostają `verified_at = NULL` (czeka na admin review).
 *   - UI pokazuje takie zniżki bez badge'a "potwierdzone".
 *   - Admin zatwierdza ręcznie przez `verified_at = now(), verified_by = ...`
 *     w panelu (lub bezpośrednio w SQL na razie).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'
import { load } from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Maks. liczba nowych wpisów do upsertu w jednym uruchomieniu cron-a. */
const MAX_NEW_PER_RUN = 30

const ALLOWED_CATEGORIES = [
  'jedzenie',
  'kawa',
  'kultura',
  'kino',
  'sport',
  'ksiazki',
  'uslugi',
  'transport',
  'odziez',
  'inne',
] as const

type Category = (typeof ALLOWED_CATEGORIES)[number]

type ScrapedDiscount = {
  business_name: string
  discount_headline: string
  description: string | null
  category: Category
  address: string | null
  website_url: string | null
  source_url: string
}

/**
 * Lista źródeł — każde dostaje własny parser. Dziś jedno źródło, ale
 * struktura pozwala dorzucić kolejne agregatory bez zmiany handlera.
 */
type Source = {
  name: string
  url: string
  parser: (html: string, sourceUrl: string) => ScrapedDiscount[]
}

const SOURCES: readonly Source[] = [
  {
    name: 'samorzad-uj',
    url: 'https://samorzad.uj.edu.pl/znizki',
    parser: parseSamorzadUjPage,
  },
]

/**
 * Heurystyka dopasowania kategorii po słowach kluczowych. Świadomie
 * konserwatywna — gdy nic nie pasuje → 'inne'. Dla scrapowanych wpisów
 * to OK; admin może ręcznie poprawić po review.
 */
function guessCategory(text: string): Category {
  const t = text.toLowerCase()
  if (/(pizz|kebab|burger|sushi|pierog|obiad|restaur|bistro|fast.?food|stol[oó]wk|bagel|hummus|falafel|jedzenie)/.test(t)) {
    return 'jedzenie'
  }
  if (/(kaw|caf[eé]|coffee|espresso|kawiarni)/.test(t)) {
    return 'kawa'
  }
  if (/(kino|cinema)/.test(t)) {
    return 'kino'
  }
  if (/(teatr|muze|galeri|filharmoni|opera|koncert|kultur)/.test(t)) {
    return 'kultura'
  }
  if (/(siłown|silown|gym|fitness|crossfit|basen|wspina|sport|jog|biega)/.test(t)) {
    return 'sport'
  }
  if (/(ksi[aą]żk|ksiazk|book|empik|ksi[eę]g)/.test(t)) {
    return 'ksiazki'
  }
  if (/(autobus|tramwaj|mpk|rower|wavelo|hulajno|tier|transport|bilet semestraln)/.test(t)) {
    return 'transport'
  }
  if (/(odzie[żz]|sklep|moda|reserved|sinsay|vintage|deca?thlon|stradiv)/.test(t)) {
    return 'odziez'
  }
  if (/(drukar|fryzjer|kosmety|optyk|pralni|kurs|j[eę]zyk|salon|usług|przychod|stomat)/.test(t)) {
    return 'uslugi'
  }
  return 'inne'
}

/**
 * Parser strony Samorządu UJ (plain HTML). Strona może mieć układ
 * akordeonowy / listowy / tabeli — heurystyczny parser próbuje wyciągnąć
 * pary (nazwa firmy, opis zniżki) na podstawie struktury nagłówków +
 * paragrafów / list. Każde źródło ma swój parser, więc zmiana układu
 * jednego nie psuje pozostałych.
 *
 * Strategia (defense-in-depth):
 *   1. Każdy `h2/h3/h4` z tekstem [4..80] znaków = potencjalny `business_name`.
 *   2. Następujący po nim `p`/`li` z tekstem [10..600] znaków = headline.
 *   3. Pełen tekst sekcji (do następnego nagłówka) = description.
 *   4. URL z pierwszego `<a href>` w sekcji = website_url.
 *
 * Filtry:
 *   - business_name nie może zawierać samych liczb / dat.
 *   - description min. 10 znaków po trimmingu.
 *   - kategoria: heurystyka po treści.
 */
function parseSamorzadUjPage(html: string, sourceUrl: string): ScrapedDiscount[] {
  const $ = load(html)
  const results: ScrapedDiscount[] = []

  // Walk po nagłówkach h2-h4 - każdy traktujemy jako potencjalny biznes.
  $('h2, h3, h4').each((_, el) => {
    const $heading = $(el)
    const businessName = ($heading.text() ?? '').trim().replace(/\s+/g, ' ')
    if (!businessName || businessName.length < 4 || businessName.length > 80) {
      return
    }
    if (/^[\d\s.,/-]+$/.test(businessName)) return
    if (/^(spis|kategori|znizk|zniżk|oferta|partner)/i.test(businessName)) return

    // Zbieramy następne elementy aż do kolejnego nagłówka tego samego/wyższego poziomu.
    const sectionText: string[] = []
    let websiteUrl: string | null = null
    let next = $heading.next()
    let stepGuard = 0
    while (next.length > 0 && stepGuard < 12) {
      const tag = (next.prop('tagName') ?? '').toLowerCase()
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') break
      const txt = next.text().trim().replace(/\s+/g, ' ')
      if (txt) sectionText.push(txt)
      const href = next.find('a').first().attr('href')
      if (!websiteUrl && href && /^https?:\/\//i.test(href)) {
        websiteUrl = href
      }
      next = next.next()
      stepGuard++
    }

    const fullText = sectionText.join(' ').trim()
    if (fullText.length < 10) return

    // Headline = pierwsze zdanie / pierwsze 120 znaków.
    const firstSentence = (fullText.split(/[.!?]\s/)[0] ?? '').trim()
    const headline =
      firstSentence.length >= 5 && firstSentence.length <= 120
        ? firstSentence
        : fullText.slice(0, 120)
    if (headline.length < 5) return

    const description = fullText.slice(0, 1000)
    const category = guessCategory(`${businessName} ${fullText}`)

    results.push({
      business_name: businessName,
      discount_headline: headline,
      description: description.length > headline.length ? description : null,
      category,
      address: null, // Samorząd UJ nie zawsze podaje adres - admin uzupełnia
      website_url: websiteUrl,
      source_url: sourceUrl,
    })
  })

  // Dedup po (business_name lower-case) — strona może powtórzyć ten sam
  // biznes w wielu kategoriach.
  const seen = new Set<string>()
  const deduped: ScrapedDiscount[] = []
  for (const r of results) {
    const key = r.business_name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }
  return deduped
}

type ScrapeOutcome = {
  source: string
  url: string
  status: number | null
  bytes: number
  parsed: number
  error: string | null
}

async function scrapeOne(source: Source): Promise<{
  items: ScrapedDiscount[]
  diag: ScrapeOutcome
}> {
  const diag: ScrapeOutcome = {
    source: source.name,
    url: source.url,
    status: null,
    bytes: 0,
    parsed: 0,
    error: null,
  }
  try {
    const res = await axios.get<string>(source.url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 20000,
      responseType: 'text',
      transformResponse: [(d) => d],
      validateStatus: () => true,
    })
    diag.status = res.status
    const html = typeof res.data === 'string' ? res.data : ''
    diag.bytes = html.length

    if (res.status >= 400 || html.length < 200) {
      diag.error = `http ${res.status}, ${html.length} bytes`
      console.warn(`[scrape-discounts] ${source.name} unhealthy:`, diag.error)
      return { items: [], diag }
    }

    const items = source.parser(html, source.url)
    diag.parsed = items.length
    return { items, diag }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    diag.error = msg
    console.warn(`[scrape-discounts] ${source.name} failed:`, msg)
    return { items: [], diag }
  }
}

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

// Bez wyspecyfikowanego `Database` generic'a `createClient` infer'uje schema
// jako `never`, przez co Supabase typing odrzuca każdy `.insert()`/`.update()`
// jako "argument type 'never'". Eksplicytne `any, any, any` przywraca uniwersalny
// kształt klienta (runtime bez zmian — UJverse i tak nie generuje typów DB).
type SupabaseLikeClient = ReturnType<typeof createClient<any, any, any>>

/**
 * Tryb `expire` — soft-hide wszystkich zniżek z `valid_until < today`.
 * Idempotent: kolejne uruchomienia nie nadpisują wcześniej-ustawionego
 * `hidden_at` (filtr `hidden_at IS NULL`).
 */
async function runExpire(supabase: SupabaseLikeClient): Promise<{
  hidden: number
  error: string | null
}> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('student_discounts')
    .update({
      hidden_at: new Date().toISOString(),
      hidden_reason: 'expired',
    })
    .lt('valid_until', today)
    .is('hidden_at', null)
    .select('id')

  if (error) {
    console.error('[scrape-discounts] expire error:', error.message)
    return { hidden: 0, error: error.message }
  }
  return { hidden: Array.isArray(data) ? data.length : 0, error: null }
}

/**
 * Tryb `scrape` — fetch wszystkich źródeł, dedup, upsert ON CONFLICT DO
 * NOTHING. Zwraca diagnostykę + liczbę nowych wpisów.
 */
async function runScrape(supabase: SupabaseLikeClient): Promise<{
  inserted: number
  scanned: number
  diagnostics: ScrapeOutcome[]
  error: string | null
}> {
  const outcomes = await Promise.all(SOURCES.map((s) => scrapeOne(s)))
  const diagnostics = outcomes.map((o) => o.diag)
  const allItems = outcomes.flatMap((o) => o.items)

  // Dedup cross-source po lowercase business_name (gdy wiele źródeł
  // ma tę samą firmę — zostaje pierwsze trafienie).
  const seen = new Set<string>()
  const deduped: ScrapedDiscount[] = []
  for (const it of allItems) {
    const key = it.business_name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(it)
    if (deduped.length >= MAX_NEW_PER_RUN) break
  }

  if (deduped.length === 0) {
    return {
      inserted: 0,
      scanned: allItems.length,
      diagnostics,
      error: null,
    }
  }

  // Fetch wszystkich istniejących seed-businessów (`created_by IS NULL`),
  // żeby zfiltrować duplikaty po lowercase nazwie. Partial unique index
  // `uniq_student_discounts_business_seed` na `(lower(business_name)) WHERE
  // created_by IS NULL` z migracji 20260625100100 nie jest niestety
  // bezpośrednio konsumowalny przez PostgREST `onConflict` (na wyrażenie
  // `lower(...)` zamiast czystej kolumny). Robimy więc app-level dedup —
  // taniej i prościej dla < 1000 wpisów.
  const { data: existingData, error: existingErr } = await supabase
    .from('student_discounts')
    .select('business_name')
    .is('created_by', null)

  if (existingErr) {
    console.warn(
      '[scrape-discounts] existing fetch failed:',
      existingErr.message,
    )
  }
  const existingLower = new Set<string>()
  if (Array.isArray(existingData)) {
    for (const row of existingData) {
      const name = (row as { business_name?: string }).business_name
      if (typeof name === 'string') existingLower.add(name.toLowerCase())
    }
  }

  const newOnly = deduped.filter(
    (it) => !existingLower.has(it.business_name.toLowerCase()),
  )

  if (newOnly.length === 0) {
    return {
      inserted: 0,
      scanned: allItems.length,
      diagnostics,
      error: null,
    }
  }

  const rows = newOnly.map((it) => ({
    created_by: null,
    business_name: it.business_name,
    discount_headline: it.discount_headline,
    description: it.description,
    category: it.category,
    address: it.address,
    city: 'Kraków',
    website_url: it.website_url,
    source_url: it.source_url,
    requires_uj_id: true,
    // verified_at: NULL → wpisy z scrapera czekają na admin review.
    // Dopóki nie są zweryfikowane, UI nie pokaże "potwierdzone" badge'a.
  }))

  // Batch insert — partial unique index zadziała jako safety net przy
  // race-condition między scrapem a manualną edycją; w takim razie insert
  // wybuchnie i pomijamy ten rząd.
  let inserted = 0
  let lastError: string | null = null
  for (const row of rows) {
    const { error } = await supabase.from('student_discounts').insert(row)
    if (error) {
      // Błąd unique-violation oznacza tylko wyścig z innym uruchomieniem
      // lub manualną edycją — to nie jest fatal, traktujemy jak skip.
      if (error.code === '23505') {
        continue
      }
      console.warn(
        '[scrape-discounts] insert failed for',
        row.business_name,
        '—',
        error.message,
      )
      lastError = error.message
      continue
    }
    inserted++
  }

  return {
    inserted,
    scanned: allItems.length,
    diagnostics,
    error: lastError,
  }
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

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res
      .status(500)
      .json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (anonKey && serviceKey === anonKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY misconfigured (matches anon key)',
    })
  }

  const opParam = req.query.op
  const op =
    typeof opParam === 'string'
      ? opParam
      : Array.isArray(opParam)
        ? opParam[0]
        : 'scrape'

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    if (op === 'expire') {
      const result = await runExpire(supabase)
      if (result.error) {
        return res.status(500).json({ ok: false, error: result.error })
      }
      return res.status(200).json({
        ok: true,
        op: 'expire',
        hidden: result.hidden,
      })
    }

    if (op !== 'scrape') {
      return res
        .status(400)
        .json({ error: `unknown op: ${op}. Use 'scrape' or 'expire'.` })
    }

    const result = await runScrape(supabase)
    return res.status(200).json({
      ok: true,
      op: 'scrape',
      inserted: result.inserted,
      scanned: result.scanned,
      diagnostics: result.diagnostics,
      lastError: result.error,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[scrape-discounts] handler error:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
}
