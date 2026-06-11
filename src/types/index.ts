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
  /** Domyślnie `user`; administrator ma `admin`. */
  role?: string | null
  /** Globalny ban konta (moderacja). */
  is_banned?: boolean | null
  /** Czy profil pojawia się w wyszukiwarce (Meili). Default `true`. Sterowane z `SettingsView`. */
  is_searchable?: boolean | null
  /** Czy badge wydziału jest pokazywany przy postach autora. Default `true`. */
  show_department?: boolean | null
  /** Kierunek studiów (Aula → rocznik). */
  study_program?: string | null
  /** Rok rozpoczęcia studiów (Aula → rocznik). */
  year_started?: number | null
  /** Tryb studiów (Aula → rocznik). */
  study_mode?: 'stacjonarne' | 'niestacjonarne' | 'doktoranckie' | null
}

export type Post = {
  id?: string
  content?: string
  image_url?: string | null
  tags?: string[] | null
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
  type: 'like' | 'comment' | 'reply_aula' | 'mention_aula'
  post_id: string | null
  /** Referencja do wiadomości w Auli (tylko dla `reply_aula`). */
  cohort_message_id?: number | null
  is_read: boolean
  created_at: string
  actor?: Profile | null
}

/**
 * Typy związane z komunikatami akademickimi żyją w `src/types/content.ts`
 * (`AnnouncementMeta`, `AnnouncementStatus`, `UnifiedContent`) — ten plik
 * zostawiamy dla legacy Profile/Post/Comment/AppNotification.
 *
 * Typy modułu AI (efemeryczny czat) żyją w `src/types/ai.ts`.
 * Re-eksport poniżej zapewnia spójny entrypoint `from '../types'`.
 */
export type {
  ChatRole,
  ChatMessage,
  ChatConfig,
  LLMProvider,
  ChatRequestMessage,
  ChatRequestBody,
} from './ai'
