/**
 * Tool: `search_events`
 *
 * Wyszukuje wydarzenia po fragmencie tekstu (`title`, `description`,
 * `location`) w DWÓCH tabelach jednocześnie:
 *  - `public.events` — wydarzenia tworzone przez użytkowników UJverse,
 *  - `public.official_events` — oficjalne UJ scrapowane przez serverless
 *    cron (`api/scrape-uj-events.ts`, migracja `20260608170000`).
 *
 * Wzorzec `or(...ilike...)` jest 1:1 z `EventsAdapter.search()` po stronie
 * klienta (DB events + cache oficjalnych) — celowo, żeby semantyka
 * wyszukiwania widziana przez asystenta pokrywała się z wyszukiwarką w UI.
 *
 * Flag `is_official` JEST polem wyniku, ale NIE jest selectowane z DB —
 * `events` po prostu nie ma takiej kolumny (PostgREST 42703), a w
 * `official_events` „oficjalność" jest immanentna (cała tabela). Stąd
 * mapping syntetyczny: `events → false`, `official_events → true`.
 *
 * Strategia merge: każde query pobiera do `MAX_ROWS` wyników, łączymy,
 * sortujemy malejąco po dacie, przycinamy do `MAX_ROWS` całości. Jeśli
 * jedna z tabel rzuci błąd, zwracamy częściowe wyniki z drugiej (degradacja
 * funkcjonalna lepsza niż pełne `ok: false`); jeśli obie failują —
 * `ok: false` z agregatem komunikatów.
 *
 * Limit: 10. Nie filtrujemy po dacie — jeśli użytkownik pyta o przeszłe
 * wydarzenia ("co było w marcu na WZiKS?"), powinniśmy je znaleźć. Świeżość
 * (czy wydarzenie minęło) ocenia model na bazie `date` w wyniku.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_ROWS = 10
const MIN_QUERY_LEN = 2

/**
 * Komunikat zwracany do modelu gdy zapytanie nie znalazło wyników. Format
 * surowego string-a (zamiast pustego `{ ok: true, items: [] }`) świadomy —
 * model llama-3.1-8b-instant lepiej radzi sobie z literalnym tekstem przy
 * syntezie odpowiedzi "brak danych" niż z pustą tablicą JSON.
 */
const EMPTY_RESULT_MESSAGE = 'Brak danych w bazie dla tego zapytania'

function escapeIlikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

/**
 * Zod schema dla wiersza zwracanego przez Supabase z dowolnej z dwóch tabel
 * eventowych. Wspólny wąski podzbiór kolumn — `events.id` jest UUID/string,
 * `official_events.id` to UUID; oba lądują jako string w wyniku po
 * `String(r.id)`. Pełni rolę runtime "return type check" — jeśli schemat
 * się rozjedzie albo Postgres zwróci nieoczekiwane typy (np. `date` jako
 * liczba), `safeParse` wyłapie i nie pozwoli wpuścić śmieci.
 */
const EventRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string().nullable(),
})

const EventRowsSchema = z.array(EventRowSchema)

type EventRow = z.infer<typeof EventRowSchema>

const TABLE_SELECT = 'id, title, description, location, date'

export type SearchEventsArgs = {
  query: string
}

type ResultItem = {
  id: string
  title: string
  description: string
  location: string
  date: string | null
  is_official: boolean
}

export type SearchEventsResult = {
  ok: true
  count: number
  items: ResultItem[]
}

export type SearchEventsError = {
  ok: false
  error: string
}

/**
 * Wykonuje pojedyncze query do tabeli eventowej. Zwraca:
 *  - `{ rows }` — sukces (może być pusty),
 *  - `{ error }` — błąd Postgres / walidacji.
 *
 * Wyodrębnione, żeby orkiestracja `Promise.all` w `execute()` była czytelna
 * i żeby błąd z jednej tabeli nie wywracał całej akcji.
 */
async function queryTable(
  ctx: ToolContext,
  table: 'events' | 'official_events',
  orFilter: string,
): Promise<{ rows: EventRow[] } | { error: string }> {
  const { data, error } = await ctx.supabaseAdmin
    .from(table)
    .select(TABLE_SELECT)
    .or(orFilter)
    .order('date', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    console.error(`[search_events] db error on ${table}:`, error.message)
    return { error: error.message }
  }

  const parsed = EventRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      `[search_events] zod validation failed on ${table}:`,
      parsed.error.issues,
    )
    return { error: `invalid ${table} row shape from database` }
  }

  return { rows: parsed.data }
}

async function execute(
  args: SearchEventsArgs,
  ctx: ToolContext,
): Promise<SearchEventsResult | SearchEventsError | string> {
  const rawQuery = typeof args?.query === 'string' ? args.query.trim() : ''
  if (rawQuery.length < MIN_QUERY_LEN) {
    return {
      ok: false,
      error: `query must be at least ${MIN_QUERY_LEN} characters`,
    }
  }

  const pattern = escapeIlikePattern(rawQuery)
  const orFilter =
    `title.ilike.%${pattern}%,` +
    `description.ilike.%${pattern}%,` +
    `location.ilike.%${pattern}%`

  const [userResult, officialResult] = await Promise.all([
    queryTable(ctx, 'events', orFilter),
    queryTable(ctx, 'official_events', orFilter),
  ])

  // Oba błędy → twardy fail. Jedno źródło OK → degradacja funkcjonalna.
  if ('error' in userResult && 'error' in officialResult) {
    return {
      ok: false,
      error: `events: ${userResult.error}; official_events: ${officialResult.error}`,
    }
  }

  const userRows = 'rows' in userResult ? userResult.rows : []
  const officialRows = 'rows' in officialResult ? officialResult.rows : []

  const merged: ResultItem[] = [
    ...userRows.map((r) => ({
      id: String(r.id),
      title: r.title ?? '',
      description: r.description ?? '',
      location: r.location ?? '',
      date: r.date,
      is_official: false,
    })),
    ...officialRows.map((r) => ({
      id: String(r.id),
      title: r.title ?? '',
      description: r.description ?? '',
      location: r.location ?? '',
      date: r.date,
      is_official: true,
    })),
  ]

  if (merged.length === 0) {
    return EMPTY_RESULT_MESSAGE
  }

  // Sort malejąco po dacie (null-y na koniec), tnijemy do MAX_ROWS.
  merged.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : -Infinity
    const db = b.date ? new Date(b.date).getTime() : -Infinity
    return db - da
  })

  const items = merged.slice(0, MAX_ROWS)

  return { ok: true, count: items.length, items }
}

registerTool<SearchEventsArgs, SearchEventsResult | SearchEventsError | string>({
  tool: {
    name: 'search_events',
    description:
      'Wyszukuje wydarzenia uniwersyteckie (oficjalne UJ + studenckie) po ' +
      'fragmencie tekstu w tytule, opisie lub lokalizacji. Używaj, gdy ' +
      'użytkownik pyta o konkretne wydarzenie, koło naukowe, koncert, ' +
      'konferencję lub aktywność (np. „kiedy juwenalia", „spotkania ELSA").',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Fragment tekstu do wyszukania (min. 2 znaki). Przykład: ' +
            '„juwenalia", „ELSA", „Auditorium Maximum".',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  execute,
})
