export type SearchSyncType = 'post' | 'komunikat'

export type SearchSyncTable =
  | 'posts'
  | 'announcements'
  | 'profiles'
  | 'cohort_messages'
  | 'cohort_message_attachments'

/**
 * Status komunikatu — union 1:1 z `AnnouncementStatus` w `src/types/content.ts`
 * (po migracji 20260715). `info` / `event` przychodzą z komunikatów
 * wydziałowych (Liferay/WP), `cancelled` / `remote` / `duty` z ISI Drupal.
 */
export type AnnouncementStatus = 'cancelled' | 'remote' | 'duty' | 'info' | 'event'

export type SearchContentDocument = {
  id: string
  sourceId: string
  type: SearchSyncType
  content: string
  author: string
  authorId?: string | null
  department?: string | null
  createdAt: string
  tags?: string[]
  announcementStatus?: AnnouncementStatus
  announcementSource?: string | null
}

export type SearchUserDocument = {
  id: string
  username: string | null
  fullName: string | null
  department: string | null
  avatarUrl: string | null
}

/**
 * Dokument indeksu `ujverse_aula`. `cohortId` jest MANDATORY do izolacji
 * rocznika — bez tego filtra w `SearchService.searchAula` user zobaczyłby
 * wiadomości cudzych roczników (Meili public key nie ma RLS).
 */
export type AulaSyncDocument = {
  id: string                  // "aula-msg-<cohort_messages.id>" (Meili primary key)
  messageId: number
  cohortId: string
  parentId: number | null
  /**
   * Sub-channel kontekst. `null` = virtual #general (wiadomości z
   * `channel_id IS NULL`).
   */
  channelId: number | null
  channelSlug: string | null  // null = Sala główna
  channelName: string | null  // null = Sala główna (UI renderuje fallback)
  /**
   * Typ zajęć sali (`wyk` / `cw` / `lab` / `sem` / `proj` / `inne`).
   * `null` = Sala główna (virtual, brak rekordu w `cohort_channels`).
   */
  channelKind: string | null
  content: string
  authorId: string
  authorName: string          // full_name || username || 'Użytkownik'
  authorUsername: string | null
  fileNames: string[]         // ['notes.pdf', 'screenshot.png']
  hasAttachments: boolean
  createdAt: string           // ISO 8601
  createdAtTs: number         // unix seconds — sortable + range filter
}

export type SearchSyncDocument =
  | SearchContentDocument
  | SearchUserDocument
  | AulaSyncDocument

export type PostRecord = {
  id: string | number
  content?: string | null
  tags?: string[] | null
  user_id?: string | null
  created_at?: string | null
}

export type AnnouncementRecord = {
  id: string | number
  body?: string | null
  /**
   * Pełna treść artykułu z `source_url` (migracja 20260715130000). Drugi pass
   * scrapera wypełnia po pobraniu podstrony Liferay/WP CM. Mapper preferuje
   * `full_body` nad `body` dla searchable content — Meili indeksuje bogatszą
   * treść, większe pokrycie zapytań użytkowników.
   */
  full_body?: string | null
  /** Tytuł komunikatu (Liferay/WP). Null dla ISI Drupal lecturer-blocks. */
  title?: string | null
  lecturer_name?: string | null
  department?: string | null
  source?: string | null
  source_kind?: string | null
  /** Deep-link do oryginalnego ogłoszenia (Liferay/WP). Null dla ISI. */
  source_url?: string | null
  status?: string | null
  created_at?: string | null
}

export type ProfileRecord = {
  id: string
  username?: string | null
  full_name?: string | null
  department?: string | null
  avatar_url?: string | null
  is_banned?: boolean | null
  /** Gdy `false`, profil NIE trafia do Meili (sync-search zwraca `null` → DELETE). */
  is_searchable?: boolean | null
}

export type PostProfile = {
  id?: string | null
  full_name?: string | null
  username?: string | null
  department?: string | null
  is_banned?: boolean | null
}

