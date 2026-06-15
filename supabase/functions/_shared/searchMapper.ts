export type SearchSyncType = 'post' | 'komunikat'

export type SearchSyncTable =
  | 'posts'
  | 'announcements'
  | 'cohort_messages'
  | 'cohort_message_attachments'

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
}

/**
 * Dokument indeksu `ujverse_aula` — MIRROR `lib/searchSyncMapper.ts`
 * (Edge variant musi być self-contained, nie używaj node deps).
 */
export type AulaSyncDocument = {
  id: string
  messageId: number
  cohortId: string
  parentId: number | null
  channelId: number | null
  channelSlug: string | null
  channelName: string | null
  channelKind: string | null
  content: string
  authorId: string
  authorName: string
  authorUsername: string | null
  fileNames: string[]
  hasAttachments: boolean
  createdAt: string
  createdAtTs: number
}

export type SearchSyncDocument = SearchContentDocument | AulaSyncDocument

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
   * Pełna treść artykułu z `source_url` (migracja 20260715130000). Mapper
   * preferuje `full_body` nad `body` dla searchable content. Patrz
   * `lib/searchSyncMapper.ts` — Edge function trzymamy w sync.
   */
  full_body?: string | null
  /** Tytuł komunikatu (Liferay/WP) — dodane w migracji 20260715. Null dla ISI. */
  title?: string | null
  lecturer_name?: string | null
  department?: string | null
  created_at?: string | null
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
  return `aula-att-${rowId}`
}

export function aulaDocumentIdForMessage(messageId: number | string): string {
  return documentIdFor('cohort_messages', String(messageId))
}

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

export function mapCohortMessageToSearchDocument(
  record: CohortMessageRecord,
  author: CohortMessageAuthor | null,
  attachments: CohortAttachmentRecord[],
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

export function mapAnnouncementToSearchDocument(record: AnnouncementRecord): SearchContentDocument | null {
  const sourceId = String(record.id ?? '').trim()
  // Preferuj `full_body` (drugi pass scrapera, migracja 20260715130000)
  // — mirror `lib/searchSyncMapper.ts`.
  const fullBody = record.full_body?.trim() ?? ''
  const body = fullBody.length > 0 ? fullBody : record.body?.trim() ?? ''
  const title = record.title?.trim() ?? ''
  const author = record.lecturer_name?.trim() ?? ''
  if (!sourceId || !body || !author) return null

  // Title + body w jednym polu `content` — Meili boostuje match po tytule
  // bez dodawania osobnego pola (mirror logiki w `lib/searchSyncMapper.ts`).
  const content = title.length > 0 && !body.startsWith(title) ? `${title}\n\n${body}` : body

  return {
    id: documentIdFor('announcements', sourceId),
    sourceId,
    type: 'komunikat',
    content,
    author,
    department: record.department?.trim() || null,
    createdAt: normalizeDate(record.created_at),
  }
}

export function mapPostToSearchDocument(
  record: PostRecord,
  profile: PostProfile | null,
): SearchContentDocument | null {
  const sourceId = String(record.id ?? '').trim()
  const content = record.content?.trim() ?? ''
  if (!sourceId || !content) return null
  if (profile?.is_banned === true) return null

  const author = profile?.full_name?.trim()
    || profile?.username?.trim()
    || 'Użytkownik'

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
