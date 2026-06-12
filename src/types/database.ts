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
      cohort_channel_mutes: {
        Row: {
          id: number
          user_id: string
          cohort_id: string
          channel_id: number | null
          mode: ChannelMuteMode
          muted_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          cohort_id: string
          channel_id?: number | null
          mode: ChannelMuteMode
          muted_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          cohort_id?: string
          channel_id?: number | null
          mode?: ChannelMuteMode
          muted_until?: string | null
          created_at?: string
          updated_at?: string
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
      cohort_message_polls: {
        Row: {
          id: number
          message_id: number
          cohort_id: string
          user_id: string
          question: string
          options: string[]
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          message_id: number
          cohort_id?: string
          user_id: string
          question: string
          options: string[]
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          message_id?: number
          cohort_id?: string
          user_id?: string
          question?: string
          options?: string[]
          closed_at?: string | null
          created_at?: string
        }
      }
      cohort_channel_tasks: {
        Row: {
          id: number
          cohort_id: string
          channel_id: number | null
          created_by: string
          title: string
          description: string | null
          due_at: string | null
          priority: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          cohort_id: string
          channel_id?: number | null
          created_by: string
          title: string
          description?: string | null
          due_at?: string | null
          priority?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          cohort_id?: string
          channel_id?: number | null
          created_by?: string
          title?: string
          description?: string | null
          due_at?: string | null
          priority?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
        }
      }
      cohort_task_completions: {
        Row: {
          task_id: number
          user_id: string
          cohort_id: string
          completed_at: string
        }
        Insert: {
          task_id: number
          user_id: string
          cohort_id?: string
          completed_at?: string
        }
        Update: {
          task_id?: number
          user_id?: string
          cohort_id?: string
          completed_at?: string
        }
      }
      cohort_channel_notes: {
        Row: {
          id: number
          cohort_id: string
          channel_id: number | null
          content: string
          version: number
          last_edited_by: string | null
          last_edited_at: string
          created_at: string
        }
        Insert: {
          id?: number
          cohort_id: string
          channel_id?: number | null
          content?: string
          version?: number
          last_edited_by?: string | null
          last_edited_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          cohort_id?: string
          channel_id?: number | null
          content?: string
          version?: number
          last_edited_by?: string | null
          last_edited_at?: string
          created_at?: string
        }
      }
      cohort_poll_votes: {
        Row: {
          poll_id: number
          user_id: string
          cohort_id: string
          option_index: number
          created_at: string
        }
        Insert: {
          poll_id: number
          user_id: string
          cohort_id?: string
          option_index: number
          created_at?: string
        }
        Update: {
          poll_id?: number
          user_id?: string
          cohort_id?: string
          option_index?: number
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
      vote_on_poll: {
        Args: {
          p_poll_id: number
          p_option_index: number
        }
        Returns: void
      }
      close_poll: {
        Args: {
          p_poll_id: number
        }
        Returns: void
      }
      update_channel_note: {
        Args: {
          p_cohort_id: string
          p_channel_id: number | null
          p_expected_version: number
          p_content: string
        }
        Returns: {
          version: number
          content: string
          last_edited_by: string | null
          last_edited_at: string
        }
      }
      toggle_my_task_completion: {
        Args: {
          p_task_id: number
        }
        Returns: boolean
      }
      toggle_global_task_done: {
        Args: {
          p_task_id: number
        }
        Returns: string | null
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

/**
 * Per-user per-channel notification preferences. Brak rekordu = `'all'`
 * (default — pełne powiadomienia). UI usuwa rekord gdy user wraca do
 * default żeby tabela pozostała chuda; `set_channel_mute` RPC enforce'uje
 * ten invariant.
 *
 *   - `'all'`           = pełne powiadomienia (reply + mention)
 *   - `'mentions_only'` = tylko `@username` powiadamia (replies skipowane)
 *   - `'none'`          = całkowite wyciszenie (nic nie powiadamia)
 *
 * `muted_until` NULL = wyciszone na zawsze (do ręcznego cofnięcia);
 * timestamp = snooze do tej chwili (po wygaśnięciu trigger traktuje jak `'all'`).
 */
export type ChannelMuteMode = 'all' | 'mentions_only' | 'none'

/** Wiersz `public.cohort_channel_mutes` — preferencje wyciszania sali. */
export type CohortChannelMute = TablesRow<'cohort_channel_mutes'>

/**
 * Wiersz `public.cohort_message_polls` — ankieta doczepiona 1:1 do
 * `cohort_messages` przez UNIQUE `message_id`. `options` to JSONB array
 * stringów (2–10 opcji, CHECK w DB). `closed_at != null` blokuje vote_on_poll
 * po stronie RPC.
 */
export type CohortMessagePoll = TablesRow<'cohort_message_polls'>

/**
 * Wiersz `public.cohort_poll_votes` — pojedynczy głos w ankiecie.
 *
 * Single-select MVP: PRIMARY KEY `(poll_id, user_id)` — jeden głos per user
 * per poll. Zmiana głosu = atomowy DELETE + INSERT przez RPC `vote_on_poll`
 * (atomicity gwarantowana w transakcji RPC, nie po stronie klienta).
 * `option_index` jest 0-based indexem w `cohort_message_polls.options`.
 */
export type CohortPollVote = TablesRow<'cohort_poll_votes'>

/**
 * Agregat ankiet zbierany w hooku `useCohortPolls` na potrzeby renderowania
 * w `PollDisplay` (poll + counts per opcja + voters per opcja + flag czy
 * aktualny user już głosował i na co).
 *
 * `votersPerOption[i]` to lista userId dla opcji `i` (nie posortowana —
 * UI sortuje po `userNames`); `myVoteIndex` to indeks opcji aktualnego usera
 * lub `null` gdy jeszcze nie głosował.
 */
export type CohortPollAggregate = {
  poll: CohortMessagePoll
  /** Liczba głosów per opcja (długość = `poll.options.length`). */
  countsPerOption: number[]
  /** ID-ki voterów per opcja (do awatarów). */
  votersPerOption: string[][]
  /** Łączna liczba unikalnych głosów (= suma counts, single-select). */
  totalVotes: number
  myVoteIndex: number | null
}

/**
 * Wiersz `public.cohort_channel_notes` — wspólna notatka per sala
 * (Markdown scratchpad). 1 notatka per `(cohort_id, channel_id)`;
 * `channel_id IS NULL` = notatka Sali głównej.
 *
 * `version` jest BIGINT inkrementowanym przez RPC `update_channel_note` —
 * concurrency LWW z conflict detection (RPC RAISE `'conflict:<current>'`
 * gdy expected != current). Klient na conflict reload'uje fresh wartość.
 */
export type CohortChannelNote = TablesRow<'cohort_channel_notes'>

/**
 * Snapshot zwracany przez RPC `update_channel_note` przy sukcesie.
 * NIE zawiera `id`/`cohort_id`/`channel_id` bo klient już je zna z params.
 */
export type ChannelNoteUpdateResult = {
  version: number
  content: string
  last_edited_by: string | null
  last_edited_at: string
}

/**
 * Priority zadania w `cohort_channel_tasks`. CHECK constraint w DB
 * blokuje wartości spoza enuma; UI mapuje na display label + color
 * przez `TASK_PRIORITY_META` w
 * [src/components/aula/TaskPriorityPill.tsx](src/components/aula/TaskPriorityPill.tsx).
 */
export type TaskPriority = 'low' | 'normal' | 'high'

/**
 * Wiersz `public.cohort_channel_tasks` — zadanie/deadline per sala.
 *
 * `channel_id IS NULL` = zadanie w Sali głównej (rocznikowe).
 * `completed_at != NULL` = globalnie zamknięte ("deal done", każdy
 * w cohorcie mógł zaznaczyć przez RPC `toggle_global_task_done`).
 *
 * `priority` to TaskPriority (CHECK w DB).
 */
export type CohortChannelTask = TablesRow<'cohort_channel_tasks'>

/**
 * Per-user "ja zrobiłem" — PRIMARY KEY (task_id, user_id) = jeden wpis
 * per user per task (idempotent insert; toggle przez RPC robi DELETE-or-INSERT
 * w transakcji).
 */
export type CohortTaskCompletion = TablesRow<'cohort_task_completions'>

/**
 * Agregat zadania na potrzeby renderowania w `TaskItem`. Zawiera task +
 * counter "ile osób zaznaczyło ✓" + ID-ki tych osób (do tooltipa) + flag
 * czy aktualny user już zaznaczył (i kiedy).
 */
export type CohortTaskAggregate = {
  task: CohortChannelTask
  /** Liczba unikalnych users co zaznaczyli `cohort_task_completions`. */
  completionsCount: number
  /** ID-ki tych users (do mini-awatarów / tooltip). */
  completionUserIds: string[]
  /** Timestamp gdy aktualny user zaznaczył, `null` gdy nie zaznaczył. */
  myCompletedAt: string | null
}
