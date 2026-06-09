import { supabase } from '../../supabaseClient'
import { UjverseSanitizer } from '../../lib/sanitizer'
import type { Post, Profile } from '../../types'
import type { PostMeta, UnifiedContent } from '../../types/content'
import type { ContentAdapter } from './BaseAdapter'

export type PostEnrichment = {
  likeCount: number
  commentCount: number
  isLiked: boolean
}

export type FeedCursor = {
  createdAt: string
  id: number
}

export type FeedPagePost = Post & {
  likes_count: number
  comments_count: number
  is_liked: boolean
}

export type FeedPage = {
  posts: FeedPagePost[]
  nextCursor: FeedCursor | null
}

/**
 * Adapter postów z feedu.
 *
 * Posty mają stan (likes/comments) zarządzany poza samym rekordem — adapter
 * `toUnified` przyjmuje więc enrichment jako drugi argument. Zachowujemy proste
 * mapowanie pól: sanitizer czyści tylko `body` (treść posta) i nazwę autora.
 */
class PostsAdapterImpl implements ContentAdapter<Post, PostMeta> {
  readonly type = 'post' as const

  private mapPost(row: Post): Post {
    return {
      ...row,
      image_url: typeof row.image_url === 'string' ? row.image_url : null,
    }
  }

  toUnified(raw: Post, enrichment?: PostEnrichment): UnifiedContent<PostMeta> | null {
    if (!raw.id) return null
    const profile: Profile | null = raw.profiles ?? null
    const displayName = UjverseSanitizer.cleanAuthor(
      profile?.full_name ?? 'Użytkownik',
    ) || 'Użytkownik'

    const body = UjverseSanitizer.cleanBody(raw.content ?? '')
    // Brak `show_department` w profilu (np. dane sprzed migracji) traktujemy
    // jako domyślne `true` — wstecznie kompatybilnie. Eksplicytne `false`
    // ukrywa badge wydziału przy postach autora.
    const department =
      profile?.show_department === false ? null : (profile?.department ?? null)

    const rawTags = raw.tags ?? []
    const tags = Array.isArray(rawTags)
      ? rawTags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
      : []

    return {
      id: raw.id,
      type: 'post',
      title: '',
      author: {
        id: profile?.id ?? raw.user_id ?? 'unknown',
        displayName,
        subtitle: department,
        avatarUrl: profile?.avatar_url ?? null,
      },
      body,
      timestamp: raw.created_at ?? null,
      badges: [],
      metadata: {
        imageUrl: raw.image_url ?? null,
        likeCount: enrichment?.likeCount ?? 0,
        commentCount: enrichment?.commentCount ?? 0,
        isLiked: enrichment?.isLiked ?? false,
        authorUserId: profile?.id ?? raw.user_id ?? 'unknown',
        department,
        tags,
      },
      actions: [],
    }
  }

  /**
   * Pobranie pojedynczego posta z Supabase (używane przez widok SinglePost).
   * Zwraca surowy rekord — mapowanie do UnifiedContent pozostawiamy konsumentowi,
   * który potrzebuje połączyć go z enrichmentem (likes/comments).
   */
  async fetchById(id: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department, is_banned, show_department)')
      .eq('id', Number(id))
      .single()

    if (error || !data) return null
    return this.mapPost(data as Post)
  }

  /**
   * Batch pobranie postów po liście ID — używane przez wyszukiwarkę, żeby
   * z hitów Meilisearch (które zawierają tylko zindeksowane pola) zbudować
   * pełne UnifiedContent dla `PostCard`. Pomija puste / niepoprawne ID i
   * autorów z `is_banned = true`. Kolejność zwracana z Supabase nie jest
   * gwarantowana — sortowanie do kolejności wejściowej leży po stronie
   * konsumenta (Search zachowuje kolejność trafień).
   */
  /**
   * Pobranie N najnowszych postów — używane przez `ContextInjectedBielikAdapter`,
   * żeby zbudować system-prompt dla Bielika. Bez enrichmentu (likes/comments) i
   * bez paginacji: dla RAG-Lite wystarczy `limit` (typowo 10). Filtruje
   * `is_banned`-autorów, tak samo jak `fetchByIds` — model nie powinien dostawać
   * treści od kont zbanowanych.
   */
  async listRecent(limit: number): Promise<Post[]> {
    if (!Number.isFinite(limit) || limit <= 0) return []
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department, is_banned, show_department)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as Post[])
      .map((row) => this.mapPost(row))
      .filter((row) => row.profiles?.is_banned !== true)
  }

  /**
   * Paginowany feed głównej tablicy w jednym round-tripie.
   *
   * Wywołuje RPC `get_feed_snapshot` (patrz migracja
   * `20260609130000_feed_snapshot_rpc.sql`), które zwraca posty + author +
   * likes_count + comments_count + is_liked w jednym JSONB. Zastępuje 3-krotny
   * fetch (posts → likes → comments) który był wcześniej w `App.tsx`.
   *
   * Keyset paginacja: cursor = (created_at, id) ostatniego elementu poprzedniej
   * strony. `null` cursor = pierwsza strona. `nextCursor = null` znaczy że to
   * była ostatnia strona (mniej wyników niż limit).
   *
   * `is_banned` profili filtrowany jest po stronie RPC. `viewer` brany z
   * `auth.uid()` po stronie Postgresa — klient nie może spoofować `is_liked`.
   */
  async listFeed(cursor: FeedCursor | null, limit = 30): Promise<FeedPage> {
    const { data, error } = await supabase.rpc('get_feed_snapshot', {
      p_limit: limit,
      p_cursor_ts: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
    })
    if (error || !data) return { posts: [], nextCursor: null }
    const raw = data as {
      posts?: Array<Record<string, unknown>>
      next_cursor?: { created_at: string; id: number } | null
    }
    const posts = (raw.posts ?? []).map((row) => {
      const mapped = this.mapPost(row as Post)
      return {
        ...mapped,
        likes_count: Number((row as Record<string, unknown>).likes_count ?? 0),
        comments_count: Number((row as Record<string, unknown>).comments_count ?? 0),
        is_liked: Boolean((row as Record<string, unknown>).is_liked ?? false),
      } as FeedPagePost
    })
    const nextCursor = raw.next_cursor
      ? { createdAt: raw.next_cursor.created_at, id: Number(raw.next_cursor.id) }
      : null
    return { posts, nextCursor }
  }

  async fetchByIds(ids: ReadonlyArray<string>): Promise<Post[]> {
    const numericIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (numericIds.length === 0) return []

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, department, is_banned, show_department)')
      .in('id', numericIds)

    if (error || !data) return []
    return (data as Post[])
      .map((row) => this.mapPost(row))
      .filter((row) => row.profiles?.is_banned !== true)
  }

  /** Batch mapowanie posta + enrichment indeksowany po `post.id`. */
  toUnifiedList(
    posts: Post[],
    enrichments: {
      likesCountByPost: Record<string, number>
      likedPostIds: Record<string, boolean>
      commentsCountByPost: Record<string, number>
    },
  ): UnifiedContent<PostMeta>[] {
    const out: UnifiedContent<PostMeta>[] = []
    for (const p of posts) {
      if (!p.id) continue
      const uc = this.toUnified(p, {
        likeCount: enrichments.likesCountByPost[p.id] ?? 0,
        isLiked: Boolean(enrichments.likedPostIds[p.id]),
        commentCount: enrichments.commentsCountByPost[p.id] ?? 0,
      })
      if (uc) out.push(uc)
    }
    return out
  }
}

export const PostsAdapter = new PostsAdapterImpl()
