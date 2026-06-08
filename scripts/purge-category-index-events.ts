/**
 * Jednorazowy skrypt: usuwa z `public.official_events` rekordy, które są
 * w rzeczywistości stronami-indeksami kategorii w portalu UJ
 * (Popularne wydarzenia / Konferencje / Wykłady / Kultura / Konkursy /
 * Nauka / Warto zobaczyć / Na skróty / Wiadomości), a NIE pojedynczymi
 * wydarzeniami.
 *
 * Kryterium identyfikacji (kolejność OR):
 *   1. URL kończy się na 2-segmentowej ścieżce `/kalendarz/<slug>` — to z definicji
 *      index kategorii (prawdziwe eventy są głębiej).
 *   2. URL kończy się na `/wiadomosci` lub `/wiadomosci/<kategoria>` (≤2 segmenty po hoście).
 *   3. external_id zawiera segment kategorii z poniższej listy (na wszelki wypadek).
 *
 * Skrypt bypassa RLS przez `SUPABASE_SERVICE_ROLE_KEY` z `.env.local`.
 *
 * Uruchomienie:
 *   npx tsx scripts/purge-category-index-events.ts          # dry-run (tylko liczy)
 *   npx tsx scripts/purge-category-index-events.ts --apply  # faktyczne usunięcie
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL) {
  console.error('BŁĄD: Brak VITE_SUPABASE_URL (lub SUPABASE_URL) w .env.local')
  process.exit(1)
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('BŁĄD: Brak SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Tytuły kategorii (po normalizacji) — defense-in-depth obok testu URL. */
const CATEGORY_TITLES = new Set([
  'popularne wydarzenia',
  'konferencje',
  'wyklady',
  'wykłady',
  'kultura',
  'konkursy',
  'nauka',
  'warto zobaczyc',
  'warto zobaczyć',
  'na skroty',
  'na skróty',
  'wiadomosci',
  'wiadomości',
  'kalendarz',
])

type EventRow = {
  id: string
  external_id: string | null
  title: string | null
  event_url: string | null
  date: string | null
}

function normalizeTitle(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Liczy „rzeczywiste" segmenty ścieżki — bez pustych, bez końcowego slasha.
 * `/kalendarz/popularne-wydarzenia/` → 2.
 * `/kalendarz/konferencje/-/journal_content/56/abc/123` → 6.
 */
function pathDepth(url: string): number {
  try {
    const u = new URL(url)
    return u.pathname.split('/').filter(Boolean).length
  } catch {
    return 0
  }
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

function isCategoryIndex(row: EventRow): { match: boolean; reason: string } {
  const url = row.event_url?.trim() ?? ''
  if (!url) {
    return { match: false, reason: '' }
  }

  const path = pathnameOf(url)
  const depth = pathDepth(url)
  const hasArchetype = /\/-\/|journal_content/i.test(path)

  if (path.startsWith('/kalendarz/') && depth <= 2 && !hasArchetype) {
    return { match: true, reason: `kalendarz-index (depth=${depth})` }
  }
  if (path === '/kalendarz' || path === '/wiadomosci') {
    return { match: true, reason: 'hub-root' }
  }
  if (path.startsWith('/wiadomosci/') && depth <= 2 && !hasArchetype) {
    return { match: true, reason: `wiadomosci-index (depth=${depth})` }
  }
  const titleNorm = normalizeTitle(row.title)
  if (titleNorm && CATEGORY_TITLES.has(titleNorm)) {
    return { match: true, reason: `category-title="${row.title}"` }
  }

  return { match: false, reason: '' }
}

async function fetchAllOfficialEvents(): Promise<EventRow[]> {
  const out: EventRow[] = []
  const BATCH = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('official_events')
      .select('id, external_id, title, event_url, date')
      .order('date', { ascending: false })
      .range(offset, offset + BATCH - 1)
    if (error) {
      throw new Error(`select official_events: ${error.message || JSON.stringify(error)}`)
    }
    const rows = (data ?? []) as EventRow[]
    out.push(...rows)
    if (rows.length < BATCH) break
    offset += BATCH
  }
  return out
}

async function main(): Promise<void> {
  console.log(`[purge-category-index] Supabase: ${SUPABASE_URL}`)
  console.log(`[purge-category-index] Tryb: ${APPLY ? 'APPLY (DELETE)' : 'DRY-RUN (zapowiedź)'}`)
  console.log('')

  const all = await fetchAllOfficialEvents()
  console.log(`[purge-category-index] official_events łącznie: ${all.length}`)

  const targets: Array<{ row: EventRow; reason: string }> = []
  for (const row of all) {
    const { match, reason } = isCategoryIndex(row)
    if (match) targets.push({ row, reason })
  }

  console.log(`[purge-category-index] Kategorie-indeksy do usunięcia: ${targets.length}`)
  console.log(`[purge-category-index] Prawdziwe wydarzenia (zostają): ${all.length - targets.length}`)
  console.log('')

  if (targets.length === 0) {
    console.log('[purge-category-index] Nic do usunięcia. Koniec.')
    return
  }

  console.log('[purge-category-index] Lista wierszy zakwalifikowanych do usunięcia:')
  for (const t of targets) {
    console.log(
      `  • ${t.row.id.padEnd(38)}  [${t.reason}]\n` +
        `      title=${t.row.title ?? '∅'}\n` +
        `      url=${t.row.event_url ?? '∅'}`,
    )
  }
  console.log('')

  if (!APPLY) {
    console.log('[purge-category-index] DRY-RUN — żaden wiersz nie został usunięty.')
    console.log('[purge-category-index] Aby wykonać DELETE, dodaj flagę --apply.')
    return
  }

  const ids = targets.map((t) => t.row.id)
  const CHUNK = 500
  let totalDeleted = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const { error: deleteError, count: deletedCount } = await supabase
      .from('official_events')
      .delete({ count: 'exact' })
      .in('id', chunk)
    if (deleteError) {
      console.error('[purge-category-index] BŁĄD DELETE:', deleteError)
      process.exit(1)
    }
    totalDeleted += deletedCount ?? 0
    console.log(`[purge-category-index] Usunięto partię ${i / CHUNK + 1}: ${deletedCount ?? 0} wierszy.`)
  }

  const { count: afterCount, error: afterError } = await supabase
    .from('official_events')
    .select('id', { count: 'exact', head: true })
  if (afterError) {
    console.warn('[purge-category-index] Ostrzeżenie przy count() po DELETE:', afterError)
  }
  console.log('')
  console.log(`[purge-category-index] Łącznie usunięto: ${totalDeleted}`)
  console.log(`[purge-category-index] official_events po czyszczeniu: ${afterCount ?? 'n/a'}`)
  console.log('[purge-category-index] Gotowe.')
}

main().catch((error) => {
  console.error('[purge-category-index] BŁĄD:', error)
  process.exit(1)
})
