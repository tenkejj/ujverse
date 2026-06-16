/** Ten sam horyzont co w `AcademicAnnouncementsWidget` — tylko „świeże” komunikaty. */
export const ACTIVE_ANNOUNCEMENT_DAYS = 30

/**
 * Max rekordów z Supabase na jeden request listy. Widget i pigułki i tak
 * pokazują kilkanaście pozycji — bez limitu Postgres musi czytać setki
 * wierszy z `full_body` (kilobajty każdy) i kończy się `statement timeout`.
 */
export const LIST_ANNOUNCEMENTS_LIMIT = 80

export function activeAnnouncementCutoff(): Date {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - ACTIVE_ANNOUNCEMENT_DAYS)
  return cutoff
}

export function isActiveAnnouncementTimestamp(iso: string | null | undefined): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return false
  return time >= activeAnnouncementCutoff().getTime()
}
