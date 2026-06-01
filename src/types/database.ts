export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          content: string | null
          created_at: string
          id: number
          parent_id: number | null
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          parent_id?: number | null
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          parent_id?: number | null
          post_id?: string | null
          user_id?: string | null
        }
      }
      likes: {
        Row: {
          created_at: string
          id: number
          post_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          post_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          post_id?: number | null
          user_id?: string | null
        }
      }
      comment_likes: {
        Row: {
          comment_id: number
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          id?: number
          user_id?: string
        }
      }
      comment_replies: {
        Row: {
          content: string | null
          created_at: string
          id: number
          media_url: string | null
          parent_comment_id: number
          post_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: number
          media_url?: string | null
          parent_comment_id: number
          post_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: number
          media_url?: string | null
          parent_comment_id?: number
          post_id?: string | null
          user_id?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      group_memberships: {
        Row: {
          group_id: string
          post_id: number
          created_at: string
        }
        Insert: {
          group_id: string
          post_id: number
          created_at?: string
        }
        Update: {
          group_id?: string
          post_id?: number
          created_at?: string
        }
      }
    }
    Functions: {
      get_replies_engagement_snapshot: {
        Args: {
          p_post_ids: number[]
          p_reply_ids: number[]
          p_viewer_id?: string | null
        }
        Returns: {
          entity_type: string
          entity_id: number
          likes_count: number
          comments_count: number
          has_liked: boolean
        }[]
      }
    }
  }
}

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Wiersz `public.groups` — źródło prawdy dla menu grup i triggera tagów. */
export type Group = TablesRow<'groups'>

/** Wiersz `public.group_memberships` — relacja N:N post ↔ grupa. */
export type GroupMembership = TablesRow<'group_memberships'>

/** Payload do INSERT'u członkostwa w grupie (z opcjonalnym `created_at`). */
export type GroupMembershipInsert = TablesInsert<'group_memberships'>
