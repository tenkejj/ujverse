/**
 * UJverse — CohortService: warstwa danych modułu Aula (czat per rocznik).
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import type {
  ChannelKind,
  Cohort,
  CohortChannel,
  CohortMessage,
  CohortMessageAttachment,
  CohortMessageReaction,
} from '../types/database'
import type { Profile } from '../types'
import { AULA_BUCKET } from '../lib/aulaUpload'

const MESSAGE_AUTHOR_EMBED =
  'profiles!cohort_messages_user_id_fkey(id, full_name, username, avatar_url, department)'

/**
 * Lista kolumn dla SELECT na `cohort_channels`. Wyodrębniona, bo używana
 * w 3 miejscach (get / create / update) — dodanie nowej kolumny (np. `kind`)
 * = jedna linia zamiast trzech rozjazdów.
 */
const CHANNEL_SELECT_FIELDS =
  'id, cohort_id, slug, name, description, created_by, created_at, archived_at, kind'

/** Wiadomość w Auli wraz z osadzonym autorem (do renderu). */
export type CohortMessageWithAuthor = CohortMessage & {
  profiles?: Profile | null
}

/** Lekki wiersz członka rocznika (do listy w sidebarze). */
export type CohortMemberProfile = Pick<
  Profile,
  'id' | 'full_name' | 'username' | 'avatar_url' | 'department'
> & { role: string; joined_at: string }

function normalizeMessage(
  raw: Record<string, unknown> & { profiles?: unknown },
): CohortMessageWithAuthor {
  const profileRaw = raw.profiles
  const profile = Array.isArray(profileRaw)
    ? ((profileRaw[0] ?? null) as Profile | null)
    : ((profileRaw ?? null) as Profile | null)
  return {
    id: Number(raw.id),
    cohort_id: String(raw.cohort_id ?? ''),
    user_id: String(raw.user_id ?? ''),
    content: String(raw.content ?? ''),
    parent_id: raw.parent_id == null ? null : Number(raw.parent_id),
    channel_id: raw.channel_id == null ? null : Number(raw.channel_id),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    edited_at: raw.edited_at == null ? null : String(raw.edited_at),
    deleted_at: raw.deleted_at == null ? null : String(raw.deleted_at),
    pinned_at: raw.pinned_at == null ? null : String(raw.pinned_at),
    pinned_by: raw.pinned_by == null ? null : String(raw.pinned_by),
    profiles: profile,
  }
}

const MESSAGE_SELECT_FIELDS =
  `id, cohort_id, user_id, content, parent_id, channel_id, created_at, edited_at, deleted_at, pinned_at, pinned_by, ${MESSAGE_AUTHOR_EMBED}`

/**
 * `channelId` w `getMessages` / `getPinnedMessages` używa konwencji:
 *   - `null` = virtual #general (filter `channel_id IS NULL`)
 *   - `number` = konkretny kanał
 *   - `undefined` = bez filtru (wszystkie kanały — used by deep-link resolver)
 */
type ChannelFilter = number | null | undefined

