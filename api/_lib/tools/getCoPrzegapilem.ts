/**
 * Tool: `get_co_przegapilem`
 *
 * Złożony brief: powiadomienia + plan dziś + skrót Auli + świeże ogłoszenia.
 * Markdown passthrough — zero syntezy Llama.
 */

import {
  fetchUnreadNotifications,
  formatNotificationsMarkdown,
} from '../notificationHelpers.js'
import { todayRangeISO } from '../fastPath.js'
import { registerTool, type ToolContext } from './registry.js'

const NOT_LOGGED_IN_MESSAGE =
  'Aby zobaczyć podsumowanie musisz być zalogowany w UJverse.'

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatClassTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

async function buildPlanSection(ctx: ToolContext): Promise<string | null> {
  const range = todayRangeISO()
  const { data, error } = await ctx.supabaseAdmin
    .from('user_timetable_entries')
    .select('summary, location, start_time, lecturer_name')
    .eq('user_id', ctx.userId!)
    .gte('start_time', range.start)
    .lte('start_time', range.end)
    .order('start_time', { ascending: true })
    .limit(8)

  if (error || !data || data.length === 0) return null

  const lines = (
    data as Array<{
      summary: string
      location: string | null
      start_time: string
      lecturer_name: string | null
    }>
  ).map((e) => {
    const time = formatClassTime(e.start_time)
    const where = e.location ? `, ${e.location}` : ''
    const who = e.lecturer_name ? ` (${e.lecturer_name})` : ''
    return `- **${time}** ${e.summary}${who}${where}`
  })

  return `**Plan na dziś**\n${lines.join('\n')}`
}

async function buildAulaSection(ctx: ToolContext): Promise<string | null> {
  const { data: member } = await ctx.supabaseAdmin
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', ctx.userId!)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!member?.cohort_id) return null

  const cohortId = member.cohort_id as string

  const { data: openTasks } = await ctx.supabaseAdmin
    .from('cohort_channel_tasks')
    .select('id, title, due_at')
    .eq('cohort_id', cohortId)
    .is('completed_at', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(5)

  const tasks = (openTasks ?? []) as Array<{
    id: number
    title: string
    due_at: string | null
  }>

  if (tasks.length === 0) return null

  const { data: completions } = await ctx.supabaseAdmin
    .from('cohort_task_completions')
    .select('task_id')
    .eq('user_id', ctx.userId!)
    .in(
      'task_id',
      tasks.map((t) => t.id),
    )

  const done = new Set(
    ((completions ?? []) as Array<{ task_id: number }>).map((c) => c.task_id),
  )
  const pending = tasks.filter((t) => !done.has(t.id))
  if (pending.length === 0) return null

  const lines = pending.slice(0, 3).map((t) => `- **${t.title}**`)
  return `**Aula** — ${pending.length} otwartych zadań\n${lines.join('\n')}`
}

async function buildAnnouncementsSection(ctx: ToolContext): Promise<string | null> {
  const { data, error } = await ctx.supabaseAdmin
    .from('announcements')
    .select('lecturer_name, body, status, created_at')
    .order('created_at', { ascending: false })
    .limit(2)

  if (error || !data || data.length === 0) return null

  const lines = (
    data as Array<{
      lecturer_name: string
      body: string
      status: string
    }>
  ).map((a) => {
    const status =
      a.status === 'cancelled'
        ? 'odwołane'
        : a.status === 'remote'
          ? 'zdalne'
          : 'dyżur'
    return `- **${a.lecturer_name}** (${status}) — ${clip(a.body, 70)}`
  })

  return `**Ogłoszenia**\n${lines.join('\n')}`
}

async function execute(
  _args: Record<string, never>,
  ctx: ToolContext,
): Promise<string> {
  if (!ctx.userId) {
    return NOT_LOGGED_IN_MESSAGE
  }

  const [notifs, plan, aula, announcements] = await Promise.all([
    fetchUnreadNotifications(ctx.supabaseAdmin, ctx.userId, 5).then((items) =>
      items.length > 0
        ? formatNotificationsMarkdown(items, { heading: '**Powiadomienia**' })
        : null,
    ),
    buildPlanSection(ctx),
    buildAulaSection(ctx),
    buildAnnouncementsSection(ctx),
  ])

  const sections = [notifs, plan, aula, announcements].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  )

  if (sections.length === 0) {
    return 'Spokojnie — nic pilnego. Plan pusty, powiadomień brak, Aula cicha.'
  }

  return sections.join('\n\n')
}

registerTool<Record<string, never>, string>({
  tool: {
    name: 'get_co_przegapilem',
    description:
      'Podsumowanie „co przegapiłem": nieprzeczytane powiadomienia, plan na dziś, Aula, świeże ogłoszenia. Wymaga logowania.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  execute,
})
