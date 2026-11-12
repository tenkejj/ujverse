/**
 * Legacy index names retained for migrations/tooling only.
 * Browser search uses Supabase's session/anon client and server-enforced RLS.
 * Never construct a browser Meilisearch client or expose an index-wide key here.
 */
export const USERS_INDEX = 'ujverse_users'
export const AULA_INDEX = 'ujverse_aula'
export function readContentIndexName(): string {
  return 'ujverse_content'
}
