export type SearchSyncType = 'post' | 'komunikat'

export type SearchSyncTable = 'posts' | 'announcements'

export type SearchSyncDocument = {
  id: string
  sourceId: string
  type: SearchSyncType
  content: string
  author: string
  authorId?: string | null
  department?: string | null
  createdAt: string
}

export type PostRecord = {
  id: string | number
  content?: string | null
  user_id?: string | null
  created_at?: string | null
}

export type AnnouncementRecord = {
  id: string | number
  body?: string | null
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

export function documentIdFor(table: SearchSyncTable, rowId: string): string {
  return table === 'posts' ? `post:${rowId}` : `komunikat:${rowId}`
}

function normalizeDate(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return new Date().toISOString()
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function mapAnnouncementToSearchDocument(record: AnnouncementRecord): SearchSyncDocument | null {
  const sourceId = String(record.id ?? '').trim()
  const content = record.body?.trim() ?? ''
  const author = record.lecturer_name?.trim() ?? ''
  if (!sourceId || !content || !author) return null

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
): SearchSyncDocument | null {
  const sourceId = String(record.id ?? '').trim()
  const content = record.content?.trim() ?? ''
  if (!sourceId || !content) return null
  if (profile?.is_banned === true) return null

  const author = profile?.full_name?.trim()
    || profile?.username?.trim()
    || 'Użytkownik'

  return {
    id: documentIdFor('posts', sourceId),
    sourceId,
    type: 'post',
    content,
    author,
    authorId: profile?.id ?? record.user_id ?? null,
    department: profile?.department?.trim() || null,
    createdAt: normalizeDate(record.created_at),
  }
}
