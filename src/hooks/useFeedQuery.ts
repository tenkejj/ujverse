/**
 * UJverse — `useFeedQuery`
 *
 * Stale-While-Revalidate cache nad feedem głównej tablicy. Zastępuje 3-fazowy
 * fetch (`posts → likes → comments`) z `App.tsx` jednym wywołaniem RPC
 * `get_feed_snapshot` (patrz `supabase/migrations/20260609130000_feed_snapshot_rpc.sql`).
 *
 * - **Paginacja**: `useInfiniteQuery` z keyset cursorem `(created_at, id)`.
 *   30 postów na stronę; `getNextPageParam` zwraca `nextCursor` z RPC lub
 *   `undefined` (= ostatnia strona).
 * - **Cache**: `staleTime: 30s`, `gcTime: 5min` (z `QueryClient` w
 *   `src/main.tsx`). Drugie wejście na feed = instant render z cache + tichy
 *   refetch w tle.
 * - **Selektory**: hook eksponuje też zderywowane mapy w kształcie wymaganym
 *   przez `FeedView` / `PostCard` (`likesCountByPost`, `likedPostIds`,
 *   `commentsCountByPost`) — eliminują potrzebę osobnego stanu w `App.tsx`.
 */

import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { useMemo } from 'react'

import { PostsAdapter, type FeedCursor, type FeedPage, type FeedPagePost } from '../services/adapters/PostsAdapter'

export const FEED_QUERY_KEY = ['feed'] as const

const FEED_PAGE_SIZE = 30

export type UseFeedQueryResult = {
  posts: FeedPagePost[]
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  commentsCountByPost: Record<string, number>
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  error: Error | null
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  refetch: () => void
}

export function useFeedQuery(viewerId: string | null | undefined): UseFeedQueryResult {
  const query = useInfiniteQuery<FeedPage, Error, InfiniteData<FeedPage, FeedCursor | null>, readonly [string, string | null], FeedCursor | null>({
    queryKey: [FEED_QUERY_KEY[0], viewerId ?? null],
    enabled: Boolean(viewerId),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      return await PostsAdapter.listFeed(pageParam ?? null, FEED_PAGE_SIZE)
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const flatPosts = useMemo<FeedPagePost[]>(() => {
    const pages = query.data?.pages ?? []
    const merged: FeedPagePost[] = []
    const seen = new Set<string>()
    for (const page of pages) {
      for (const p of page.posts) {
        const id = String(p.id ?? '')
        if (!id || seen.has(id)) continue
        seen.add(id)
        merged.push(p)
      }
    }
    return merged
  }, [query.data])

  const { likesCountByPost, likedPostIds, commentsCountByPost } = useMemo(() => {
    const lc: Record<string, number> = {}
    const lp: Record<string, boolean> = {}
    const cc: Record<string, number> = {}
    for (const p of flatPosts) {
      const id = String(p.id ?? '')
      if (!id) continue
      lc[id] = p.likes_count ?? 0
      if (p.is_liked) lp[id] = true
      cc[id] = p.comments_count ?? 0
    }
    return { likesCountByPost: lc, likedPostIds: lp, commentsCountByPost: cc }
  }, [flatPosts])

  return {
    posts: flatPosts,
    likesCountByPost,
    likedPostIds,
    commentsCountByPost,
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error ?? null,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage()
      }
    },
    refetch: () => {
      void query.refetch()
    },
  }
}
