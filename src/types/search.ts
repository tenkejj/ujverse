import type { AnnouncementStatus } from './content'

export type SearchContentType = 'post' | 'komunikat'

export type SearchDocument = {
  /** Primary key in index, e.g. `post-42` or `announcement-uuid`. */
  id: string
  sourceId: string
  type: SearchContentType
  content: string
  author: string
  authorId?: string | null
  department?: string | null
  createdAt: string
  /** Tylko dla `type === 'komunikat'` — badge DYŻUR / ZDALNE / odwołane. */
  announcementStatus?: AnnouncementStatus
  announcementSource?: string | null
  /** Smart Tags — tylko dla `type === 'post'`. */
  tags?: string[]
}

export type SearchHit = SearchDocument & {
  _formatted?: Partial<Pick<SearchDocument, 'content' | 'author'>>
}

export type SearchUserDocument = {
  id: string
  username: string | null
  fullName: string | null
  department: string | null
  avatarUrl: string | null
}

export type SearchUserHit = SearchUserDocument

/** Dokument `ujverse_aula` po stronie klienta (z opcjonalnym `_formatted`). */
export type AulaSearchDocument = {
  id: string
  messageId: number
  cohortId: string
  parentId: number | null
  /** Sub-channel. `null` = virtual Sala główna. */
  channelId: number | null
  channelSlug: string | null
  channelName: string | null
  /**
   * Typ zajęć sali (`wyk` / `cw` / `lab` / `sem` / `proj` / `inne`).
   * `null` = Sala główna. `unknown string` z legacy dokumentów → traktować
   * jako `inne` w UI badge fallback.
   */
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

export type AulaSearchHit = AulaSearchDocument & {
  /**
   * Sanityzowane HTML-snippety zawierające tylko `<mark>` (XSS-safe).
   * `null` gdy Meili nie zwrócił `_formatted` dla danego pola.
   */
  contentSnippetHTML: string | null
  fileNamesSnippetHTML: string | null
}