class CohortServiceImpl {
  /** Roczniki, do których należy użytkownik (z metadanymi cohortu). */
  async getMyCohorts(
    userId: string,
  ): Promise<{ data: Cohort[]; error: PostgrestError | null }> {
    // DESC żeby najnowsze członkostwo było `data[0]` — useMyCohort bierze pierwszy.
    // Po triggerze re-cohorting starych członkostw nie powinno już być, ale ta
    // kolejność to safety-net dla istniejących bałaganów w danych (np. user
    // przeszedł onboarding 2x przed wgraniem migracji 20260611201000).
    const { data, error } = await supabase
      .from('cohort_members')
      .select('role, joined_at, cohorts(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })

    const cohorts = ((data ?? []) as Array<{ cohorts: Cohort | Cohort[] | null }>)
      .map((row) => (Array.isArray(row.cohorts) ? row.cohorts[0] ?? null : row.cohorts))
      .filter((c): c is Cohort => c != null)
    return { data: cohorts, error }
  }

  /** Lista członków rocznika (do sidebaru). */
  async getMembers(
    cohortId: string,
    limit = 60,
  ): Promise<{ data: CohortMemberProfile[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_members')
      .select('role, joined_at, profiles!cohort_members_user_id_fkey(id, full_name, username, avatar_url, department)')
      .eq('cohort_id', cohortId)
      .order('joined_at', { ascending: true })
      .limit(limit)

    const members = ((data ?? []) as Array<{
      role: string
      joined_at: string
      profiles: Profile | Profile[] | null
    }>)
      .map((row): CohortMemberProfile | null => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles
        if (!p) return null
        return {
          id: p.id,
          full_name: p.full_name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
          department: p.department ?? null,
          role: row.role,
          joined_at: row.joined_at,
        }
      })
      .filter((m): m is CohortMemberProfile => m != null)
    return { data: members, error }
  }

  /**
   * Strona wiadomości (najstarsze→najnowsze do renderu). `before` = ISO/created_at
   * najstarszej już wczytanej wiadomości dla paginacji wstecz.
   */
  async getMessages(
    cohortId: string,
    opts?: { before?: string; limit?: number; channelId?: ChannelFilter },
  ): Promise<{ data: CohortMessageWithAuthor[]; error: PostgrestError | null }> {
    const limit = opts?.limit ?? 50
    let query = supabase
      .from('cohort_messages')
      .select(MESSAGE_SELECT_FIELDS)
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (opts?.channelId === null) query = query.is('channel_id', null)
    else if (typeof opts?.channelId === 'number') query = query.eq('channel_id', opts.channelId)

    if (opts?.before) query = query.lt('created_at', opts.before)

    const { data, error } = await query
    const normalized = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => normalizeMessage(row))
      // odwracamy z DESC (fetch) na ASC (render od góry)
      .reverse()
    return { data: normalized, error }
  }

  /**
   * Fetch pojedynczej wiadomości po id (deep-link `?message=<id>` resolver —
   * AulaView potrzebuje `channel_id` żeby przełączyć na właściwy kanał).
   */
  async getMessageById(
    messageId: number,
  ): Promise<{ data: CohortMessageWithAuthor | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_messages')
      .select(MESSAGE_SELECT_FIELDS)
      .eq('id', messageId)
      .maybeSingle()
    return {
      data: data ? normalizeMessage(data as Record<string, unknown>) : null,
      error,
    }
  }

  async sendMessage(params: {
    cohortId: string
    userId: string
    content: string
    parentId?: number | null
    channelId?: number | null
  }): Promise<{ data: CohortMessageWithAuthor | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_messages')
      .insert({
        cohort_id: params.cohortId,
        user_id: params.userId,
        content: params.content,
        parent_id: params.parentId ?? null,
        channel_id: params.channelId ?? null,
      })
      .select(MESSAGE_SELECT_FIELDS)
      .single()

    return {
      data: data ? normalizeMessage(data as Record<string, unknown>) : null,
      error,
    }
  }

