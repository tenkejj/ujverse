import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../supabaseClient'
import type { AppNotification } from '../../types'

const ACTOR_EMBED =
  'actor:profiles!notifications_actor_id_fkey(id, full_name, username, avatar_url)'

class NotificationsAdapterImpl {
  async listForUser(
    userId: string,
    limit = 50,
  ): Promise<{ data: AppNotification[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`*, ${ACTOR_EMBED}`)
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
