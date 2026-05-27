export type SearchSyncType = 'post' | 'komunikat'

export type SearchSyncTable = 'posts' | 'announcements' | 'profiles'

export type AnnouncementStatus = 'cancelled' | 'remote' | 'duty'

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

export type SearchSyncDocument = SearchContentDocument | SearchUserDocument

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
  lecturer_name?: string | null
  department?: string | null
  source?: string | null
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
}

export type PostProfile = {
  id?: string | null
  full_name?: string | null
  username?: string | null
  department?: string | null
  is_banned?: boolean | null
}

export function documentIdFor(table: SearchSyncTable, rowId: string): string {
  if (table === 'posts') return `post-${rowId}`
  if (table === 'announcements') return `announcement-${rowId}`
  return rowId
}

function normalizeDate(input: unknown): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return new Date().toISOString()
  }
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function parseAnnouncementStatus(value: unknown): AnnouncementStatus | null {
  if (value === 'cancelled' || value === 'remote' || value === 'duty') return value
  return null
}

export function mapAnnouncementToSearchDocument(record: AnnouncementRecord): SearchContentDocument | null {
  const sourceId = String(record.id ?? '').trim()
  const content = record.body?.trim() ?? ''
  const author = record.lecturer_name?.trim() ?? ''
  const status = parseAnnouncementStatus(record.status)
  if (!sourceId || !content || !author || !status) return null

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
    ? record.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
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

export function mapProfileToSearchDocument(record: ProfileRecord): SearchUserDocument | null {
  const id = String(record.id ?? '').trim()
  if (!id) return null
  if (record.is_banned === true) return null

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
