/**
 * Jednorazowy skrypt: usuwa wszystkie wydarzenia utworzone przez użytkowników
 * z tabeli `public.events`.
 *
 * Kryterium: `is_official IS NOT TRUE` — czyli wszystkie wiersze poza tymi
 * jawnie oznaczonymi jako oficjalne (legacy, sprzed migracji `official_events`).
 * Nowa tabela `public.official_events` nie jest dotykana.
 *
 * Skrypt bypassa RLS przez `SUPABASE_SERVICE_ROLE_KEY` z `.env.local`.
 *
 * Uruchomienie:
 *   npx tsx scripts/purge-user-events.ts          # dry-run (tylko liczy)
 *   npx tsx scripts/purge-user-events.ts --apply  # faktyczne usunięcie
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

type EventRow = {
  id: string | number
  user_id: string | null
  title: string | null
  date: string | null
}

async function fetchAllEvents(): Promise<EventRow[]> {
  const out: EventRow[] = []
  const BATCH = 1000
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, user_id, title, date')
      .order('date', { ascending: false })
      .range(offset, offset + BATCH - 1)
    if (error) {
      throw new Error(`select events: ${error.message || JSON.stringify(error)}`)
    }
    const rows = (data ?? []) as EventRow[]
    out.push(...rows)
    if (rows.length < BATCH) break
    offset += BATCH
  }
  return out
}

async function fetchOfficialEventsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('official_events')
    .select('id', { count: 'exact', head: true })
  if (error) {
    // Tabela może nie istnieć w starszych projektach — to nie jest blocker.
    console.warn(`[purge-user-events] Ostrzeżenie: nie udało się policzyć official_events (${error.message || JSON.stringify(error)}).`)
    return 0
  }
  return count ?? 0
}

async function main(): Promise<void> {
  console.log(`[purge-user-events] Supabase: ${SUPABASE_URL}`)
  console.log(`[purge-user-events] Tryb: ${APPLY ? 'APPLY (DELETE)' : 'DRY-RUN (zapowiedź)'}`)
  console.log('')
  console.log('[purge-user-events] Schemat: `public.events` zawiera WYŁĄCZNIE wydarzenia użytkowników')
  console.log('[purge-user-events] (oficjalne UJ żyją w `public.official_events` — NIE są dotykane).')
  console.log('')

  const officialCount = await fetchOfficialEventsCount()
  const userRows = await fetchAllEvents()
  const targetCount = userRows.length
  const totalBefore = targetCount
  const targetSample = userRows.slice(0, 10)

  console.log(`[purge-user-events] events (użytkowników, target): ${targetCount}`)
  console.log(`[purge-user-events] official_events (zostają):     ${officialCount}`)
  console.log('')

  if (totalBefore === 0) {
    console.log('[purge-user-events] Tabela `events` jest już pusta. Koniec.')
    return
  }

  console.log('[purge-user-events] Próbka pierwszych 10 wierszy do usunięcia:')
  for (const row of targetSample) {
    console.log(
      `  • ${String(row.id).padEnd(38)}  user_id=${(row.user_id ?? '∅').toString().slice(0, 8).padEnd(8)}  ` +
        `${row.date ?? '∅'}  ${row.title ?? '∅'}`,
    )
  }
  console.log('')

  if (!APPLY) {
    console.log('[purge-user-events] DRY-RUN — żaden wiersz nie został usunięty.')
    console.log('[purge-user-events] Aby wykonać DELETE, dodaj flagę --apply.')
    return
  }

  // Usuwamy wsadowo po ID — niezawodne, niezależne od działania `.or()` na count.
  const idsToDelete = userRows.map((r) => r.id)
  const CHUNK = 500
  let totalDeleted = 0
  for (let i = 0; i < idsToDelete.length; i += CHUNK) {
    const chunk = idsToDelete.slice(i, i + CHUNK)
    const { error: deleteError, count: deletedCount } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .in('id', chunk)
    if (deleteError) {
      console.error('[purge-user-events] BŁĄD DELETE:', deleteError)
      process.exit(1)
    }
    totalDeleted += deletedCount ?? 0
    console.log(`[purge-user-events] Usunięto partię ${i / CHUNK + 1}: ${deletedCount ?? 0} wierszy.`)
  }

  const after = await fetchAllEvents()
  console.log(`[purge-user-events] Łącznie usunięto: ${totalDeleted}`)
  console.log(`[purge-user-events] events po czyszczeniu: ${after.length}`)
  console.log('[purge-user-events] Gotowe.')
}

main().catch((error) => {
  console.error('[purge-user-events] BŁĄD:', error)
  process.exit(1)
})
