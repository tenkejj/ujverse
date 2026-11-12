/**
 * Tool: `find_user`
 *
 * Wyszukaj użytkownika UJverse po fragmencie imienia, nazwiska lub username.
 * Zwraca top 5 trafień jako markdown links do profilu (deep-link `/u/<username>`).
 *
 * Wyszukiwanie wymaga zalogowania zweryfikowanego przez rejestr narzędzi.
 * Filtry widoczności i moderacji działają przed limitem zapytania oraz przy
 * mapowaniu odpowiedzi. Ukryty wydział nie trafia do tekstu przekazanego modelowi.
 * Klient administracyjny pozostaje wyłącznie po stronie serwera.
 */

import { registerTool, type ToolContext } from './registry.js'
import { toIlikePattern } from '../../../src/lib/info/search.js'

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
  show_department: boolean | null
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
    .replace(/[,()"'*\\]/g, ' ')
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
  if (row.show_department === true && row.department) meta.push(row.department)

  const metaStr = meta.length > 0 ? ` — ${meta.join(', ')}` : ''
  return `${link}${metaStr}`
}

export async function executeFindUserSearch(
  args: FindUserArgs,
  ctx: ToolContext,
): Promise<string> {
  if (!ctx.userId) return 'Wyszukiwanie osób wymaga zalogowania.'
  const queryRaw = typeof args?.query === 'string' ? args.query : ''
  const query = sanitizeForOrIlike(queryRaw)
  const pattern = toIlikePattern(query)
  if (query.length < MIN_QUERY_LENGTH || !pattern) {
    return `Podaj co najmniej ${MIN_QUERY_LENGTH} znaki do wyszukiwania (otrzymałem: "${query}").`
  }

  const orFilter = [
    `full_name.ilike.${pattern}`,
    `username.ilike.${pattern}`,
    `study_program.ilike.${pattern}`,
  ].join(',')

  const { data, error } = await ctx.supabaseAdmin
    .from('profiles')
    .select('id, full_name, username, study_program, department, year_started, is_banned, is_searchable, show_department')
    .eq('is_searchable', true)
    .not('is_banned', 'is', true)
    .or(orFilter)
    .limit(SCAN_LIMIT)

  if (error) {
    console.error('[find_user] db error:', error.message)
    return 'Nie udało się przeszukać profili. Spróbuj ponownie za chwilę.'
  }
  if (!Array.isArray(data) || data.length === 0) {
    return `Nikogo dla „${query}" nie znalazłem. Spróbuj samego nazwiska albo username (np. @franek).`
  }

  const rows = (data as ProfileSearchRow[]).filter(
    (r) =>
      r.is_banned !== true &&
      r.is_searchable === true &&
      r.id !== ctx.userId,
  )
  if (rows.length === 0) {
    return `Nikogo dla „${query}" — pewnie konta prywatne. Spróbuj inaczej.`
  }

  rows.sort((a, b) => scoreRow(a, query) - scoreRow(b, query))
  const top = rows.slice(0, MAX_RESULTS)

  const header =
    top.length === 1
      ? `Mam jednego: `
      : `${top.length} ${top.length === 1 ? 'osobę' : 'osób'} dla „${query}":`

  if (top.length === 1) {
    return `${header}${renderRow(top[0])}.`
  }
  const moreNote =
    rows.length > top.length ? `\n\nJest jeszcze ${rows.length - top.length}.` : ''
  return `${header}\n${top.map(renderRow).join('\n')}${moreNote}`
}

registerTool<FindUserArgs, string>({
  tool: {
    name: 'find_user',
    description:
      'Szuka usera po imieniu/nazwisku/username (top 5 z linkami). Dla „znajdź X". NIE używaj dla „kim ja jestem".',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Min. 2 znaki.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  execute: executeFindUserSearch,
  // Re-evaluate visibility and bans whenever this tool executes.
  ttlMs: 0,
})