export type CohortMessageRecord = {
  id: string | number
  cohort_id?: string | null
  user_id?: string | null
  parent_id?: number | null
  channel_id?: number | null
  content?: string | null
  created_at?: string | null
  deleted_at?: string | null
}

export type CohortChannelRecord = {
  id: number
  slug?: string | null
  name?: string | null
  kind?: string | null
}

export type CohortAttachmentRecord = {
  id: string | number
  message_id?: number | null
  file_name?: string | null
}

export type CohortMessageAuthor = {
  id?: string | null
  full_name?: string | null
  username?: string | null
  is_banned?: boolean | null
}

export function documentIdFor(table: SearchSyncTable, rowId: string): string {
  if (table === 'posts') return `post-${rowId}`
  if (table === 'announcements') return `announcement-${rowId}`
  if (table === 'cohort_messages') return `aula-msg-${rowId}`
  // cohort_message_attachments NIE ma własnego dokumentu — re-indexuje parent
  // message. Wartość tu zwracana nie powinna być nigdy używana, ale defensywnie:
  if (table === 'cohort_message_attachments') return `aula-att-${rowId}`
  return rowId
}

export function aulaDocumentIdForMessage(messageId: number | string): string {
  return documentIdFor('cohort_messages', String(messageId))
}

/** Webhook decyzja: czy DELETE z indeksu zamiast UPSERT? */
export function shouldDeleteFromAulaIndex(record: CohortMessageRecord): boolean {
  return record.deleted_at != null
}

