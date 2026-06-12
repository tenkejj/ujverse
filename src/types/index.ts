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
  /** Timestamp ukończenia interaktywnego onboardingu (gamifikacja). */
  onboarding_completed_at?: string | null
  /** Timestamp gdy user wybrał „Pomiń tour" — nie pokazujemy ponownie auto. */
  onboarding_skipped_at?: string | null
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
  /**
   * Powiadomienia od scrapera (`lecturer_announcement`) NIE mają autora-osoby,
   * więc `actor_id` jest nullowalne po migracji 20260615100000.
   */
  actor_id: string | null
  type:
    | 'like'
    | 'comment'
    | 'reply_aula'
    | 'mention_aula'
    | 'lecturer_announcement'
    | 'weekly_briefing'
    | 'aula_task_new'
  post_id: string | null
  /** Referencja do wiadomości w Auli (tylko dla `reply_aula`). */
  cohort_message_id?: number | null
  /** Referencja do komunikatu (`announcements.id`) — tylko dla `lecturer_announcement`. */
  announcement_id?: string | null
  /** Referencja do briefingu (`weekly_briefings.id`) — tylko dla `weekly_briefing`. */
  briefing_id?: number | null
  /** Referencja do zadania (`cohort_channel_tasks.id`) — tylko dla `aula_task_new`. */
  task_id?: number | null
  is_read: boolean
  created_at: string
  actor?: Profile | null
  /** Embed danych komunikatu dla powiadomień typu `lecturer_announcement`. */
  announcement?: {
    id: string
    lecturer_name: string
    body: string
    status: 'cancelled' | 'remote' | 'duty'
    department: string | null
    created_at: string
  } | null
  /** Embed briefingu — tylko week_start dla deep-linka, payload pobieramy osobno. */
  briefing?: {
    id: number
    week_start: string
  } | null
  /**
   * Embed zadania — tylko pola potrzebne do row rendera + deep-linka
   * (title + due_at + channel_id + cohort_id). Pełen task pobiera dopiero
   * hook `useChannelTasks` po wejściu w panel.
   */
  task?: {
    id: number
    title: string
    due_at: string | null
    channel_id: number | null
    cohort_id: string
  } | null
}

/**
 * Subskrypcja użytkownika na nazwisko wykładowcy. `lecturer_key` jest
 * stabilnym kluczem matchingu (lower + bez diakrytyków + bez tytułów) —
 * po stronie serwera generowany przez `public.lecturer_name_key()`.
 */
export type LecturerSubscription = {
  id: number
  user_id: string
  display_name: string
  lecturer_key: string
  created_at: string
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
