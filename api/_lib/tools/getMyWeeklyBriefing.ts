/**
 * Tool: `get_my_weekly_briefing`
 *
 * Personalny briefing user'a na BIEŻĄCY tydzień (poniedziałek-niedziela
 * w strefie Europe/Warsaw). Zwraca string markdown — formatter w
 * `api/chat.ts` go nie obrabia, tylko przepuszcza.
 *
 * Strategia (idempotentna, bez zapisu):
 *   1. Sprawdź czy istnieje wpis w `weekly_briefings` dla
 *      `(user_id, warsaw_week_start())` — to gotowy materiał z cron-a /
 *      lazy-init przez front (`ensure_weekly_briefing`).
 *   2. Jeśli BRAK — wywołaj `compute_weekly_briefing(user_id, week_start)`
 *      która zwraca świeży JSONB (bez insertu). Renderujemy do markdown.
 *
 * Schemat payload-u opisany w 20260622100000_weekly_briefings.sql:17-26:
 *   { week_start, week_end, classes, changes, announcements_from_subscribed,
 *     official_events, next_exam }
 *
 * Auth: WYMAGANE.
 *
 * Cache TTL: 300s — briefing per tydzień zmienia się rzadko.
 */

import { registerTool, type ToolContext } from './registry.js'

const NOT_LOGGED_IN_MESSAGE =
  'Aby zobaczyć Twój tygodniowy briefing musisz być zalogowany w UJverse.'

type ClassesPayload = {
  total?: number
  hours?: number
  days_with_classes?: number
  cancelled?: number
  first?: string | null
  last?: string | null
}

type ChangePayload = {
  kind?: string
  title?: string
  starts_at?: string
  location?: string | null
  source_id?: string | null
}

type AnnPayload = {
  id?: string
  lecturer_name?: string | null
  body?: string
  status?: string
  created_at?: string
}

type OfficialEventPayload = {
  id?: string
  title?: string
  starts_at?: string
  ends_at?: string | null
  location?: string | null
}

type NextExamPayload = {
  title?: string
  starts_at?: string
  days_away?: number
} | null

type BriefingPayload = {
  week_start?: string
  week_end?: string
  classes?: ClassesPayload
  changes?: ChangePayload[]
  announcements_from_subscribed?: AnnPayload[]
  official_events?: OfficialEventPayload[]
  next_exam?: NextExamPayload
}

