export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio?: string | null
  department?: string | null
}

export type Post = {
  id?: string
  content?: string
  image_url?: string | null
  created_at?: string
  user_id?: string
  profiles?: Profile | null
}

export type Comment = {
  id: number
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile | null
}

export type AppNotification = {
  id: string
  user_id: string
  actor_id: string
  type: 'like' | 'comment'
  post_id: string | null
  is_read: boolean
  created_at: string
  actor?: Profile | null
}
