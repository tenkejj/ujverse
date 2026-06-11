export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          content: string | null
          created_at: string
          id: number
          parent_id: number | null
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          parent_id?: number | null
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          parent_id?: number | null
          post_id?: string | null
          user_id?: string | null
        }
      }
      likes: {
        Row: {
          created_at: string
          id: number
          post_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          post_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          post_id?: number | null
          user_id?: string | null
        }
      }
      comment_likes: {
        Row: {
          comment_id: number
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          id?: number
          user_id?: string
        }
      }
      comment_replies: {
        Row: {
          content: string | null
          created_at: string
          id: number
          media_url: string | null
          parent_comment_id: number
          post_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          media_url?: string | null
          parent_comment_id: number
          post_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          media_url?: string | null
          parent_comment_id?: number
          post_id?: string | null
          user_id?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      group_memberships: {
        Row: {
          group_id: string
          post_id: number
          created_at: string
        }
        Insert: {
          group_id: string
          post_id: number
          created_at?: string
        }
        Update: {
          group_id?: string
          post_id?: number
          created_at?: string
        }
      }
      cohorts: {
        Row: {
          id: string
          department: string | null
          study_program: string
          year_started: number
          study_mode: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          department?: string | null
          study_program: string
          year_started: number
          study_mode: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          department?: string | null
          study_program?: string
          year_started?: number
          study_mode?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      cohort_members: {
        Row: {
          cohort_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          cohort_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          cohort_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
      }
      cohort_messages: {
        Row: {
          id: number
          cohort_id: string
          user_id: string
          content: string
          parent_id: number | null
          channel_id: number | null
          created_at: string
          edited_at: string | null
          deleted_at: string | null
          pinned_at: string | null
          pinned_by: string | null
        }
        Insert: {
          id?: number
          cohort_id: string
          user_id: string
          content: string
          parent_id?: number | null
          channel_id?: number | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
        Update: {
          id?: number
          cohort_id?: string
          user_id?: string
          content?: string
          parent_id?: number | null
          channel_id?: number | null
          created_at?: string
          edited_at?: string | null
          deleted_at?: string | null
          pinned_at?: string | null
          pinned_by?: string | null
        }
      }
      cohort_channels: {
        Row: {
          id: number
          cohort_id: string
          slug: string
          name: string
          description: string | null
          created_by: string | null
          created_at: string
          archived_at: string | null
          kind: ChannelKind
        }
        Insert: {
          id?: number
          cohort_id: string
          slug: string
          name: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          archived_at?: string | null
          kind?: ChannelKind
        }
        Update: {
          id?: number
          cohort_id?: string
          slug?: string
          name?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
          archived_at?: string | null
          kind?: ChannelKind
        }
      }
      cohort_message_reactions: {
        Row: {
          id: number
          message_id: number
          cohort_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: number
          message_id: number
          cohort_id?: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: number
          message_id?: number
          cohort_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      cohort_message_attachments: {
        Row: {
          id: number
          message_id: number
          cohort_id: string
          user_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          width: number | null
          height: number | null
          created_at: string
        }
        Insert: {
          id?: number
          message_id: number
          cohort_id?: string
          user_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
          width?: number | null
          height?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          message_id?: number
          cohort_id?: string
          user_id?: string
          storage_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
          width?: number | null
          height?: number | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_replies_engagement_snapshot: {
        Args: {
          p_post_ids: number[]
          p_reply_ids: number[]
          p_viewer_id?: string | null
        }
        Returns: {
          entity_type: string
          entity_id: number
          likes_count: number
          comments_count: number
          has_liked: boolean
        }[]
      }
      ensure_cohort_for_profile: {
        Args: {
          p_user_id: string
        }
        Returns: string | null
      }
      toggle_cohort_message_pin: {
        Args: {
          p_message_id: number
        }
        Returns: boolean
      }
    }
  }
}

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Wiersz `public.groups` — źródło prawdy dla menu grup i triggera tagów. */
export type Group = TablesRow<'groups'>

/** Wiersz `public.group_memberships` — relacja N:N post ↔ grupa. */
export type GroupMembership = TablesRow<'group_memberships'>

/** Payload do INSERT'u członkostwa w grupie (z opcjonalnym `created_at`). */
export type GroupMembershipInsert = TablesInsert<'group_memberships'>

/** Wiersz `public.cohorts` — rocznik studiów (Aula). */
export type Cohort = TablesRow<'cohorts'>

/** Wiersz `public.cohort_members` — relacja user ↔ rocznik. */
export type CohortMember = TablesRow<'cohort_members'>

/** Wiersz `public.cohort_messages` — wiadomość w czacie rocznika. */
export type CohortMessage = TablesRow<'cohort_messages'>

/** Wiersz `public.cohort_message_reactions` — reakcja emoji na wiadomość. */
export type CohortMessageReaction = TablesRow<'cohort_message_reactions'>

/** Wiersz `public.cohort_message_attachments` — załącznik (plik) wiadomości Auli. */
export type CohortMessageAttachment = TablesRow<'cohort_message_attachments'>

/**
 * Typ zajęć dla `cohort_channels.kind` — ASCII enum trzymany w DB
 * (CHECK constraint), wartość `'cw'` mapowana na display `'ćw'` po stronie
 * klienta przez `CHANNEL_KIND_META` w
 * [src/components/aula/ChannelKindPill.tsx](src/components/aula/ChannelKindPill.tsx).
 * Zmiana listy = update CHECK w DB + meta w lockstep.
 */
export type ChannelKind = 'wyk' | 'cw' | 'lab' | 'sem' | 'proj' | 'inne'

/**
 * Wiersz `public.cohort_channels` — sub-kanał Auli (Sala) per rocznik.
 *
 * UWAGA: virtual "Sala główna" NIE ma rekordu w tej tabeli — wiadomości z
 * `channel_id IS NULL` są Salą główną. `slug` ma reserved guard CHECK przeciw
 * wartości `'general'` (kolizja URL). Sala główna nie ma też `kind`.
 */
export type CohortChannel = TablesRow<'cohort_channels'>