const KIND_PL: Record<string, string> = {
  lecturer_absence: 'nieobecność',
  class_cancelled: 'odwołane zajęcia',
  class_remote: 'zdalnie',
  class_rescheduled: 'przeniesione',
  duty_change: 'zmiana dyżuru',
  free_day: 'dzień wolny',
  official_event: 'wydarzenie UJ',
  community_event: 'wydarzenie',
  deadline: 'deadline',
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const HH = String(d.getUTCHours()).padStart(2, '0')
  const MM = String(d.getUTCMinutes()).padStart(2, '0')
  if (HH === '00' && MM === '00') return `${yyyy}-${mm}-${dd}`
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`
}

/**
 * Renderuje briefing JSONB do konwersacyjnego markdown — bez bullet list,
 * krótkimi paragrafami. Każda sekcja to 1-2 zdania, sklejone newlinem
 * (a nie nagłówkami). UI renderuje `\n` jako line break, więc zdania
 * pojawiają się w osobnych linijkach, ale czytane są jak rozmowa.
 */
function renderBriefing(payload: BriefingPayload): string {
  const paragraphs: string[] = []

  // Sekcja: zajęcia.
  const classes = payload.classes ?? {}
  if (typeof classes.total === 'number' && classes.total > 0) {
    const parts: string[] = [
      `${classes.total} ${classes.total === 1 ? 'zajęcie' : 'zajęć'}`,
    ]
    if (typeof classes.hours === 'number' && classes.hours > 0) {
      parts.push(`${classes.hours}h`)
    }
    if (typeof classes.days_with_classes === 'number') {
      parts.push(
        `przez ${classes.days_with_classes} ${classes.days_with_classes === 1 ? 'dzień' : 'dni'}`,
      )
    }
    let line = `W tym tygodniu masz ${parts.join(', ')}.`
    if (typeof classes.cancelled === 'number' && classes.cancelled > 0) {
      line += ` Z czego ${classes.cancelled} odwołane.`
    }
    paragraphs.push(line)
  } else if (
    typeof classes.total === 'number' &&
    classes.total === 0
  ) {
    paragraphs.push('Wolny tydzień — żadnych zajęć w planie.')
  }

  // Sekcja: zmiany.
  const changes = Array.isArray(payload.changes) ? payload.changes : []
  if (changes.length > 0) {
    const top = changes.slice(0, 3)
    const items = top.map((c) => {
      const kind = KIND_PL[c.kind ?? ''] ?? 'zmiana'
      const title = c.title ?? 'wpis'
      const when = shortDate(c.starts_at)
      return `**${title}** [${kind}] ${when}`
    })
    const more =
      changes.length > top.length
        ? ` plus jeszcze ${changes.length - top.length} dalej.`
        : '.'
    paragraphs.push(`Zmiany w planie: ${items.join('; ')}${more}`)
  }

  // Sekcja: ogłoszenia od subskrybowanych.
  const anns = Array.isArray(payload.announcements_from_subscribed)
    ? payload.announcements_from_subscribed
    : []
  if (anns.length > 0) {
    const top = anns.slice(0, 3)
    const items = top.map((a) => {
      const lec = a.lecturer_name ?? 'wykładowca'
      const statusPart =
        a.status === 'cancelled'
          ? ' (odwołał)'
          : a.status === 'remote'
            ? ' (zdalnie)'
            : a.status === 'duty'
              ? ' (dyżur)'
              : ''
      return `**${lec}**${statusPart}`
    })
    const more =
      anns.length > top.length
        ? ` plus jeszcze ${anns.length - top.length}.`
        : '.'
    paragraphs.push(`Twoi wykładowcy coś napisali: ${items.join(', ')}${more}`)
  }

  // Sekcja: oficjalne wydarzenia.
  const events = Array.isArray(payload.official_events)
    ? payload.official_events
    : []
  if (events.length > 0) {
    const top = events.slice(0, 3)
    const items = top.map((e) => {
      const title = e.title ?? 'wydarzenie'
      const when = shortDate(e.starts_at)
      return `**${title}** ${when}`
    })
    paragraphs.push(`Z UJ-owych: ${items.join('; ')}.`)
  }

  // Sekcja: nadchodzący egzamin.
  const exam = payload.next_exam
  if (exam && exam.title && exam.starts_at) {
    const days = typeof exam.days_away === 'number' ? exam.days_away : null
    const dayPart =
      days != null
        ? days === 0
          ? 'dziś'
          : days === 1
            ? 'jutro'
            : `za ${days} dni`
        : shortDate(exam.starts_at)
    paragraphs.push(`Najbliższy egzamin: **${exam.title}** — ${dayPart}.`)
  }

  if (paragraphs.length === 0) {
    return 'Spokojny tydzień — nic istotnego nie wymaga Twojej uwagi.'
  }

  return paragraphs.join('\n')
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  // 1. Spróbuj pobrać warsaw_week_start (zwraca DATE jako string YYYY-MM-DD).
  const { data: weekData, error: weekErr } = await ctx.supabaseAdmin.rpc(
    'warsaw_week_start',
  )
  if (weekErr) {
    console.error('[get_my_weekly_briefing] warsaw_week_start error:', weekErr.message)
    return 'Nie udało mi się ustalić bieżącego tygodnia.'
  }
  const weekStart =
    typeof weekData === 'string' ? weekData : new Date().toISOString().slice(0, 10)

  // 2. Sprawdź czy briefing już jest w bazie (cron lub lazy front).
  const { data: existing, error: existingErr } = await ctx.supabaseAdmin
    .from('weekly_briefings')
    .select('payload, week_start')
    .eq('user_id', ctx.userId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existingErr) {
    console.warn(
      '[get_my_weekly_briefing] existing lookup failed:',
      existingErr.message,
    )
  }

  if (existing && existing.payload) {
    return renderBriefing(existing.payload as BriefingPayload)
  }

  // 3. Brak — policz na żywo (RPC compute zwraca JSONB bez insertu).
  const { data: computed, error: computedErr } = await ctx.supabaseAdmin.rpc(
    'compute_weekly_briefing',
    { p_user_id: ctx.userId, p_week_start: weekStart },
  )
  if (computedErr) {
    console.error(
      '[get_my_weekly_briefing] compute error:',
      computedErr.message,
    )
    return 'Brak briefingu na ten tydzień. Wejdź na zakładkę „Briefing" — system go wygeneruje.'
  }
  if (!computed) {
    return 'Brak danych do briefingu na ten tydzień.'
  }
  return renderBriefing(computed as BriefingPayload)
}

registerTool<Record<string, never>, string>({
  tool: {
    name: 'get_my_weekly_briefing',
    description:
      'Personalny briefing usera na bieżący tydzień (zajęcia, zmiany, wykładowcy, wydarzenia, egzamin). Dla „co mam w tym tygodniu", „briefing". Auth wymagany.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
