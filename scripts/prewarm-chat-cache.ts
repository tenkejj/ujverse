/**
 * `prewarm-chat-cache.ts` — sekwencyjnie wystrzeliwuje do `/api/chat`
 * listę najczęstszych pytań, żeby załadować response cache (Vercel KV,
 * TTL = 300s) przed demem.
 *
 * Efekt na produkcji: kolejni użytkownicy zadający TE SAME pytania (po
 * normalizacji `trim+lower+collapse-whitespace` w `buildResponseCacheKey`)
 * dostaną odpowiedź z KV bez wywołania Groqa **ani** Supabase'a → zerowy
 * koszt tokenów + 0 ms cold-startu Groqa per pytanie.
 *
 * Uruchomienie:
 *   # production (domyślnie):
 *   tsx scripts/prewarm-chat-cache.ts https://ujverse.vercel.app
 *
 *   # albo via npm script (URL z argv lub env `PREWARM_BASE_URL`):
 *   npm run chat:prewarm -- https://ujverse.vercel.app
 *
 * Strategia bezpieczeństwa:
 * - Sekwencyjnie (nie równolegle), z `PAUSE_MS` między requestami — żeby
 *   sam skrypt nie wyzwolił 429 z Groqa podczas warmowania.
 * - Drenuje strumień SSE do końca (bez tego edge function mogłaby nie
 *   dokończyć zapisu do KV — `await kvSetSafe` siedzi PRZED zamknięciem
 *   strumienia, ale lepiej być pewnym że klient nie zerwie połączenia).
 *
 * Po zakończeniu: KV ma świeże wpisy ważne 5 min. Powtórz pre-warm tuż
 * przed startem dema (np. 1 min przed), żeby TTL nie wygasł w trakcie.
 */

import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BASE_URL =
  process.argv[2] ??
  process.env.PREWARM_BASE_URL ??
  'https://ujverse.vercel.app'

const ENDPOINT = `${BASE_URL.replace(/\/$/, '')}/api/chat`

/**
 * Lista pytań do warmowania. Świadomie pokrywa:
 * - 4 quick prompts z `ChatHubView.tsx` / `ChatAssistantFab.tsx`
 *   (KEEP IN SYNC z tamtymi `QUICK_PROMPTS`),
 * - typowe rozszerzenia (większa szansa na cache-hit dla pytań które
 *   ludzie wpiszą sami, blisko brzmiące do chipsów),
 * - jedno krótkie small-talk ("cześć") — small-talk path też trafia do
 *   response cache (`useTools=false` to inny klucz niż merytoryczne).
 *
 * UWAGA: response-cache key normalizuje tekst (`trim+lower+collapse-whitespace`),
 * więc „Najnowsze ogłoszenia" pokryje też „najnowsze ogłoszenia" i
 * „  Najnowsze   Ogłoszenia ". Ale NIE pokryje „Pokaż ogłoszenia" —
 * to inny tekst → inny klucz. Stąd kilka wariantów per intent.
 *
 * Kolejność: małe pytania najpierw (najmniej tokenów), żeby skrypt szybko
 * zaczął zwracać sukcesy w logu i było widać że coś się dzieje.
 */
const QUESTIONS: readonly string[] = [
  // small-talk path (useTools=false, własny cache key)
  'cześć',

  // 4 quick prompts — DOSŁOWNIE jak w UI (KEEP IN SYNC)
  'Co nowego na feedzie?',
  'Najnowsze ogłoszenia',
  'Co mam dziś w planie?',
  'Co mam jutro?',
  'Pokaż zniżki studenckie',
  'Co w Auli?',
  'Moje powiadomienia',
  'Co przegapiłem?',
  'Co w przyszłym tygodniu?',
  'Wydarzenia naukowe',

  // bliskie warianty — duża szansa że user wpisze coś takiego sam
  'Najnowsze posty',
  'Pokaż ogłoszenia',
  'Co się dzieje na UJ?',
  'Warsztaty na UJ',
  'Klub książki UJ',
  'Co w Auditorium Maximum?',
] as const

/** Pauza między requestami — ~1.2s rozprasza serię tak, żeby skrypt sam
 *  nie uderzył w RPM/TPM Groqa podczas warmowania.
 */
const PAUSE_MS = 1200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader()
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) bytes += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  return bytes
}

async function warmOne(text: string, idx: number, total: number): Promise<void> {
  const start = Date.now()
  const label = `[${idx + 1}/${total}] "${text}"`
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`${label} — HTTP ${res.status} ${body.slice(0, 120)}`)
      return
    }
    if (!res.body) {
      console.warn(`${label} — empty body (HTTP ${res.status})`)
      return
    }

    const bytes = await drainStream(res.body)
    const elapsed = Date.now() - start
    console.log(`${label} — OK ${elapsed}ms, ${bytes}B`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`${label} — ERR ${msg}`)
  }
}

async function main(): Promise<void> {
  console.log(`[prewarm] endpoint: ${ENDPOINT}`)
  console.log(
    `[prewarm] questions: ${QUESTIONS.length}, pause: ${PAUSE_MS}ms between calls`,
  )
  console.log(`[prewarm] estimated total: ~${Math.ceil((QUESTIONS.length * (PAUSE_MS + 3000)) / 1000)}s\n`)

  const startedAt = Date.now()
  for (let i = 0; i < QUESTIONS.length; i++) {
    await warmOne(QUESTIONS[i], i, QUESTIONS.length)
    if (i < QUESTIONS.length - 1) {
      await sleep(PAUSE_MS)
    }
  }
  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n[prewarm] Done in ${totalSec}s. KV TTL = 300s — re-run ~5min before demo.`)
}

main().catch((err) => {
  console.error('[prewarm] FATAL:', err)
  process.exit(1)
})
