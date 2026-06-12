import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import type { AppNotification } from '../../types'

const ACTOR_EMBED =
  'actor:profiles!notifications_actor_id_fkey(id, full_name, username, avatar_url, department)'

/**
 * Embed komunikatu dla powiadomień typu `lecturer_announcement`. Łączymy
 * po FK `notifications.announcement_id -> announcements.id`. Dla innych
 * typów pole jest po prostu NULL — żaden round-trip ekstra po stronie UI.
 */
const ANNOUNCEMENT_EMBED =
  'announcement:announcements!notifications_announcement_id_fkey(id, lecturer_name, body, status, department, created_at)'

/**
 * Embed briefingu dla powiadomień typu `weekly_briefing`. Łączymy po
 * `notifications.briefing_id -> weekly_briefings.id`. Wystarczy zwrócić
 * `id, week_start` do deep-linka — pełny payload pobiera dopiero hook
 * `useWeeklyBriefing` (oszczędność transferu).
 */
const BRIEFING_EMBED =
  'briefing:weekly_briefings!notifications_briefing_id_fkey(id, week_start)'

/**
 * Embed taska dla powiadomień typu `aula_task_new`. Łączymy po
 * `notifications.task_id -> cohort_channel_tasks.id`. Wystarczy title +
 * due_at + (cohort_id, channel_id) do deep-linka — pełny task podbierze
 * dopiero `useChannelTasks` po wejściu w panel.
 */
const TASK_EMBED =
  'task:cohort_channel_tasks!notifications_task_id_fkey(id, title, due_at, channel_id, cohort_id)'

class NotificationsAdapterImpl {
  async listForUser(
    userId: string,
    limit = 50,
  ): Promise<{ data: AppNotification[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`*, ${ACTOR_EMBED}, ${ANNOUNCEMENT_EMBED}, ${BRIEFING_EMBED}, ${TASK_EMBED}`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    const normalized = ((data ?? []) as AppNotification[]).map((n) => ({
      ...n,
      id: String(n.id),
    }))
    return { data: normalized, error }
  }

  async markRead(userId: string, id: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', String(id))
      .eq('user_id', userId)
    return { error }
  }

  async markAllUnreadRead(userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    return { error }
  }

  async deleteAllForUser(userId: string): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    return { error }
  }
}

export const NotificationsAdapter = new NotificationsAdapterImpl()
