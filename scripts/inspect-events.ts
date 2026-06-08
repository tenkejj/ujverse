/**
 * Quick diagnostic — wypisz wszystkie wiersze z `public.events`
 * (user-created). Świadomie kontrastuje z `inspect-official-events.ts`
 * który czyta `official_events`. Używamy gdy chcemy zobaczyć co
 * użytkownicy realnie wprowadzili (np. do dobrania quick promptów).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim()
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Brak VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main(): Promise<void> {
  const { data, error, count } = await supabase
    .from('events')
    .select('id, title, date, location, description', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    console.error('select error:', error)
    process.exit(1)
  }

  console.log(`[inspect-events] total: ${count ?? '∅'}, showing: ${data?.length ?? 0}\n`)
  for (const r of data ?? []) {
    console.log(`  ${r.date}  ${r.title}`)
    if (r.location) console.log(`      @ ${r.location}`)
    if (r.description) console.log(`      desc: ${String(r.description).slice(0, 100)}`)
    console.log('')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
