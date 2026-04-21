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

/**
 * Adapter postów z feedu.
 *
 * Posty mają stan (likes/comments) zarządzany poza samym rekordem — adapter
 * `toUnified` przyjmuje więc enrichment jako drugi argument. Zachowujemy proste
 * mapowanie pól: sanitizer czyści tylko `body` (treść posta) i nazwę autora.
 */
class PostsAdapterImpl implements ContentAdapter<Post, PostMeta> {
  readonly type = 'post' as const

  toUnified(raw: Post, enrichment?: PostEnrichment): UnifiedContent<PostMeta> | null {
    if (!raw.id) return null
    const profile: Profile | null = raw.profiles ?? null
    const displayName = UjverseSanitizer.cleanAuthor(
      profile?.full_name ?? 'Użytkownik',
    ) || 'Użytkownik'

    const body = UjverseSanitizer.cleanBody(raw.content ?? '')
    const department = profile?.department ?? null

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
      .select('*, profiles(id, full_name, avatar_url, department)')
      .eq('id', Number(id))
      .single()

    if (error || !data) return null
    return data as Post
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
