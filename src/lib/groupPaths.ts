/** Ścieżki URL widoków grup — slug pochodzi z `public.groups.slug` (= tag). */

export const GROUP_INDEX_PATH = '/group'
export const DEFAULT_GROUP_SLUG = 'studia'

export function groupPathForSlug(slug: string): string {
  return `/group/${encodeURIComponent(slug.trim().toLowerCase())}`
}

export const GROUP_DEFAULT_PATH = groupPathForSlug(DEFAULT_GROUP_SLUG)

export function isGroupIndexPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === GROUP_INDEX_PATH
}

export function slugFromGroupPath(pathname: string): string | null {
  const m = pathname.match(/^\/group\/([^/]+)\/?$/)
  if (!m) return null
  const slug = decodeURIComponent(m[1]).trim().toLowerCase()
  return slug || null
}
