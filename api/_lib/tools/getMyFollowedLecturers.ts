/**
 * Tool: `get_my_followed_lecturers`
 *
 * Lista wykładowców, których użytkownik subskrybuje (`lecturer_subscriptions`)
 * + dla każdego liczba świeżych komunikatów z `announcements` matchowana po
 * `lecturer_key` (znormalizowany — patrz migracja 20260615100000).
 *
 * Strategia:
 *   1. SELECT z `lecturer_subscriptions WHERE user_id = ctx.userId`.
 *   2. Dla każdego subskrybowanego wykładowcy: COUNT z `announcements` po
 *      `lecturer_name_key(lecturer_name) = sub.lecturer_key` (LATERAL jest
 *      za drogie w PostgREST, robimy app-side w 2 round-tripach).
 *
 * Auth: WYMAGANE — anon dostaje friendly error.
 *
 * Cache TTL: 60s — listy subskrypcji zmieniają się rzadko, ale liczba
 * announcements szybko (1 min jest OK dla "świeżości pliku").
 */

import { z } from 'zod'
import { registerTool, type ToolContext } from './registry.js'

const MAX_LECTURERS = 12
const NOT_LOGGED_IN_ERROR =
  'Aby zobaczyć subskrybowanych wykładowców musisz być zalogowany w UJverse.'

const SubRowSchema = z.object({
  display_name: z.string(),
  lecturer_key: z.string(),
  created_at: z.string(),
})
const SubRowsSchema = z.array(SubRowSchema)

const AnnouncementSummaryRowSchema = z.object({
  id: z.string(),
  lecturer_name: z.string(),
  status: z.string(),
  created_at: z.string(),
})
const AnnouncementSummaryRowsSchema = z.array(AnnouncementSummaryRowSchema)

export type GetMyFollowedLecturersArgs = Record<string, never>

type ResultItem = {
  display_name: string
  lecturer_key: string
  created_at: string
  recent_announcement_count: number
  latest_announcement_at: string | null
  latest_status: string | null
}

export type GetMyFollowedLecturersResult =
  | { ok: true; count: number; items: ResultItem[] }
  | { ok: false; error: string }
  | string

async function execute(
  _args: GetMyFollowedLecturersArgs,
  ctx: ToolContext,
): Promise<GetMyFollowedLecturersResult> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_ERROR
  }

  // Krok 1: lista subskrypcji
  const subsRes = await ctx.supabaseAdmin
    .from('lecturer_subscriptions')
    .select('display_name, lecturer_key, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(MAX_LECTURERS)

  if (subsRes.error) {
    console.error(
      '[get_my_followed_lecturers] subs error:',
      subsRes.error.message,
    )
    return { ok: false, error: subsRes.error.message }
  }

  const subs = SubRowsSchema.safeParse(subsRes.data ?? [])
  if (!subs.success) {
    console.error(
      '[get_my_followed_lecturers] zod parse failed:',
      subs.error.issues,
    )
    return { ok: false, error: 'invalid subscription row shape' }
  }

  if (subs.data.length === 0) {
    return 'Jeszcze nikogo nie subskrybujesz. Wpadnij w „Mój Plan" i dodaj swoich wykładowców.'
  }

  // Krok 2: announcements per klucz (single RPC by all keys)
  const keys = subs.data.map((s) => s.lecturer_key)
  const annsRes = await ctx.supabaseAdmin.rpc(
    'announcements_for_lecturer_keys',
    {
      p_keys: keys,
      p_limit: 80, // dużo, żeby w JS-ie zsumować per klucz
    },
  )

  if (annsRes.error) {
    console.error(
      '[get_my_followed_lecturers] anns error:',
      annsRes.error.message,
    )
    // Wciąż zwracamy listę subskrypcji bez liczników — częściowy sukces lepszy
    // niż twardy fail.
    const items: ResultItem[] = subs.data.map((s) => ({
      display_name: s.display_name,
      lecturer_key: s.lecturer_key,
      created_at: s.created_at,
      recent_announcement_count: 0,
      latest_announcement_at: null,
      latest_status: null,
    }))
    return { ok: true, count: items.length, items }
  }

  const anns = AnnouncementSummaryRowsSchema.safeParse(annsRes.data ?? [])
  if (!anns.success) {
    console.error(
      '[get_my_followed_lecturers] zod parse anns failed:',
      anns.error.issues,
    )
    return { ok: false, error: 'invalid announcement row shape' }
  }

  // Indeksowanie JS-side: lecturer_name_key NIE jest w wyniku, ale dla
  // matchowania używamy kombinacji "lower-bez-diakrytyk" — wystarczy proste
  // grupowanie po `lecturer_name` i mapowanie do klucza po naszej stronie.
  // UWAGA: `announcements_for_lecturer_keys` filtruje już po naszych keys,
  // więc każdy zwrócony rekord pasuje do JEDNEGO z `keys`. Aby zmapować do
  // konkretnego subscription, normalizujemy po stronie JS-ie.
  const normalize = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[ąàáâăäåæçčćèéêëęěğìíîïłñńňòóôõöőøœšśťțùúûüűůýÿžźż]/g, (c) => {
        const map: Record<string, string> = {
          ą: 'a', à: 'a', á: 'a', â: 'a', ă: 'a', ä: 'a', å: 'a', æ: 'a',
          ç: 'c', č: 'c', ć: 'c',
          è: 'e', é: 'e', ê: 'e', ë: 'e', ę: 'e', ě: 'e',
          ğ: 'g',
          ì: 'i', í: 'i', î: 'i', ï: 'i',
          ł: 'l',
          ñ: 'n', ń: 'n', ň: 'n',
          ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ő: 'o', ø: 'o', œ: 'o',
          š: 's', ś: 's',
          ť: 't', ț: 't',
          ù: 'u', ú: 'u', û: 'u', ü: 'u', ű: 'u', ů: 'u',
          ý: 'y', ÿ: 'y',
          ž: 'z', ź: 'z', ż: 'z',
        }
        return map[c] ?? c
      })
      .replace(/\b(dr|prof|mgr|hab|inż|inz|hab\.|prof\.|dr\.|mgr\.|inż\.)\b/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim()

  const byKey = new Map<string, { count: number; latestAt: string | null; latestStatus: string | null }>()
  for (const a of anns.data) {
    const k = normalize(a.lecturer_name)
    const cur = byKey.get(k) ?? { count: 0, latestAt: null, latestStatus: null }
    cur.count += 1
    if (cur.latestAt === null || a.created_at > cur.latestAt) {
      cur.latestAt = a.created_at
      cur.latestStatus = a.status
    }
    byKey.set(k, cur)
  }

  const items: ResultItem[] = subs.data.map((s) => {
    const stats = byKey.get(s.lecturer_key) ?? null
    return {
      display_name: s.display_name,
      lecturer_key: s.lecturer_key,
      created_at: s.created_at,
      recent_announcement_count: stats?.count ?? 0,
      latest_announcement_at: stats?.latestAt ?? null,
      latest_status: stats?.latestStatus ?? null,
    }
  })

  return { ok: true, count: items.length, items }
}

registerTool<GetMyFollowedLecturersArgs, GetMyFollowedLecturersResult>({
  tool: {
    name: 'get_my_followed_lecturers',
    description:
      'Lista subskrybowanych wykładowców usera + liczba świeżych komunikatów. Dla „kogo subskrybuję", „moi wykładowcy". Auth wymagany.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