function normalizeDate(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return new Date().toISOString()
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

const VALID_ANNOUNCEMENT_STATUSES: ReadonlySet<AnnouncementStatus> = new Set([
  'cancelled',
  'remote',
  'duty',
  'info',
  'event',
])

function parseAnnouncementStatus(value: unknown): AnnouncementStatus | null {
  if (typeof value === 'string' && VALID_ANNOUNCEMENT_STATUSES.has(value as AnnouncementStatus)) {
    return value as AnnouncementStatus
  }
  return null
}

/**
 * Mapuje rekord `announcements` na dokument Meilisearch.
 *
 * Po migracji 20260715 (multi-faculty) komunikaty mają `title` (Liferay/WP)
 * lub null (ISI Drupal). Tytuł doklejamy do `content` z prefixem żeby Meili
 * potraktował go jako część searchable text — dzięki temu wyszukiwarka
 * znajduje komunikat po tytule (np. „stypendium socjalne") nawet jeśli
 * w body nie ma tego frazy.
 */
export function mapAnnouncementToSearchDocument(record: AnnouncementRecord): SearchContentDocument | null {
  const sourceId = String(record.id ?? '').trim()
  // Preferuj `full_body` (drugi pass scrapera, migracja 20260715130000).
  // Listings excerpt (body) zostaje w bazie jako fingerprint source, ale
  // do indeksu lecimy z bogatszą treścią dla lepszego recall'a.
  const fullBody = record.full_body?.trim() ?? ''
  const body = fullBody.length > 0 ? fullBody : record.body?.trim() ?? ''
  const title = record.title?.trim() ?? ''
  const author = record.lecturer_name?.trim() ?? ''
  const status = parseAnnouncementStatus(record.status)
  if (!sourceId || !body || !author || !status) return null

  // Title + body w jednym polu `content` — pozwala Meili match'ować po
  // tytule bez dodawania osobnego pola (zachowujemy backward-compat
  // ze schemą indeksu sprzed 2026-07-15).
  const content = title.length > 0 && !body.startsWith(title) ? `${title}\n\n${body}` : body

  return {
    id: documentIdFor('announcements', sourceId),
    sourceId,
    type: 'komunikat',
    content,
    author,
    department: record.department?.trim() || null,
    createdAt: normalizeDate(record.created_at),
    announcementStatus: status,
    announcementSource: record.source?.trim() || null,
  }
}

export function mapPostToSearchDocument(record: PostRecord, profile: PostProfile | null): SearchContentDocument | null {
  const sourceId = String(record.id ?? '').trim()
  const content = record.content?.trim() ?? ''
  if (!sourceId || !content) return null
  if (profile?.is_banned === true) return null

  const author = profile?.full_name?.trim() || profile?.username?.trim() || 'Użytkownik'

  const tags = Array.isArray(record.tags)
    ? record.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    : []

  return {
    id: documentIdFor('posts', sourceId),
    sourceId,
    type: 'post',
    content,
    author,
    authorId: profile?.id ?? record.user_id ?? null,
    department: profile?.department?.trim() || null,
    createdAt: normalizeDate(record.created_at),
    tags,
  }
}

export function mapCohortMessageToSearchDocument(
  record: CohortMessageRecord,
  author: CohortMessageAuthor | null,
  attachments: CohortAttachmentRecord[],
  /**
   * Channel metadata fetched przez webhook. `null` reprezentuje #general
   * (virtual — nie ma rekordu w `cohort_channels`). Caller jest
   * odpowiedzialny za fetch przy `channel_id IS NOT NULL`.
   */
  channel: CohortChannelRecord | null = null,
): AulaSyncDocument | null {
  const sourceId = String(record.id ?? '').trim()
  if (!sourceId) return null
  if (shouldDeleteFromAulaIndex(record)) return null
  if (author?.is_banned === true) return null

  const cohortId = typeof record.cohort_id === 'string' ? record.cohort_id.trim() : ''
  const authorId = typeof record.user_id === 'string' ? record.user_id.trim() : ''
  if (!cohortId || !authorId) return null

  const content = record.content?.trim() ?? ''
  const fileNames = attachments
    .map((a) => (typeof a.file_name === 'string' ? a.file_name.trim() : ''))
    .filter((name): name is string => name.length > 0)

  // Wiadomość pusta (np. tylko atachmenty + brak treści) NADAL idzie do indeksu,
  // żeby można było wyszukać po nazwie pliku.
  if (!content && fileNames.length === 0) return null

  const authorName =
    author?.full_name?.trim() || author?.username?.trim() || 'Użytkownik'
  const createdAtIso = normalizeDate(record.created_at)
  const createdAtTs = Math.floor(new Date(createdAtIso).getTime() / 1000)

  const rawChannelId = record.channel_id == null ? null : Number(record.channel_id)
  const channelId = Number.isFinite(rawChannelId as number) ? rawChannelId : null
  const channelSlug = channelId == null ? null : channel?.slug?.trim() || null
  const channelName = channelId == null ? null : channel?.name?.trim() || null
  const channelKind = channelId == null ? null : channel?.kind?.trim() || null

  return {
    id: aulaDocumentIdForMessage(sourceId),
    messageId: Number(sourceId),
    cohortId,
    parentId: record.parent_id ?? null,
    channelId,
    channelSlug,
    channelName,
    channelKind,
    content,
    authorId,
    authorName,
    authorUsername: author?.username?.trim() || null,
    fileNames,
    hasAttachments: fileNames.length > 0,
    createdAt: createdAtIso,
    createdAtTs,
  }
}

export function mapProfileToSearchDocument(record: ProfileRecord): SearchUserDocument | null {
  const id = String(record.id ?? '').trim()
  if (!id) return null
  if (record.is_banned === true) return null
  // Eksplicytne `false` — uszanuj prywatność. Brak wartości = traktuj jak `true`
  // (kompatybilność wsteczna z wierszami sprzed migracji).
  if (record.is_searchable === false) return null

  const username = record.username?.trim() || null
  const fullName = record.full_name?.trim() || null
  if (!username && !fullName) return null

  return {
    id,
    username,
    fullName,
    department: record.department?.trim() || null,
    avatarUrl: record.avatar_url?.trim() || null,
  }
}
