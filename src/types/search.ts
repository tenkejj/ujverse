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
