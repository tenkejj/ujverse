/**
 * Wyszukiwanie w Supabase, gdy Meilisearch nie odpowiada.
 *
 * Host produkcyjny (Railway) po przerwie zwraca „Application not found",
 * a przeglądarka dostaje failed `POST /multi-search`. Indeks był lustrem
 * postów, komunikatów, profili i Auli — te same tabele są w Postgresie
 * i mają RLS na odczyt dla zalogowanych.
 */
import { supabase } from '../supabaseClient'
import { escapeIlikePattern } from '../lib/eventRow'
import type { AulaSearchHit, SearchHit, SearchUserHit } from '../types/search'
import type { AulaSearchOpts, UnifiedSearchOpts, UnifiedSearchResults, AulaSearchResults } from './SearchService'

function ilikePattern(raw: string): string {
  return `%${escapeIlikePattern(raw.replaceAll(',', ' '))}%`
}

function orIlike(columns: readonly string[], raw: string): string {
  const pattern = ilikePattern(raw)
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',')
}

function snippet(text: string, limit = 280): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit).trimEnd()}…`
}

type ProfileEmbed = {
  id?: string
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  department?: string | null
}

function oneProfile(value: unknown): ProfileEmbed | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object' ? (first as ProfileEmbed) : null
  }
  return value as ProfileEmbed
}

export async function searchUnifiedFallback(
  query: string,
  opts: UnifiedSearchOpts | undefined,
  tagFilter: string | null,
  textQuery: string,
): Promise<UnifiedSearchResults> {
  const limit = opts?.limit ?? 24
  const includeContent = opts?.includeContent !== false
  const includeUsers = tagFilter ? false : opts?.includeUsers !== false
  const contentQuery = tagFilter && !textQuery ? '' : textQuery || query.trim()

  const [content, users] = await Promise.all([
    includeContent
      ? searchContentFallback(contentQuery, tagFilter, limit, opts?.signal)
      : Promise.resolve([]),
    includeUsers
      ? searchUsersFallback(query.trim(), limit, opts?.userDepartmentFilter, opts?.signal)
      : Promise.resolve([]),
  ])

  return { content, users }
}

async function searchContentFallback(
  textQuery: string,
  tagFilter: string | null,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const [posts, announcements] = await Promise.all([
    searchPostsFallback(textQuery, tagFilter, limit, signal),
    tagFilter ? Promise.resolve([]) : searchAnnouncementsFallback(textQuery, limit, signal),
  ])
  return [...announcements, ...posts].slice(0, limit)
}

async function searchPostsFallback(
  textQuery: string,
  tagFilter: string | null,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  let query = supabase
    .from('posts')
    .select('id, content, user_id, created_at, tags, profiles(id, full_name, username, department)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (textQuery.trim().length >= 2) {
    query = query.ilike('content', ilikePattern(textQuery))
  }
  if (tagFilter) {
    query = query.contains('tags', [tagFilter])
  }
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) {
    console.warn('[searchFallback] posts', error.message)
    return []
  }

  return (data ?? []).flatMap((row) => {
    const record = row as {
      id: number | string
      content?: string | null
      user_id?: string | null
      created_at?: string | null
      tags?: string[] | null
      profiles?: unknown
    }
    const body = typeof record.content === 'string' ? record.content : ''
    if (!body.trim() && !tagFilter) return []
    const profile = oneProfile(record.profiles)
    const author = profile?.full_name?.trim() || profile?.username?.trim() || 'Użytkownik'
    const tags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string')
      : undefined
    const hit: SearchHit = {
      id: `post-${record.id}`,
      sourceId: String(record.id),
      type: 'post',
      content: snippet(body),
      author,
      authorId: profile?.id ?? record.user_id ?? null,
      department: profile?.department ?? null,
      createdAt: record.created_at ?? new Date().toISOString(),
      tags,
    }
    return [hit]
  })
}

async function searchAnnouncementsFallback(
  textQuery: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  if (textQuery.trim().length < 2) return []

  let query = supabase
    .from('announcements')
    .select('id, title, body, lecturer_name, department, source, status, created_at')
    .or(orIlike(['title', 'body', 'lecturer_name'], textQuery))
    .order('created_at', { ascending: false })
    .limit(limit)
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) {
    console.warn('[searchFallback] announcements', error.message)
    return []
  }

  return (data ?? []).flatMap((row) => {
    const record = row as {
      id: string
      title?: string | null
      body?: string | null
      lecturer_name?: string | null
      department?: string | null
      source?: string | null
      status?: string | null
      created_at?: string | null
    }
    const title = record.title?.trim() ?? ''
    const body = record.body?.trim() ?? ''
    const author = record.lecturer_name?.trim() || 'Komunikat'
    const content = snippet([title, body].filter(Boolean).join(' — '))
    if (!content) return []
    const status =
      record.status === 'cancelled' || record.status === 'remote' || record.status === 'duty'
        ? record.status
        : undefined
    const hit: SearchHit = {
      id: `announcement-${record.id}`,
      sourceId: record.id,
      type: 'komunikat',
      content,
      author,
      authorId: null,
      department: record.department ?? null,
      createdAt: record.created_at ?? new Date().toISOString(),
      announcementStatus: status,
      announcementSource: record.source ?? null,
    }
    return [hit]
  })
}

async function searchUsersFallback(
  textQuery: string,
  limit: number,
  department: string | undefined,
  signal?: AbortSignal,
): Promise<SearchUserHit[]> {
  if (textQuery.trim().length < 2) return []

  let query = supabase
    .from('profiles')
    .select('id, username, full_name, department, avatar_url')
    .or(orIlike(['full_name', 'username'], textQuery))
    .limit(limit)
  if (department?.trim()) {
    query = query.eq('department', department.trim())
  }
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query
  if (error) {
    console.warn('[searchFallback] profiles', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const record = row as {
      id: string
      username?: string | null
      full_name?: string | null
      department?: string | null
      avatar_url?: string | null
    }
    return {
      id: record.id,
      username: record.username ?? null,
      fullName: record.full_name ?? null,
      department: record.department ?? null,
      avatarUrl: record.avatar_url ?? null,
    }
  })
}

export async function searchAulaFallback(
  query: string,
  opts: AulaSearchOpts,
): Promise<AulaSearchResults> {
  const cohortId = opts.cohortId.trim()
  const trimmed = query.trim()
  if (!cohortId || trimmed.length === 0) {
    return { hits: [], estimatedTotalHits: 0 }
  }

  const limit = opts.limit ?? 20
  const offset = Number.isFinite(opts.offset) ? Math.max(0, Math.floor(opts.offset ?? 0)) : 0
  const attachmentEmbed = opts.hasAttachments
    ? 'cohort_message_attachments!inner(file_name)'
    : 'cohort_message_attachments(file_name)'

  let request = supabase
    .from('cohort_messages')
    .select(
      `id, cohort_id, user_id, content, parent_id, channel_id, created_at, profiles!cohort_messages_user_id_fkey(id, full_name, username), ${attachmentEmbed}`,
      { count: 'exact' },
    )
    .eq('cohort_id', cohortId)
    .is('deleted_at', null)
    .ilike('content', ilikePattern(trimmed))
    .order('created_at', { ascending: false })
    .range(offset, offset + Math.max(limit, 1) - 1)

  if (opts.authorId) request = request.eq('user_id', opts.authorId)
  if (opts.channelId === null) request = request.is('channel_id', null)
  else if (typeof opts.channelId === 'number') request = request.eq('channel_id', opts.channelId)
  else if (Array.isArray(opts.channelKinds) && opts.channelKinds.length > 0) {
    let channelsQuery = supabase
      .from('cohort_channels')
      .select('id')
      .eq('cohort_id', cohortId)
      .in('kind', opts.channelKinds)
    if (opts.signal) channelsQuery = channelsQuery.abortSignal(opts.signal)
    const { data: channels, error: channelError } = await channelsQuery
    if (channelError) {
      console.warn('[searchFallback] aula channels', channelError.message)
      return { hits: [], estimatedTotalHits: 0 }
    }
    const ids = (channels ?? [])
      .map((row) => (row as { id?: number }).id)
      .filter((id): id is number => typeof id === 'number')
    if (ids.length === 0) return { hits: [], estimatedTotalHits: 0 }
    request = request.in('channel_id', ids)
  }
  if (typeof opts.since === 'number' && Number.isFinite(opts.since)) {
    request = request.gte('created_at', new Date(opts.since * 1000).toISOString())
  }
  if (opts.signal) request = request.abortSignal(opts.signal)

  const { data, error, count } = await request
  if (error) {
    console.warn('[searchFallback] aula', error.message)
    return { hits: [], estimatedTotalHits: 0 }
  }

  const hits: AulaSearchHit[] = (data ?? []).flatMap((row) => {
    const record = row as {
      id: number
      cohort_id: string
      user_id: string
      content?: string | null
      parent_id?: number | null
      channel_id?: number | null
      created_at?: string | null
      profiles?: unknown
      cohort_message_attachments?: unknown
    }
    const profile = oneProfile(record.profiles)
    const content = typeof record.content === 'string' ? record.content : ''
    const createdAt = record.created_at ?? new Date().toISOString()
    const fileNames = attachmentNames(record.cohort_message_attachments)
    const hit: AulaSearchHit = {
      id: String(record.id),
      messageId: record.id,
      cohortId: record.cohort_id,
      parentId: record.parent_id ?? null,
      channelId: record.channel_id ?? null,
      channelSlug: null,
      channelName: null,
      channelKind: null,
      content: snippet(content, 400),
      authorId: record.user_id,
      authorName: profile?.full_name?.trim() || 'Użytkownik',
      authorUsername: profile?.username ?? null,
      fileNames,
      hasAttachments: fileNames.length > 0,
      createdAt,
      createdAtTs: Math.floor(new Date(createdAt).getTime() / 1000),
      contentSnippetHTML: null,
      fileNamesSnippetHTML: null,
    }
    return [hit]
  })

  return { hits, estimatedTotalHits: typeof count === 'number' ? count : hits.length }
}

function attachmentNames(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : value ? [value] : []
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object' || !('file_name' in row)) return []
    const name = (row as { file_name?: unknown }).file_name
    return typeof name === 'string' && name.trim() ? [name] : []
  })
}
