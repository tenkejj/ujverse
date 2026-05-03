export type Profile = {
  id: string
  full_name: string | null
  username?: string | null
  avatar_url: string | null
  banner_url?: string | null
  bio?: string | null
  department?: string | null
  /** Jeśli kolumna istnieje w Supabase — data utworzenia profilu. */
  created_at?: string | null
}

export type Post = {
  id?: string
  content?: string
  image_url?: string | null
  created_at?: string
  user_id?: string
  profiles?: Profile | null
}

export type Comment = {
  id: number
  post_id: string
  user_id: string
  content: string
  created_at: string
  parent_id?: number | null
  is_reply?: boolean
  likes_count?: number
  is_liked?: boolean
  can_like?: boolean
  profiles?: Profile | null
}

export type AppNotification = {
  id: string
  user_id: string
  actor_id: string
  type: 'like' | 'comment'
  post_id: string | null
  is_read: boolean
  created_at: string
  actor?: Profile | null
}

/**
 * Typy związane z komunikatami akademickimi żyją w `src/types/content.ts`
 * (`AnnouncementMeta`, `AnnouncementStatus`, `UnifiedContent`) — ten plik
 * zostawiamy dla legacy Profile/Post/Comment/AppNotification.
 */
