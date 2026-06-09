/**
 * UJverse — feed mutations on top of React Query cache.
 *
 * Optymistyczne mutacje (`toggleLike`, `removePost`) patch'ujące cache
 * `['feed', viewerId]` z `useFeedQuery`. Filozofia:
 *
 * - `onMutate`: snapshot poprzedniego stanu + lokalny patch przez
 *   `queryClient.setQueryData` → UI reaguje w 0ms, bez czekania na Supabase.
 * - `onError`: rollback do snapshotu, plus toast/log.
 * - `onSettled`: `invalidateQueries` po krótkim debounce, żeby zsynchronizować
 *   licznik z ground truth (np. gdy ktoś inny w tym samym momencie też
 *   polubił). Świadomie nie inwalidujemy natychmiast — to zniszczyłoby
 *   optymistyczny UX przy szybkich kliknięciach.
 *
 * Tworzenie posta jest robione przez `PostService.createPost` w App.tsx
 * (uses storage upload) — tu eksponujemy tylko `invalidateFeed()` jako
 * post-hook do wywołania po sukcesie createPost.
 */

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'

import { supabase } from '../supabaseClient'
import { FEED_QUERY_KEY } from './useFeedQuery'
import type { FeedCursor, FeedPage, FeedPagePost } from '../services/adapters/PostsAdapter'

type FeedCache = InfiniteData<FeedPage, FeedCursor | null>

/**
 * Porównanie ID idzie zawsze przez `String()` po OBU stronach. Powód:
 * RPC `get_feed_snapshot` zwraca `id` jako liczbę (88), a kliki z PostCard
 * przekazują `postId` (może być number lub string zależnie od ścieżki).
 * `String(p.id) === postId` z postId=number zwracał false (typowy bug
 * "patch nigdy nie trafia w post"). Tu wymuszam konsystencję.
 */
function samePostId(a: unknown, b: unknown): boolean {
  return String(a ?? '') === String(b ?? '')
}

function patchPost(
  cache: FeedCache | undefined,
  postId: string,
  patch: (p: FeedPagePost) => FeedPagePost,
): FeedCache | undefined {
  if (!cache) return cache
  const pages = cache.pages.map((page) => ({
    ...page,
    posts: page.posts.map((p) => (samePostId(p.id, postId) ? patch(p) : p)),
  }))
  return { ...cache, pages }
}

function removePostFromCache(cache: FeedCache | undefined, postId: string): FeedCache | undefined {
  if (!cache) return cache
  const pages = cache.pages.map((page) => ({
    ...page,
    posts: page.posts.filter((p) => !samePostId(p.id, postId)),
  }))
  return { ...cache, pages }
}

export function useFeedMutations(viewerId: string | null | undefined) {
  const queryClient = useQueryClient()
  const queryKey = [FEED_QUERY_KEY[0], viewerId ?? null] as const

  const invalidateFeed = () => {
    void queryClient.invalidateQueries({ queryKey: [FEED_QUERY_KEY[0]] })
  }

  const toggleLike = useMutation({
    mutationFn: async ({
      postId,
      currentlyLiked,
    }: {
      postId: string
      currentlyLiked: boolean
    }) => {
      if (!viewerId) throw new Error('Brak sesji.')
      if (currentlyLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', Number(postId))
          .eq('user_id', viewerId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('likes')
          .insert([{ post_id: Number(postId), user_id: viewerId }])
        if (error) throw error
      }
    },
    onMutate: async ({ postId, currentlyLiked }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<FeedCache>(queryKey)
      queryClient.setQueryData<FeedCache>(queryKey, (cache) =>
        patchPost(cache, postId, (p) => ({
          ...p,
          is_liked: !currentlyLiked,
          likes_count: Math.max(0, (p.likes_count ?? 0) + (currentlyLiked ? -1 : 1)),
        })),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
  })

  const removePost = useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      const { error } = await supabase.from('posts').delete().eq('id', Number(postId))
      if (error) throw error
    },
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<FeedCache>(queryKey)
      queryClient.setQueryData<FeedCache>(queryKey, (cache) => removePostFromCache(cache, postId))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
    onSuccess: () => invalidateFeed(),
  })

  /** Lokalny patch licznika komentarzy — np. po `submitComment`, `delete`, lub Realtime INSERT. */
  const updateCommentsCount = (postId: string, updater: (current: number) => number) => {
    queryClient.setQueryData<FeedCache>(queryKey, (cache) =>
      patchPost(cache, postId, (p) => ({
        ...p,
        comments_count: Math.max(0, updater(p.comments_count ?? 0)),
      })),
    )
  }

  return {
    toggleLike,
    removePost,
    invalidateFeed,
    updateCommentsCount,
  }
}
