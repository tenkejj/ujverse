/**
 * GroupService — odczyt grup i postów z `public.groups` / `group_memberships`.
 * Przypisywanie postów do grup odbywa się w DB (trigger `on_post_created_or_updated`).
 */

import { supabase } from '../supabaseClient'
import type { Post } from '../types'

const POST_SELECT =
  '*, user_id, profiles(id, full_name, username, avatar_url, department, is_banned, show_department)'

const TRENDING_WINDOW_DAYS = 7
const TRENDING_DEFAULT_LIMIT = 6

export type GroupRow = {
  id: string
  name: string
  slug: string
}

export type TrendingGroupRow = GroupRow & {
  postCount: number
}

export type FetchGroupPostsResult = {
  posts: Post[]
  group: GroupRow | null
  error: Error | null
}

function sevenDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - TRENDING_WINDOW_DAYS)
  return d.toISOString()
}

class GroupServiceImpl {
  async listGroups(): Promise<{ groups: GroupRow[]; error: Error | null }> {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (error) {
      return { groups: [], error: new Error(error.message) }
    }

    return { groups: (data ?? []) as GroupRow[], error: null }
  }

  /**
   * Strefy z największą liczbą członkostw (`group_memberships`) z ostatnich 7 dni.
   */
  async listTrendingGroups(
    limit = TRENDING_DEFAULT_LIMIT,
  ): Promise<{ groups: TrendingGroupRow[]; error: Error | null }> {
    const since = sevenDaysAgoIso()

    const { data, error } = await supabase
      .from('group_memberships')
      .select('group_id, groups(id, name, slug)')
      .gte('created_at', since)

    if (error) {
      return { groups: [], error: new Error(error.message) }
    }

    const counts = new Map<string, { group: GroupRow; postCount: number }>()

    for (const row of data ?? []) {
      const raw = row.groups
      const group = (Array.isArray(raw) ? raw[0] : raw) as GroupRow | null | undefined
      if (!group?.id) continue

      const existing = counts.get(group.id)
      if (existing) {
        existing.postCount += 1
      } else {
        counts.set(group.id, { group, postCount: 1 })
      }
    }

    const groups = [...counts.values()]
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit)
      .map(({ group, postCount }) => ({ ...group, postCount }))

    return { groups, error: null }
  }

  async getGroupBySlug(slug: string): Promise<{ group: GroupRow | null; error: Error | null }> {
    const key = slug.trim().toLowerCase()
    if (!key) {
      return { group: null, error: new Error('Pusty slug grupy.') }
    }

    const { data, error } = await supabase
      .from('groups')
      .select('id, name, slug')
      .eq('slug', key)
      .maybeSingle()

    if (error) {
      return { group: null, error: new Error(error.message) }
    }

    return { group: (data as GroupRow | null) ?? null, error: null }
  }

  async fetchPostsForSlug(slug: string): Promise<FetchGroupPostsResult> {
    const { group, error: groupError } = await this.getGroupBySlug(slug)
    if (groupError) {
      return { posts: [], group: null, error: groupError }
    }
    if (!group) {
      return { posts: [], group: null, error: new Error('Nie znaleziono grupy dla tego tagu.') }
    }

    const { data: rows, error: membershipError } = await supabase
      .from('group_memberships')
      .select(`created_at, posts (${POST_SELECT})`)
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })

    if (membershipError) {
      return { posts: [], group, error: new Error(membershipError.message) }
    }

    const posts: Post[] = []
    for (const row of rows ?? []) {
      const raw = row.posts
      const post = (Array.isArray(raw) ? raw[0] : raw) as Post | null | undefined
      if (!post?.id) continue
      if (post.profiles?.is_banned === true) continue
      posts.push(post)
    }

    return { posts, group, error: null }
  }
}

export const GroupService = new GroupServiceImpl()
