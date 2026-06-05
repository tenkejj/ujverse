/**
 * Tool: `search_events`
 *
 * Wyszukuje wydarzenia w `public.events` po fragmencie tekstu (`title`,
 * `description`, `location`). Wzorzec `or(...ilike...)` jest 1:1 z
 * `EventsAdapter.searchDb` po stronie klienta — celowo, żeby semantyka
 * wyszukiwania widziana przez asystenta pokrywała się z wyszukiwarką w UI.
 *
 * Zwracane pola są zwężone (`id, title, description, location, date,
 * is_official`) — model nie potrzebuje `attendee_avatars` ani
 * `external_id` do udzielenia odpowiedzi. Kolumna `faculty` nie istnieje
 * w obecnym schemacie `public.events`, więc nie jest selectowana (zapytanie
 * z nią rzucałoby PostgREST 42703 i wywracało całe wyszukiwanie).
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
 * Zod schema dla wiersza `events` zwracanego przez Supabase. Pełni rolę
 * runtime "return type check" — jeśli schemat tabeli się rozjedzie albo
 * Postgres zwróci nieoczekiwane typy (np. `date` jako liczba), `safeParse`
 * to wyłapie i nie pozwoli wpuścić śmieci do wyniku narzędzia.
 */
const EventRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string().nullable(),
  is_official: z.boolean().nullable(),
})

const EventRowsSchema = z.array(EventRowSchema)

type EventRow = z.infer<typeof EventRowSchema>

export type SearchEventsArgs = {
  query: string
}

export type SearchEventsResult = {
  ok: true
  count: number
  items: Array<{
    id: string
    title: string
    description: string
    location: string
    date: string | null
    is_official: boolean
  }>
}

export type SearchEventsError = {
  ok: false
  error: string
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

  const { data, error } = await ctx.supabaseAdmin
    .from('events')
    .select('id, title, description, location, date, is_official')
    .or(orFilter)
    .order('date', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    console.error('[search_events] db error:', error.message)
    return { ok: false, error: error.message }
  }

  const parsed = EventRowsSchema.safeParse(data ?? [])
  if (!parsed.success) {
    console.error(
      '[search_events] zod validation failed:',
      parsed.error.issues,
    )
    return { ok: false, error: 'invalid events row shape from database' }
  }

  const rows: EventRow[] = parsed.data
  if (rows.length === 0) {
    return EMPTY_RESULT_MESSAGE
  }

  const items = rows.map((r) => ({
    id: String(r.id),
    title: r.title ?? '',
    description: r.description ?? '',
    location: r.location ?? '',
    date: r.date,
    is_official: Boolean(r.is_official),
  }))

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
