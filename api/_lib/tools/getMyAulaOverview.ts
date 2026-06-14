/**
 * Tool: `get_my_aula_overview`
 *
 * Personalny dashboard usera w module Aula. Krok po kroku:
 *   1. Znajdź `cohort_id` usera (z `cohort_members`).
 *   2. Pobierz nazwę rocznika z `cohorts`.
 *   3. Policz członków rocznika.
 *   4. Znajdź TOP 5 otwartych zadań (`cohort_channel_tasks.completed_at IS NULL`)
 *      które user JESZCZE NIE oznaczył jako zrobione (`cohort_task_completions`
 *      LEFT JOIN; brak wpisu = nie zrobione). Sortuj rosnąco po `due_at NULLS LAST`.
 *   5. Policz aktywne polle (`cohort_message_polls.closed_at IS NULL`) w których
 *      user JESZCZE NIE głosował.
 *
 * Optymalizacja: każdy krok to osobne PostgREST query (Edge nie ma PL/pgSQL
 * eDSL), ale wszystkie idą równolegle przez `Promise.all` po pierwszym kroku.
 * Worst case ~5 round-tripów na cache MISS — przy TTL 30s (dynamiczne dane)
 * akceptowalne.
 *
 * Auth: WYMAGANE. Anon → komunikat o logowaniu.
 * Tool zwraca STRING (markdown) → `formatToolResultAsFinalAnswer` przepuszcza
 * 1:1 do usera.
 *
 * Cache TTL: 30s (deadliney i polle to dynamic data; chcemy żeby asystent
 * widział nowe zadanie w ~pół minuty, bez per-request hitów do bazy).
 */

import { registerTool, type ToolContext } from './registry.js'

const NOT_LOGGED_IN_MESSAGE =
  'Aby zobaczyć Twój overview Auli musisz być zalogowany w UJverse.'

const NO_COHORT_MESSAGE =
  'Nie należysz jeszcze do żadnego rocznika w Auli. Uzupełnij kierunek i rok studiów w ustawieniach profilu — system przypisze Cię automatycznie do właściwej grupy.'

const MAX_TASKS_PREVIEW = 5

type CohortRow = {
  id: string
  name: string
  study_program: string | null
  year_started: number | null
}

type CohortMemberRow = {
  cohort_id: string
}

type ChannelRow = {
  id: number
  name: string | null
}

type TaskRow = {
  id: number
  title: string
  due_at: string | null
  channel_id: number | null
  priority: string | null
}

type CompletionRow = {
  task_id: number
}

type PollRow = {
  id: number
  question: string
  channel_id: number | null
}

type VoteRow = {
  poll_id: number
}

type PollMessageJoin = {
  id: number
  channel_id: number | null
}

/**
 * Format kanału do mini-pigułki w odpowiedzi. `null` channel_id = sala główna.
 * Mapa `channelNames` wypełniana w jednym kroku z `cohort_channels`.
 */
function formatChannelTag(
  channelId: number | null,
  channelNames: Map<number, string>,
): string {
  if (channelId == null) return 'Sala główna'
  const n = channelNames.get(channelId)
  return n ? `sala "${n}"` : `sala #${channelId}`
}

/**
 * Lokalizowana data due. Format: "dziś 18:00", "jutro 09:00", "20 cze".
 * Trzymamy się PL — model widzi to jako string, nie processuje dalej.
 */