  async editMessage(
    id: number,
    content: string,
  ): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_messages')
      .update({ content, edited_at: new Date().toISOString() })
      .eq('id', id)
    return { error }
  }

  /** Soft-delete: czyścimy treść i znaczymy deleted_at (RLS: tylko własne). */
  async softDeleteMessage(id: number): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_messages')
      .update({ content: '', deleted_at: new Date().toISOString() })
      .eq('id', id)
    return { error }
  }

  /**
   * Realtime na wiadomościach rocznika. Zwraca channel — caller robi
   * `supabase.removeChannel(channel)` w cleanupie. `onStatus` opcjonalny
   * (fallback na polling przy CHANNEL_ERROR).
   */
  subscribeToMessages(
    cohortId: string,
    handlers: {
      onInsert?: (row: CohortMessage) => void
      onUpdate?: (row: CohortMessage) => void
      onDelete?: (row: CohortMessage) => void
    },
    onStatus?: (status: string) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`aula-cohort-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cohort_messages',
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            handlers.onInsert?.(payload.new as CohortMessage)
          } else if (payload.eventType === 'UPDATE') {
            handlers.onUpdate?.(payload.new as CohortMessage)
          } else if (payload.eventType === 'DELETE') {
            handlers.onDelete?.(payload.old as CohortMessage)
          }
        },
      )
      .subscribe((status) => onStatus?.(status))
    return channel
  }

  // ────────────────────────────────────────────────────────────────────────
  // Pin
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Pin/unpin wiadomości przez RPC SECURITY DEFINER (omija UPDATE-own RLS).
   * Zwraca nowy stan `is_pinned`. RPC może rzucić `pin_limit_reached` —
   * caller łapie i pokazuje toast.
   */
  async togglePin(messageId: number): Promise<{ pinned: boolean; error: PostgrestError | null }> {
    const { data, error } = await supabase.rpc('toggle_cohort_message_pin', {
      p_message_id: messageId,
    })
    return { pinned: !!data, error }
  }

  /**
   * Aktualne przypięte wiadomości w roczniku (z autorami).
   *
   * Cap RPC = 10 per channel; UI pobiera per channel, więc też max 10.
   * `channelId` honoruje konwencję ChannelFilter (null = #general, number =
   * konkretny kanał, undefined = wszystkie kanały — używane np. przez
   * legacy lub debug).
   */
  async getPinnedMessages(
    cohortId: string,
    channelId?: ChannelFilter,
  ): Promise<{ data: CohortMessageWithAuthor[]; error: PostgrestError | null }> {
    let query = supabase
      .from('cohort_messages')
      .select(MESSAGE_SELECT_FIELDS)
      .eq('cohort_id', cohortId)
      .not('pinned_at', 'is', null)
      .is('deleted_at', null)
      .order('pinned_at', { ascending: false })
      .limit(10)

    if (channelId === null) query = query.is('channel_id', null)
    else if (typeof channelId === 'number') query = query.eq('channel_id', channelId)

    const { data, error } = await query
    const normalized = ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
      normalizeMessage(row),
    )
    return { data: normalized, error }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Reactions
  // ────────────────────────────────────────────────────────────────────────

  /**
   * INSERT reakcji. cohort_id wypełnia trigger BEFORE INSERT — klient nie
   * musi go znać. RLS WITH CHECK weryfikuje membership + ownership.
   */
  async addReaction(
    messageId: number,
    emoji: string,
    userId: string,
  ): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('cohort_message_reactions').insert({
      message_id: messageId,
      emoji,
      user_id: userId,
    })
    return { error }
  }

  /** DELETE własnej reakcji (RLS gwarantuje user_id = auth.uid()). */
  async removeReaction(
    messageId: number,
    emoji: string,
    userId: string,
  ): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('emoji', emoji)
      .eq('user_id', userId)
    return { error }
  }

  /**
   * Bulk fetch reakcji dla cohortu. Opcjonalny `sinceMessageId` przy
   * paginacji wstecz — pobieramy tylko reakcje dla nowo wczytanych
   * wiadomości żeby nie ciągnąć całej historii.
   */
  async getReactionsForCohort(
    cohortId: string,
    opts?: { sinceMessageId?: number; untilMessageId?: number },
  ): Promise<{ data: CohortMessageReaction[]; error: PostgrestError | null }> {
    let query = supabase
      .from('cohort_message_reactions')
      .select('id, message_id, cohort_id, user_id, emoji, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: true })
      .limit(1000)

    if (opts?.sinceMessageId != null) query = query.gte('message_id', opts.sinceMessageId)
    if (opts?.untilMessageId != null) query = query.lte('message_id', opts.untilMessageId)

    const { data, error } = await query
    return { data: (data ?? []) as CohortMessageReaction[], error }
  }

  /** Realtime na reakcjach w cohortzie (INSERT + DELETE). */
  subscribeToReactions(
    cohortId: string,
    handlers: {
      onInsert?: (row: CohortMessageReaction) => void
      onDelete?: (row: CohortMessageReaction) => void
    },
    onStatus?: (status: string) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`aula-reactions-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cohort_message_reactions',
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            handlers.onInsert?.(payload.new as CohortMessageReaction)
          } else if (payload.eventType === 'DELETE') {
            handlers.onDelete?.(payload.old as CohortMessageReaction)
          }
        },
      )
      .subscribe((status) => onStatus?.(status))
    return channel
  }

  // ────────────────────────────────────────────────────────────────────────
  // Attachments
  // ────────────────────────────────────────────────────────────────────────

  /**
   * INSERT wpisu o załączniku. `cohort_id` wypełnia trigger BEFORE INSERT.
   * RLS WITH CHECK weryfikuje że `user_id == auth.uid()` ORAZ że uploader
   * jest autorem parent wiadomości (zabezpiecza przed doczepianiem cudzych
   * plików do cudzych wiadomości).
   */
  async createAttachmentRecord(params: {
    messageId: number
    userId: string
    storagePath: string
    fileName: string
    mimeType: string
    sizeBytes: number
    width: number | null
    height: number | null
  }): Promise<{ data: CohortMessageAttachment | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_message_attachments')
      .insert({
        message_id: params.messageId,
        user_id: params.userId,
        storage_path: params.storagePath,
        file_name: params.fileName,
        mime_type: params.mimeType,
        size_bytes: params.sizeBytes,
        width: params.width,
        height: params.height,
      })
      .select('id, message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes, width, height, created_at')
      .single()
    return { data, error }
  }

  /** Załączniki dla cohortu, opcjonalnie filtrowane po zakresie message_id. */
  async getAttachmentsForCohort(
    cohortId: string,
    opts?: { sinceMessageId?: number; untilMessageId?: number },
  ): Promise<{ data: CohortMessageAttachment[]; error: PostgrestError | null }> {
    let query = supabase
      .from('cohort_message_attachments')
      .select('id, message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes, width, height, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: true })
      .limit(1000)

    if (opts?.sinceMessageId != null) query = query.gte('message_id', opts.sinceMessageId)
    if (opts?.untilMessageId != null) query = query.lte('message_id', opts.untilMessageId)

    const { data, error } = await query
    return { data: (data ?? []) as CohortMessageAttachment[], error }
  }

  /** Ostatnie N plików w cohortzie z embed autora — dla RecentFilesPanel. */
  async getRecentFiles(
    cohortId: string,
    limit = 50,
  ): Promise<{
    data: Array<CohortMessageAttachment & { profiles: Profile | null }>
    error: PostgrestError | null
  }> {
    const { data, error } = await supabase
      .from('cohort_message_attachments')
      .select(
        `id, message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes, width, height, created_at,
         profiles!cohort_message_attachments_user_id_fkey(id, full_name, username, avatar_url, department)`,
      )
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(limit)

    const rows = ((data ?? []) as Array<Record<string, unknown> & { profiles: unknown }>).map(
      (row) => {
        const p = row.profiles
        const profile = Array.isArray(p)
          ? ((p[0] ?? null) as Profile | null)
          : ((p ?? null) as Profile | null)
        return {
          id: Number(row.id),
          message_id: Number(row.message_id),
          cohort_id: String(row.cohort_id),
          user_id: String(row.user_id),
          storage_path: String(row.storage_path),
          file_name: String(row.file_name),
          mime_type: String(row.mime_type),
          size_bytes: Number(row.size_bytes),
          width: row.width == null ? null : Number(row.width),
          height: row.height == null ? null : Number(row.height),
          created_at: String(row.created_at),
          profiles: profile,
        }
      },
    )
    return { data: rows, error }
  }

  /** Pojedynczy signed URL (TTL w sekundach, default 1h). */
  async signedUrlForPath(
    path: string,
    expiresIn = 3600,
  ): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(AULA_BUCKET)
      .createSignedUrl(path, expiresIn)
    if (error) return null
    return data?.signedUrl ?? null
  }

  /**
   * Batch signed URLs — używamy przy initial fetch / re-sign, żeby ograniczyć
   * ilość requestów. Zwraca Map<path, url>; pomija path'y które się nie udały.
   */
  async signedUrlsForPaths(
    paths: string[],
    expiresIn = 3600,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (paths.length === 0) return result
    const { data, error } = await supabase.storage
      .from(AULA_BUCKET)
      .createSignedUrls(paths, expiresIn)
    if (error || !data) return result
    for (const entry of data) {
      if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl)
    }
    return result
  }

  /** Realtime: nowe / usunięte załączniki w cohortzie. */
  subscribeToAttachments(
    cohortId: string,
    handlers: {
      onInsert?: (row: CohortMessageAttachment) => void
      onDelete?: (row: CohortMessageAttachment) => void
    },
    onStatus?: (status: string) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`aula-attachments-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cohort_message_attachments',
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            handlers.onInsert?.(payload.new as CohortMessageAttachment)
          } else if (payload.eventType === 'DELETE') {
            handlers.onDelete?.(payload.old as CohortMessageAttachment)
          }
        },
      )
      .subscribe((status) => onStatus?.(status))
    return channel
  }

  /** Usuwa wpis z tabeli + obiekt z bucketa. RLS gwarantuje że tylko własne. */
  async deleteAttachment(
    id: number,
    storagePath: string,
  ): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_message_attachments')
      .delete()
      .eq('id', id)
    if (error) return { error }
    // Best-effort cleanup w buckecie; tabela jest source of truth.
    await supabase.storage.from(AULA_BUCKET).remove([storagePath])
    return { error: null }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Channels (sub-kanały)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Wszystkie kanały rocznika (active + archived). Caller dzieli na buckety
   * w hooku. Sort: archived na dole (NULLS FIRST w indexie), wewnątrz po
   * `created_at DESC` (najnowsze najpierw — większa szansa że to "live"
   * projektowy kanał).
   */
  async getChannels(
    cohortId: string,
  ): Promise<{ data: CohortChannel[]; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_channels')
      .select(CHANNEL_SELECT_FIELDS)
      .eq('cohort_id', cohortId)
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })

    return { data: (data ?? []) as CohortChannel[], error }
  }

  /**
   * Tworzy sub-kanał. RLS WITH CHECK wymusza membership + `created_by =
   * auth.uid()`. CHECK constraints walidują slug (regex + reserved 'general'),
   * length(name) oraz `kind` w domkniętym enumie. Duplicat slug → unique
   * violation (caller toast). `kind` defaultuje na `'inne'` (DB ma DEFAULT,
   * powielamy dla jasności w przepływie danych).
   */
  async createChannel(params: {
    cohortId: string
    userId: string
    slug: string
    name: string
    description?: string | null
    kind?: ChannelKind
  }): Promise<{ data: CohortChannel | null; error: PostgrestError | null }> {
    const { data, error } = await supabase
      .from('cohort_channels')
      .insert({
        cohort_id: params.cohortId,
        created_by: params.userId,
        slug: params.slug,
        name: params.name,
        description: params.description ?? null,
        kind: params.kind ?? 'inne',
      })
      .select(CHANNEL_SELECT_FIELDS)
      .single()
    return { data: (data as CohortChannel) ?? null, error }
  }

  /**
   * Patch name/description/kind. Caller już zweryfikował że creator (UI gear
   * tylko dla niego), ale RLS i tak to wymusi.
   */
  async updateChannel(
    channelId: number,
    patch: { name?: string; description?: string | null; kind?: ChannelKind },
  ): Promise<{ data: CohortChannel | null; error: PostgrestError | null }> {
    const update: Partial<CohortChannel> = {}
    if (patch.name !== undefined) update.name = patch.name
    if (patch.description !== undefined) update.description = patch.description
    if (patch.kind !== undefined) update.kind = patch.kind
    const { data, error } = await supabase
      .from('cohort_channels')
      .update(update)
      .eq('id', channelId)
      .select(CHANNEL_SELECT_FIELDS)
      .single()
    return { data: (data as CohortChannel) ?? null, error }
  }

  /** Set `archived_at = NOW()` — UPDATE, RLS gwarantuje że tylko creator. */
  async archiveChannel(channelId: number): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_channels')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', channelId)
    return { error }
  }

  /** Set `archived_at = NULL` (przywróć kanał). */
  async unarchiveChannel(channelId: number): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase
      .from('cohort_channels')
      .update({ archived_at: null })
      .eq('id', channelId)
    return { error }
  }

  /** Realtime na `cohort_channels` (INSERT/UPDATE — archive też UPDATE). */
  subscribeToChannels(
    cohortId: string,
    handlers: {
      onInsert?: (row: CohortChannel) => void
      onUpdate?: (row: CohortChannel) => void
      onDelete?: (row: CohortChannel) => void
    },
    onStatus?: (status: string) => void,
  ): RealtimeChannel {
    const channel = supabase
      .channel(`aula-channels-${cohortId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cohort_channels',
          filter: `cohort_id=eq.${cohortId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            handlers.onInsert?.(payload.new as CohortChannel)
          } else if (payload.eventType === 'UPDATE') {
            handlers.onUpdate?.(payload.new as CohortChannel)
          } else if (payload.eventType === 'DELETE') {
            // RLS odrzuca authenticated DELETE; eventy mogą iść tylko z
            // service-role hard-delete (defensywnie obsługujemy).
            handlers.onDelete?.(payload.old as CohortChannel)
          }
        },
      )
      .subscribe((status) => onStatus?.(status))
    return channel
  }
}

export const CohortService = new CohortServiceImpl()
