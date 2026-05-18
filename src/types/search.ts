export type SearchContentType = 'post' | 'komunikat'

export type SearchDocument = {
  /** Primary key in index, e.g. `post:42` or `komunikat:uuid`. */
  id: string
  sourceId: string
  type: SearchContentType
  content: string
  author: string
  authorId?: string | null
  department?: string | null
  createdAt: string
}

export type SearchHit = SearchDocument & {
  _formatted?: Partial<Pick<SearchDocument, 'content' | 'author'>>
}
