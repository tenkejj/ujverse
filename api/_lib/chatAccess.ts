/** Public Versuś can read university information; account/community tools require a verified user. */
const PUBLIC_CHAT_TOOLS = new Set([
  'get_latest_announcements',
  'get_announcement_details',
  'get_lecturer_announcements_by_name',
  'find_lecturer',
  'get_upcoming_official_events',
  'get_upcoming_usos_registrations',
  'search_events',
  'get_calendar_in_range',
])

export function canUseChatTool(name: string, userId?: string | null): boolean {
  return Boolean(userId) || PUBLIC_CHAT_TOOLS.has(name)
}

/** Organic replies can contain personal context even when the prompt does not name a private tool. */
export function chatResponseScope(userId?: string | null): string {
  return userId ? `user:${userId}` : 'public:v1'
}

/** Search/registration tools return different record sets for visitors and signed-in users. */
export function chatToolAccessScope(userId?: string | null): string {
  return userId ? 'authenticated' : 'public:v1'
}
