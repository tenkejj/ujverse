/**
 * Wspólne zapytanie i formatowanie powiadomień dla tooli Versusia.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const NOTIF_SELECT = `id, type, is_read, created_at, post_id, cohort_message_id, announcement_id, briefing_id, task_id,
  actor:profiles!notifications_actor_id_fkey(id, full_name, username),
  announcement:announcements!notifications_announcement_id_fkey(id, lecturer_name, body, status),
  briefing:weekly_briefings!notifications_briefing_id_fkey(id, week_start),
  task:cohort_channel_tasks!notifications_task_id_fkey(id, title, due_at)`

type ActorEmbed = {
  id: string | null
  full_name: string | null
  username: string | null
} | null

type AnnouncementEmbed = {
  id: string
  lecturer_name: string | null
  body: string | null
  status: string | null
} | null

type TaskEmbed = {
  id: number
  title: string | null
  due_at: string | null
} | null

export type NotificationRow = {
  id: string
  type: string
  is_read: boolean
  created_at: string
  post_id: string | null
  cohort_message_id: string | null
  announcement_id: string | null
  briefing_id: string | null
  task_id: number | null
  actor: ActorEmbed | ActorEmbed[]
  announcement: AnnouncementEmbed | AnnouncementEmbed[]
  briefing: { id: string; week_start: string | null } | null
  task: TaskEmbed | TaskEmbed[]
}

function firstEmbed<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffH < 1) return 'przed chwilą'
  if (diffH < 24) return `${diffH}h temu`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'wczoraj'
  if (diffD < 7) return `${diffD} dni temu`
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

export function formatNotificationLine(row: NotificationRow): string {
  const actor = firstEmbed(row.actor)
  const actorName = actor?.full_name ?? actor?.username ?? 'Ktoś'
  const when = formatWhen(row.created_at)

  switch (row.type) {
    case 'like':
      return `**${actorName}** polubił(a) Twój wpis — ${when}`
    case 'comment':
      return `**${actorName}** skomentował(a) Twój wpis — ${when}`
    case 'reply_aula':
      return `**${actorName}** odpowiedział(a) w Auli — ${when}`
    case 'mention_aula':
      return `**${actorName}** wspomniał(a) Cię w Auli — ${when}`
    case 'lecturer_announcement': {
      const ann = firstEmbed(row.announcement)
      const who = ann?.lecturer_name ?? 'Wykładowca'
      const preview = ann?.body ? clip(ann.body, 60) : 'nowy komunikat'
      return `**${who}** — ${preview} — ${when}`
    }
    case 'weekly_briefing':
      return `Twój tygodniowy briefing jest gotowy — ${when}`
    case 'aula_task_new': {
      const task = firstEmbed(row.task)
      const title = task?.title ?? 'nowe zadanie'
      return `**${actorName}** dodał(a) zadanie: ${title} — ${when}`
    }
    default:
      return `Powiadomienie (${row.type}) — ${when}`
  }
}

export async function fetchUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIF_SELECT)
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[notificationHelpers] fetch error:', error.message)
    return []
  }

  return ((data ?? []) as NotificationRow[]).map((n) => ({
    ...n,
    id: String(n.id),
  }))
}

export function formatNotificationsMarkdown(
  items: NotificationRow[],
  opts?: { heading?: string; emptyText?: string },
): string {
  const heading = opts?.heading ?? '**Powiadomienia**'
  if (items.length === 0) {
    return opts?.emptyText ?? `${heading}\nBrak nieprzeczytanych — spokój.`
  }
  const lines = items.map((n) => `- ${formatNotificationLine(n)}`)
  return `${heading} (${items.length})\n${lines.join('\n')}`
}