function formatDueLabel(dueAt: string | null): string {
  if (!dueAt) return 'bez terminu'
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return 'bez terminu'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  )

  const time = due.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return `⚠️ ${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'} po terminie`
  }
  if (diffDays === 0) return `dziś ${time}`
  if (diffDays === 1) return `jutro ${time}`
  if (diffDays <= 7) {
    const weekday = due.toLocaleDateString('pl-PL', { weekday: 'long' })
    return `${weekday} ${time}`
  }
  const date = due.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
  })
  return `${date} ${time}`
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  // 1. Cohort membership.
  const { data: memberData, error: memberErr } = await ctx.supabaseAdmin
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', ctx.userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (memberErr) {
    console.error('[get_my_aula_overview] cohort_members err:', memberErr.message)
    return `Nie udało mi się sprawdzić Twojego rocznika (${memberErr.message}).`
  }
  const member = memberData as CohortMemberRow | null
  if (!member) {
    return NO_COHORT_MESSAGE
  }
  const cohortId = member.cohort_id

  // 2-5. Równolegle: cohort details, members count, my channels' meta, open tasks,
  // active polls. Każde query niezależne; `Promise.all` zbija latency.
  const [
    cohortRes,
    membersCountRes,
    channelsRes,
    openTasksRes,
    myCompletionsRes,
    pollsRes,
    myVotesRes,
  ] = await Promise.all([
    ctx.supabaseAdmin
      .from('cohorts')
      .select('id, name, study_program, year_started')
      .eq('id', cohortId)
      .maybeSingle(),
    ctx.supabaseAdmin
      .from('cohort_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('cohort_id', cohortId),
    ctx.supabaseAdmin
      .from('cohort_channels')
      .select('id, name')
      .eq('cohort_id', cohortId)
      .is('archived_at', null),
    ctx.supabaseAdmin
      .from('cohort_channel_tasks')
      .select('id, title, due_at, channel_id, priority')
      .eq('cohort_id', cohortId)
      .is('completed_at', null)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(20),
    ctx.supabaseAdmin
      .from('cohort_task_completions')
      .select('task_id')
      .eq('user_id', ctx.userId)
      .eq('cohort_id', cohortId),
    ctx.supabaseAdmin
      .from('cohort_message_polls')
      .select('id, question, cohort_messages!inner ( id, channel_id )')
      .eq('cohort_id', cohortId)
      .is('closed_at', null)
      .limit(20),
    ctx.supabaseAdmin
      .from('cohort_poll_votes')
      .select('poll_id')
      .eq('user_id', ctx.userId)
      .eq('cohort_id', cohortId),
  ])

  if (cohortRes.error || !cohortRes.data) {
    console.error(
      '[get_my_aula_overview] cohort details err:',
      cohortRes.error?.message,
    )
    return 'Nie udało mi się odczytać danych Twojego rocznika.'
  }
  const cohort = cohortRes.data as CohortRow

  const membersCount = membersCountRes.error ? null : (membersCountRes.count ?? null)

  const channelNames = new Map<number, string>()
  if (!channelsRes.error && Array.isArray(channelsRes.data)) {
    for (const c of channelsRes.data as ChannelRow[]) {
      if (c.id != null && c.name) channelNames.set(c.id, c.name)
    }
  }

  // 4. Otwarte zadania — z `cohort_channel_tasks` (global open) minus zadania
  // które user oznaczył jako "ja zrobiłem" (per-user completion). Filtr w JS:
  // dla ~20 rekordów to taniej niż dodatkowy join przez PostgREST.
  const myCompletedTaskIds = new Set<number>()
  if (!myCompletionsRes.error && Array.isArray(myCompletionsRes.data)) {
    for (const c of myCompletionsRes.data as CompletionRow[]) {
      myCompletedTaskIds.add(c.task_id)
    }
  }
  const openTasksAll = (openTasksRes.error ? [] : (openTasksRes.data as TaskRow[])) ?? []
  const openTasksForMe = openTasksAll
    .filter((t) => !myCompletedTaskIds.has(t.id))
    .slice(0, MAX_TASKS_PREVIEW)

  // 5. Aktywne polle — minus te w których user już głosował.
  const myVotedPollIds = new Set<number>()
  if (!myVotesRes.error && Array.isArray(myVotesRes.data)) {
    for (const v of myVotesRes.data as VoteRow[]) {
      myVotedPollIds.add(v.poll_id)
    }
  }
  type PollRowWithMessage = PollRow & {
    cohort_messages?: PollMessageJoin | PollMessageJoin[] | null
  }
  const pollsRaw = (pollsRes.error ? [] : (pollsRes.data as PollRowWithMessage[])) ?? []
  const openPolls = pollsRaw
    .filter((p) => !myVotedPollIds.has(p.id))
    .map((p) => {
      // PostgREST embedding może zwrócić array lub single object — normalize.
      const msg = Array.isArray(p.cohort_messages)
        ? p.cohort_messages[0] ?? null
        : p.cohort_messages ?? null
      return {
        question: p.question,
        channelId: msg?.channel_id ?? null,
      }
    })

  // ── Renderowanie konwersacyjne (bez nagłówków, w prozie) ────────────────
  const paragraphs: string[] = []

  const cohortLabel =
    cohort.study_program && cohort.year_started
      ? `**${cohort.study_program}** (rocznik ${cohort.year_started})`
      : `**${cohort.name}**`
  const membersPart =
    membersCount != null
      ? `, ${membersCount} ${membersCount === 1 ? 'osoba' : 'osób'}`
      : ''
  paragraphs.push(`Twój rocznik to ${cohortLabel}${membersPart}.`)

  if (openTasksForMe.length === 0) {
    if (openTasksAll.length > 0) {
      paragraphs.push(
        `Wszystkie ${openTasksAll.length} otwartych zadań masz odhaczone — ekstra robota.`,
      )
    } else {
      paragraphs.push('Zadań w tym roczniku aktualnie zero.')
    }
  } else {
    const items = openTasksForMe.map((t) => {
      const due = formatDueLabel(t.due_at)
      const channelTag = formatChannelTag(t.channel_id, channelNames)
      return `**${t.title}** (${due}, ${channelTag})`
    })
    const lead =
      openTasksForMe.length === 1
        ? `Masz jedno otwarte zadanie:`
        : `Masz ${openTasksForMe.length} otwartych zadań:`
    const body =
      openTasksForMe.length <= 2 ? items.join('; ') : items.join('\n')
    paragraphs.push(`${lead}\n${body}`)
  }

  if (openPolls.length > 0) {
    const top = openPolls.slice(0, 4)
    const items = top.map((p) => {
      const channelTag = formatChannelTag(p.channelId, channelNames)
      return `*${p.question}* (${channelTag})`
    })
    const lead =
      top.length === 1
        ? 'Czeka na Twój głos jedna ankieta:'
        : `Czeka na Ciebie ${top.length} ankiet:`
    const body = top.length <= 2 ? items.join('; ') : items.join('\n')
    paragraphs.push(`${lead}\n${body}`)
  }

  return paragraphs.join('\n\n')
}

registerTool<Record<string, never>, string>({
  tool: {
    name: 'get_my_aula_overview',
    description:
      'Dashboard Auli usera: rocznik, 5 najbliższych zadań, aktywne ankiety. Dla „co mam do zrobienia", „deadliney", „głosowania".',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
