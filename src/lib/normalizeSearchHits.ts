import { normalizePostTags } from './postTags'
import type { SearchHit, SearchUserHit } from '../types/search'

function stripHtmlMarks(value: string): string {
  return value.replaceAll('<mark>', '').replaceAll('</mark>', '')
}

function pickFormatted(
  formatted: Record<string, string | undefined> | undefined,
  field: string,
  fallback: string,
): string {
  const raw = formatted?.[field]
  return raw ? stripHtmlMarks(raw) : fallback
}

/** Maps heterogeneous index documents to the unified SearchHit shape. */
export function normalizeContentHit(raw: Record<string, unknown>): SearchHit | null {
  const formatted = raw._formatted as Record<string, string | undefined> | undefined

  if (typeof raw.sourceId === 'string' && typeof raw.type === 'string' && typeof raw.content === 'string') {
    const type = raw.type === 'komunikat' ? 'komunikat' : 'post'
    const idPrefix = type === 'komunikat' ? 'announcement' : 'post'
    const content = pickFormatted(formatted, 'content', raw.content)
    const author = pickFormatted(formatted, 'author', typeof raw.author === 'string' ? raw.author : '')
    const announcementStatus =
      raw.announcementStatus === 'cancelled' ||
      raw.announcementStatus === 'remote' ||
      raw.announcementStatus === 'duty'
        ? raw.announcementStatus
        : undefined

    const tags = type === 'post' ? normalizePostTags(raw.tags) : undefined

    return {
      id: String(raw.id ?? `${idPrefix}-${raw.sourceId}`),
      sourceId: raw.sourceId,
      type,
      content,
      author,
      authorId: typeof raw.authorId === 'string' ? raw.authorId : null,
      department: typeof raw.department === 'string' ? raw.department : null,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      announcementStatus,
      announcementSource:
        typeof raw.announcementSource === 'string' ? raw.announcementSource : null,
      ...(tags && tags.length > 0 ? { tags } : {}),
      _formatted: formatted
        ? { content: formatted.content, author: formatted.author }
        : undefined,
    }
  }

  const legacyContent = typeof raw.content === 'string' ? raw.content.trim() : ''
  const legacyTitle = typeof raw.title === 'string' ? raw.title.trim() : ''
  const legacyAuthor = typeof raw.author === 'string' ? raw.author.trim() : ''
  const rawId = raw.id != null ? String(raw.id) : ''

  if (rawId && (legacyContent || legacyTitle)) {
    const sourceId = rawId.startsWith('post-')
      ? rawId.slice(5)
      : rawId.replace(/^post_/, '')
    const content = legacyContent || legacyTitle
    return {
      id: rawId.startsWith('post-') ? rawId : `post-${sourceId}`,
      sourceId,
      type: 'post',
      content: pickFormatted(formatted, 'content', content),
      author: pickFormatted(formatted, 'author', legacyAuthor || 'Użytkownik'),
      authorId: null,
      department: typeof raw.department === 'string' ? raw.department : null,
      createdAt: new Date().toISOString(),
      _formatted: formatted
        ? { content: formatted.content, author: formatted.author }
        : undefined,
    }
  }

  if (raw.kind === 'post' && rawId) {
    const sourceId = rawId.replace(/^post-/, '')
    const content =
      (typeof raw.content === 'string' ? raw.content.trim() : '') ||
      legacyTitle ||
      legacyContent
    if (!content) return null
    return {
      id: `post-${sourceId}`,
      sourceId,
      type: 'post',
      content: pickFormatted(formatted, 'content', content),
      author: pickFormatted(formatted, 'author', legacyAuthor || 'Użytkownik'),
      authorId: typeof raw.user_id === 'string' ? raw.user_id : null,
      department: null,
      createdAt:
        typeof raw.created_at === 'string'
          ? raw.created_at
          : typeof raw.created_at === 'number'
            ? new Date(raw.created_at).toISOString()
            : new Date().toISOString(),
      _formatted: formatted
        ? { content: formatted.content, author: formatted.author }
        : undefined,
    }
  }

  return null
}

function pickFormattedUserField(
  formatted: Record<string, string | undefined> | undefined,
  field: string,
  fallback: string | null,
): string | null {
  const raw = formatted?.[field]
  if (!raw) return fallback
  const stripped = stripHtmlMarks(raw).trim()
  return stripped || fallback
}

export function normalizeUserHit(raw: Record<string, unknown>): SearchUserHit | null {
  const id = raw.id != null ? String(raw.id).trim() : ''
  if (!id) return null

  const formatted = raw._formatted as Record<string, string | undefined> | undefined

  const username =
    typeof raw.username === 'string'
      ? raw.username.trim() || null
      : pickFormattedUserField(formatted, 'username', null)
  const fullName =
    typeof raw.fullName === 'string'
      ? raw.fullName.trim() || null
      : typeof raw.full_name === 'string'
        ? raw.full_name.trim() || null
        : pickFormattedUserField(formatted, 'fullName', null) ??
          pickFormattedUserField(formatted, 'full_name', null)

  if (!username && !fullName) return null

  return {
    id,
    username,
    fullName,
    department: typeof raw.department === 'string' ? raw.department.trim() || null : null,
    avatarUrl:
      typeof raw.avatarUrl === 'string'
        ? raw.avatarUrl.trim() || null
        : typeof raw.avatar_url === 'string'
          ? raw.avatar_url.trim() || null
          : null,
  }
}
