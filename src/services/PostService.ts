/**
 * PostService — cienka warstwa odpowiedzialna za zapis posta do Supabase.
 *
 * Przypisanie posta do grup (`group_memberships`) odbywa się w bazie przez
 * trigger `on_post_created_or_updated` → `handle_post_tags_update()`.
 *
 * Zgodnie z regułą architektury #1 (`App.tsx` jest właścicielem session/feed
 * interaction state), UI (toast, spinner, fetchPosts, upload) zostaje w App.
 */

import { supabase } from '../supabaseClient'
import type { Post } from '../types'

export type CreatePostInput = {
  userId: string
  content: string
  imageUrl: string | null
  /** Znormalizowane tagi (lowercase, bez `#`) — patrz `extractPostTags`. */
  tags: string[]
}

export type CreatePostResult = {
  post: Post | null
  error: Error | null
}

class PostServiceImpl {
  async createPost(input: CreatePostInput): Promise<CreatePostResult> {
    const { data, error } = await supabase
      .from('posts')
      .insert([
        {
          content: input.content,
          image_url: input.imageUrl,
          user_id: input.userId,
          tags: input.tags,
        },
      ])
      .select('id, content, image_url, user_id, tags, created_at')
      .single()

    if (error || !data) {
      console.error('[PostService] createPost INSERT error:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        inputTagsLength: input.tags.length,
      })
      return {
        post: null,
        error: error
          ? new Error(error.message)
          : new Error('PostService.createPost: brak danych z INSERT'),
      }
    }

    const post = data as Post

    console.info('[PostService] createPost OK:', {
      id: post.id,
      sentTags: input.tags,
      dbTags: post.tags,
    })

    return { post, error: null }
  }
}

export const PostService = new PostServiceImpl()
