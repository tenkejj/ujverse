/**
 * Tool: `find_user`
 *
 * Wyszukaj użytkownika UJverse po fragmencie imienia, nazwiska lub username.
 * Zwraca top 5 trafień jako markdown links do profilu (deep-link `/u/<username>`).
 *
 * Implementacja: jeden SELECT na `profiles` z `or(ilike, ilike, ilike)`. Filtry:
 *   - `is_searchable IS NOT FALSE` — respektujemy user opt-out (settings)
 *   - `is_banned IS NOT TRUE` — wycinamy zbanowanych
 *   - dla każdego query: `full_name ilike %q%`, `username ilike %q%`,
 *     `study_program ilike %q%` (np. ktoś szuka "informatyka" → osoby z kierunku)
 *
 * Ranking: PostgREST nie wspiera RANK po prostym ilike, więc:
 *   1. SELECT 30 rekordów
 *   2. JS-side score: exact username > username-prefix > full_name-prefix >
 *      full_name-substring > program-substring
 *   3. Zwróć top 5
 *
 * Auth: opcjonalny — anon też może szukać (RLS `profiles_select_all` dla
 * `authenticated`, ale supabaseAdmin bypassuje RLS — więc właściwie public
 * search). Świadomie permissive: lookup po nazwisku to publicna feature
 * (jak Facebook search), tylko respektujemy `is_searchable=false` opt-out.
 *
 * Tool zwraca STRING (markdown) → 1:1 do usera.
 *
 * Cache TTL: 60s (profile się rzadko zmieniają; nazwy własne są stabilne).
 */

import { registerTool, type ToolContext } from './registry.js'

const MAX_RESULTS = 5
const SCAN_LIMIT = 30
const MIN_QUERY_LENGTH = 2

type ProfileSearchRow = {
  id: string
  full_name: string | null
  username: string | null
  study_program: string | null
  department: string | null
  year_started: number | null
  is_banned: boolean | null
  is_searchable: boolean | null
}

type FindUserArgs = {
  query: string
}

/**
 * Helper sanityzacji query do PostgREST `or(... ilike ...)`. Wycina znaki
 * które mogłyby rozbić syntaks (przecinek = separator w `or()`, nawiasy =
 * grupowanie). Trim do MAX 64 znaków.
 */
function sanitizeForOrIlike(raw: string): string {
  return raw
    .replace(/[,()*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)
}

/**
 * JS-side score per row dla danego query. Niżej = lepiej.
 * Świadomie nie używamy similarity (Postgres pg_trgm) — chcemy 0 nowych
 * extensions, a 30 rekordów × 5 reguł = nic.
 */
function scoreRow(row: ProfileSearchRow, q: string): number {
  const qLower = q.toLowerCase()
  const username = (row.username ?? '').toLowerCase()
  const fullName = (row.full_name ?? '').toLowerCase()
  const program = (row.study_program ?? '').toLowerCase()

  if (username && username === qLower) return 0
  if (username && username.startsWith(qLower)) return 10
  if (fullName && fullName.startsWith(qLower)) return 20
  if (username && username.includes(qLower)) return 30
  if (fullName && fullName.includes(qLower)) return 40
  if (program && program.includes(qLower)) return 50
  return 100
}

function renderRow(row: ProfileSearchRow): string {
  const username = row.username ? `@${row.username}` : null
  const name = row.full_name?.trim() || username || 'Bez nazwy'
  const link = row.username ? `[${name}](/u/${row.username})` : `**${name}**`

  const meta: string[] = []
  if (row.study_program) meta.push(row.study_program)
  if (row.year_started) meta.push(`rocznik ${row.year_started}`)
  if (row.department) meta.push(row.department)

  const metaStr = meta.length > 0 ? ` — ${meta.join(', ')}` : ''
  return `- ${link}${metaStr}`
}

async function execute(
  args: FindUserArgs,
  ctx: ToolContext,
): Promise<string> {
  const queryRaw = typeof args?.query === 'string' ? args.query : ''
  const query = sanitizeForOrIlike(queryRaw)
  if (query.length < MIN_QUERY_LENGTH) {
    return `Podaj co najmniej ${MIN_QUERY_LENGTH} znaki do wyszukiwania (otrzymałem: "${queryRaw}").`
  }

  // PostgREST `or` syntax: `or=(full_name.ilike.*foo*,username.ilike.*foo*,...)`.
  // Patrn `*` jest aliasem dla `%` w PostgREST. Spacje w query odbierane jako
  // literal — chcemy substring matching, więc trzymamy spację (np. "Jan Kowalski").
  const pattern = `*${query}*`
  const orFilter = [
    `full_name.ilike.${pattern}`,
    `username.ilike.${pattern}`,
    `study_program.ilike.${pattern}`,
  ].join(',')

  const { data, error } = await ctx.supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, study_program, department, year_started, is_banned, is_searchable')
    .or(orFilter)
    .limit(SCAN_LIMIT)

  if (error) {
    console.error('[find_user] db error:', error.message)
    return `Nie udało mi się wyszukać użytkowników (${error.message}).`
  }
  if (!Array.isArray(data) || data.length === 0) {
    return `Nie znalazłem nikogo dla zapytania "${queryRaw}". Spróbuj inaczej — np. samego nazwiska albo username (np. @franek).`
  }

  const rows = (data as ProfileSearchRow[]).filter(
    (r) =>
      r.is_banned !== true &&
      r.is_searchable !== false &&
      // Filtr na siebie samego — user pytający „o siebie" powinien dostać
      // `get_my_user_context`, nie znaleźć siebie tu.
      r.id !== ctx.userId,
  )
  if (rows.length === 0) {
    return `Nie znalazłem nikogo dla zapytania "${queryRaw}" (po odfiltrowaniu kont prywatnych / zablokowanych).`
  }

  rows.sort((a, b) => scoreRow(a, query) - scoreRow(b, query))
  const top = rows.slice(0, MAX_RESULTS)

  const header =
    rows.length > MAX_RESULTS
      ? `Pierwszych ${MAX_RESULTS} z ${rows.length} trafień dla "${queryRaw}":`
      : `${rows.length} ${rows.length === 1 ? 'trafienie' : 'trafień'} dla "${queryRaw}":`

  return [header, '', ...top.map(renderRow)].join('\n')
}

registerTool<FindUserArgs, string>({
  tool: {
    name: 'find_user',
    description:
      'Wyszukaj użytkownika UJverse po imieniu, nazwisku lub username. ' +
      'Zwraca top 5 trafień z linkami do profili (deep-link /u/username). ' +
      'Używaj, gdy user pyta "znajdź mi <imię>", "kto to jest <imię>", ' +
      '"szukam X z mojego roku", "pokaż profil X". NIE używaj, gdy user ' +
      'pyta sam o siebie ("kim ja jestem") — do tego jest get_my_user_context.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Fragment imienia, nazwiska, username lub nazwy kierunku ' +
            '(np. "Kowalski", "franek", "informatyka"). Min 2 znaki.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  execute,
})
