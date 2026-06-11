import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'

function stripHtmlMarks(value: string): string {
  return value.replaceAll('<mark>', '').replaceAll('</mark>', '')
}

/**
 * Sanityzuje string z Meili `_formatted` zostawiając WYŁĄCZNIE `<mark>` i
 * `</mark>`. Reszta tagów (np. user content z Markdown content) jest
 * escape'owana — XSS-safe do `dangerouslySetInnerHTML`.
 *
 * Strategia: escape całego inputu, potem przywróć tylko nasze tagi.
 */
export function sanitizeSnippetHtml(raw: string): string {
  // Najpierw escape wszystkich HTML special chars.
  let escaped = raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
  // Następnie przywróć tylko `<mark>` / `</mark>` (już escape'owane jako encje).
  escaped = escaped
    .replaceAll('&lt;mark&gt;', '<mark>')
    .replaceAll('&lt;/mark&gt;', '</mark>')
  return escaped
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

    const tags =
      type === 'post' && Array.isArray(raw.tags)
        ? (raw.tags as unknown[]).filter((t): t is string => typeof t === 'string')
        : undefined

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
      tags,
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

function pickFormattedSnippet(
  formatted: Record<string, string | undefined> | undefined,
  field: string,
): string | null {
  const raw = formatted?.[field]
  if (typeof raw !== 'string' || raw.length === 0) return null
  return sanitizeSnippetHtml(raw)
}

export function normalizeAulaHit(raw: Record<string, unknown>): AulaSearchHit | null {
  const messageIdRaw = raw.messageId
  const messageId =
    typeof messageIdRaw === 'number'
      ? messageIdRaw
      : typeof messageIdRaw === 'string'
        ? Number.parseInt(messageIdRaw, 10)
        : NaN
  if (!Number.isFinite(messageId)) return null

  const cohortId = typeof raw.cohortId === 'string' ? raw.cohortId.trim() : ''
  const authorId = typeof raw.authorId === 'string' ? raw.authorId.trim() : ''
  const content = typeof raw.content === 'string' ? raw.content : ''
  if (!cohortId || !authorId) return null

  const fileNamesRaw = Array.isArray(raw.fileNames) ? raw.fileNames : []
  const fileNames = fileNamesRaw.filter((v): v is string => typeof v === 'string')
  const formatted = raw._formatted as Record<string, string | undefined> | undefined

  // Meili zwraca `fileNames` w `_formatted` jako TABLICĘ stringów (per element),
  // ale przez wrapper z `_formatted: string`. Defensywnie sklej w jeden HTML.
  let fileNamesSnippet: string | null = null
  const fmtFileNames = formatted?.fileNames
  if (typeof fmtFileNames === 'string') {
    fileNamesSnippet = sanitizeSnippetHtml(fmtFileNames)
  } else if (Array.isArray(fmtFileNames)) {
    const joined = (fmtFileNames as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .join(', ')
    fileNamesSnippet = joined.length > 0 ? sanitizeSnippetHtml(joined) : null
  }

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  const createdAtTsRaw = raw.createdAtTs
  const createdAtTs =
    typeof createdAtTsRaw === 'number'
      ? createdAtTsRaw
      : Math.floor(new Date(createdAt).getTime() / 1000)

  const channelIdRaw = raw.channelId
  const channelId =
    typeof channelIdRaw === 'number'
      ? channelIdRaw
      : channelIdRaw == null
        ? null
        : (() => {
            const n = Number(channelIdRaw)
            return Number.isFinite(n) ? n : null
          })()
  const channelSlug =
    typeof raw.channelSlug === 'string' ? raw.channelSlug.trim() || null : null
  const channelName =
    typeof raw.channelName === 'string' ? raw.channelName.trim() || null : null
  const channelKind =
    typeof raw.channelKind === 'string' ? raw.channelKind.trim() || null : null

  return {
    id: typeof raw.id === 'string' ? raw.id : `aula-msg-${messageId}`,
    messageId,
    cohortId,
    parentId:
      typeof raw.parentId === 'number'
        ? raw.parentId
        : raw.parentId == null
          ? null
          : Number(raw.parentId),
    channelId,
    channelSlug,
    channelName,
    channelKind,
    content,
    authorId,
    authorName: typeof raw.authorName === 'string' ? raw.authorName : 'Użytkownik',
    authorUsername: typeof raw.authorUsername === 'string' ? raw.authorUsername : null,
    fileNames,
    hasAttachments: Boolean(raw.hasAttachments),
    createdAt,
    createdAtTs,
    contentSnippetHTML: pickFormattedSnippet(formatted, 'content'),
    fileNamesSnippetHTML: fileNamesSnippet,
  }
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
