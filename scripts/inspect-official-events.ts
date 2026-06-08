/**
 * Diagnostyka: wypisz top-N wierszy z `public.official_events` posortowanych
 * po dacie malejąco. Używaj, gdy lista oficjalnych w UI wygląda podejrzanie —
 * sprawdzisz czy widać past, czy DESC działa zgodnie z oczekiwaniem, czy
 * `event_url` prowadzi do rzeczywistego wydarzenia, etc.
 *
 * Bypass RLS przez `SUPABASE_SERVICE_ROLE_KEY` z `.env.local`.
 *
 * Uruchomienie:
 *   npx tsx scripts/inspect-official-events.ts              # top 20, wszystkie daty
 *   npx tsx scripts/inspect-official-events.ts --limit 50   # top 50
 *   npx tsx scripts/inspect-official-events.ts --future     # tylko date >= dziś
 *   npx tsx scripts/inspect-official-events.ts --past       # tylko date < dziś
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

function parseLimit(): number {
  const idx = process.argv.indexOf('--limit')
  if (idx === -1) return 20
  const v = parseInt(process.argv[idx + 1] ?? '', 10)
  return Number.isFinite(v) && v > 0 ? v : 20
}

const LIMIT = parseLimit()
const ONLY_FUTURE = process.argv.includes('--future')
const ONLY_PAST = process.argv.includes('--past')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function main(): Promise<void> {
  const today = startOfTodayIso()
  console.log(`[inspect-official-events] Supabase: ${SUPABASE_URL}`)
  console.log(`[inspect-official-events] Dzisiaj (cutoff): ${today}`)
  console.log(`[inspect-official-events] Limit: ${LIMIT}`)
  if (ONLY_FUTURE) console.log('[inspect-official-events] Filtr: TYLKO przyszłe (date >= today)')
  if (ONLY_PAST) console.log('[inspect-official-events] Filtr: TYLKO past (date < today)')
  console.log('')

  let q = supabase
    .from('official_events')
    .select('id, external_id, title, date, faculty, event_url, scraped_at', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(LIMIT)

  if (ONLY_FUTURE) q = q.gte('date', today)
  if (ONLY_PAST) q = q.lt('date', today)

  const { data, error, count } = await q
  if (error) {
    console.error('[inspect-official-events] BŁĄD select:', error)
    process.exit(1)
  }

  console.log(`[inspect-official-events] Łącznie wierszy (z filtrem): ${count ?? '∅'}`)
  console.log(`[inspect-official-events] Wyświetlam: ${data?.length ?? 0}`)
  console.log('')

  for (const row of data ?? []) {
    const d = new Date(row.date)
    const isPast = d.getTime() < new Date(today).getTime()
    const marker = isPast ? '⏪ PAST' : '⏩ FUTURE'
    console.log(
      `  ${marker}  ${row.date.padEnd(28)}  [${row.faculty}]\n` +
        `      title=${row.title}\n` +
        `      url=${row.event_url}\n` +
        `      ext_id=${row.external_id}\n`,
    )
  }
}

main().catch((error) => {
  console.error('[inspect-official-events] BŁĄD:', error)
  process.exit(1)
})
