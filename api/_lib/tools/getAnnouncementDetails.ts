/**
 * Tool: `get_announcement_details`
 *
 * Semantic search nad full-body ogloszen. Uzywany gdy user pyta o KONKRET,
 * a nie o liste najnowszych:
 *   - "co bylo w mailu o ankiecie?"
 *   - "jaki jest termin rozliczen z BWA?"
 *   - "ten komunikat od dr X o wykladzie z piatku"
 *   - "co dokladnie napisali o stypendium socjalnym"
 *
 * Wewnetrznie woluje RPC `public.search_announcements(query, max_rows)` -
 * Full-Text Search + trigram nad `body || full_body` z recency boost.
 * Detale w migracji `20260720110000_announcements_search.sql`.
 *
 * Format wyjsciowy: top 3 wyniki z fragmentem (`body_excerpt` ~200ch
 * kontekstu wokol pierwszego matcha w `full_body`). Synthesizer formatuje
 * pod konkretne pytanie usera.
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_RESULTS = 3
const EXCERPT_LENGTH = 200
const EMPTY_RESULT_MESSAGE =
  'Nie znalazłem w bazie ogłoszeń pasujących do tego zapytania.'

const ArgsSchema = z.object({
  query: z
    .string()
    .min(2, 'query za krotkie (>=2 znaki)')
    .max(200, 'query za dlugie (<=200 znakow)'),
})

const RowSchema = z.object({
  id: z.string(),
  lecturer_name: z.string(),
  body: z.string(),
  full_body: z.string().nullable(),
  status: z.string(),
  department: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
  score: z.number(),
})

type Row = z.infer<typeof RowSchema>

export type GetAnnouncementDetailsResult = {
  ok: true
  query: string
  count: number
  items: Array<{
    id: string
    lecturer_name: string
    body: string
    body_excerpt: string
    status: string
    department: string | null
    source: string | null
    created_at: string
    has_full_body: boolean
    relevance: number
  }>
}

export type GetAnnouncementDetailsError = {
  ok: false
  error: string
}

/**
 * Wycina fragment ~200 znakow ze srodka full_body wokol pierwszego matcha
 * keyword z query. Gdy brak matcha (np. score z FTS na innym slowie) -
 * wycina poczatek full_body. Gdy brak full_body - zwraca body.
 *
 * Wynik: ".../tekst przed/ <MATCH> /tekst po/...". Dodatkowy "/" - hint
 * dla syntezatora gdzie kontekst jest skrocony.
 */
function buildExcerpt(row: Row, query: string): string {
  const fullText = row.full_body && row.full_body.length > row.body.length
    ? row.full_body
    : row.body
  if (fullText.length <= EXCERPT_LENGTH) return fullText

  // Znajdz pierwsze keyword z query w fullText (case-insensitive).
  // Bierzemy najdluzsze slowo z query (>3ch), zeby skipnac "i", "na", "w".
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort((a, b) => b.length - a.length)

  let matchIdx = -1
  const lowerText = fullText.toLowerCase()
  for (const word of words) {
    matchIdx = lowerText.indexOf(word)
    if (matchIdx !== -1) break
  }

  if (matchIdx === -1) {
    // Brak match w substring - bierzemy poczatek full_body.
    return fullText.slice(0, EXCERPT_LENGTH).trim() + '…'
  }

  // Wycinamy ~100ch przed i ~100ch po matchu, trim do granic slow.
  const halfLen = Math.floor(EXCERPT_LENGTH / 2)
  const startRaw = Math.max(0, matchIdx - halfLen)
  const endRaw = Math.min(fullText.length, matchIdx + halfLen)

  // Granica slowa: szukamy najblizszego whitespace na lewo od start
  // i na prawo od end, zeby nie urywac w polowie slowa.
  let start = startRaw
  if (start > 0) {
    const ws = fullText.lastIndexOf(' ', startRaw)
    if (ws > startRaw - 20) start = ws + 1
  }
  let end = endRaw
  if (end < fullText.length) {
    const ws = fullText.indexOf(' ', endRaw)
    if (ws !== -1 && ws < endRaw + 20) end = ws
  }

  const prefix = start > 0 ? '…' : ''
  const suffix = end < fullText.length ? '…' : ''
  return `${prefix}${fullText.slice(start, end).trim()}${suffix}`
}

async function execute(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<GetAnnouncementDetailsResult | GetAnnouncementDetailsError | string> {
  const parsed = ArgsSchema.safeParse(args)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => i.message)
        .join('; '),
    }
  }
  const { query } = parsed.data

  const { data, error } = await ctx.supabaseAdmin.rpc('search_announcements', {
    search_query: query,
    max_rows: MAX_RESULTS,
  })

  if (error) {
    console.error('[get_announcement_details] RPC error:', error.message)
    return { ok: false, error: error.message }
  }

  const rowsParsed = z.array(RowSchema).safeParse(data ?? [])
  if (!rowsParsed.success) {
    console.error(
      '[get_announcement_details] zod failed:',
      rowsParsed.error.issues,
    )
    return { ok: false, error: 'invalid RPC row shape' }
  }

  const rows = rowsParsed.data
  if (rows.length === 0) {
    return EMPTY_RESULT_MESSAGE
  }

  const items = rows.map((r) => ({
    id: r.id,
    lecturer_name: r.lecturer_name,
    body: r.body,
    body_excerpt: buildExcerpt(r, query),
    status: r.status,
    department: r.department,
    source: r.source,
    created_at: r.created_at,
    has_full_body: r.full_body !== null && r.full_body.length > r.body.length,
    relevance: Math.round(r.score * 100) / 100,
  }))

  return { ok: true, query, count: items.length, items }
}

registerTool<
  { query: string },
  GetAnnouncementDetailsResult | GetAnnouncementDetailsError | string
>({
  tool: {
    name: 'get_announcement_details',
    description:
      'Semantic search nad pełną treścią ogłoszeń. Używaj gdy user pyta o KONKRET ("co było w mailu o X", "termin rozliczeń z Y", "szczegóły komunikatu o Z"), nie o listę najnowszych. Zwraca top 3 ogłoszenia z fragmentem treści wokół matcha. Argument `query` to zwięzłe zapytanie (np. "ankieta", "BWA termin", "stypendium socjalne").',
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          minLength: 2,
          maxLength: 200,
          description:
            'Zwięzłe zapytanie wyszukiwania (np. "ankieta", "rozliczenia BWA", "stypendium socjalne"). Im konkretniej tym lepsze wyniki.',
        },
      },
      additionalProperties: false,
    },
  },
  execute,
})
