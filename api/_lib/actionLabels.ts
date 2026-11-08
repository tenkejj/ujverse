/** Tool activity labels describe the actual operation, without rotating filler. */
import type { ToolName } from './intentRouter.js'
const ACTION_LABELS: Record<ToolName, string> = {
  search_events: 'Sprawdzam wydarzenia…',
  get_latest_announcements: 'Sprawdzam komunikaty…',
  get_announcement_details: 'Odczytuję komunikat…',
  get_latest_posts: 'Sprawdzam wpisy…',
  get_calendar_in_range: 'Sprawdzam kalendarz…',
  search_discounts: 'Sprawdzam zniżki…',
  get_trending_discounts: 'Sprawdzam popularne zniżki…',
  get_my_classes_in_range: 'Sprawdzam Twój plan…',
  get_my_weekly_briefing: 'Przygotowuję podsumowanie tygodnia…',
  get_upcoming_usos_registrations: 'Sprawdzam rejestracje USOS…',
  get_upcoming_official_events: 'Sprawdzam wydarzenia UJ…',
  find_user: 'Szukam profilu…',
  get_my_user_context: 'Sprawdzam informacje z Twojego konta…',
  get_my_aula_overview: 'Sprawdzam Twoją Aulę…',
  find_lecturer: 'Szukam wykładowcy…',
  get_lecturer_announcements_by_name: 'Sprawdzam komunikaty wykładowcy…',
  get_my_followed_lecturers: 'Sprawdzam obserwowanych wykładowców…',
  get_unread_notifications: 'Sprawdzam powiadomienia…',
  get_co_przegapilem: 'Przygotowuję podsumowanie…',
}
export function getActionLabel(toolName: string): string | null {
  return Object.prototype.hasOwnProperty.call(ACTION_LABELS, toolName)
    ? ACTION_LABELS[toolName as ToolName]
    : null
}
