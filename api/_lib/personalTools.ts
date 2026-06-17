/**
 * Narzędzia zwracające dane per-user — cache key MUSI zawierać userId.
 */

export const PERSONAL_TOOL_NAMES = new Set([
  'get_my_user_context',
  'get_my_aula_overview',
  'get_my_classes_in_range',
  'get_my_weekly_briefing',
  'get_my_followed_lecturers',
  'get_unread_notifications',
  'get_co_przegapilem',
])

export function isPersonalTool(toolName: string): boolean {
  return PERSONAL_TOOL_NAMES.has(toolName)
}
