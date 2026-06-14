/**
 * Action Labels — mapa `toolName` → krótka, ludzka etykieta tego, co
 * asystent właśnie robi. Pokazujemy ją w UI zamiast losowych
 * „Myślę…" gdy serwer wie konkretnie, którego narzędzia używa.
 *
 * Reguły naming:
 *  - 1 zdanie czasem nieosobowy / 1. os. l. poj. („Sprawdzam…", „Szukam…")
 *  - bez kropki na końcu (klient sam dorzuca trzy kropki / animację)
 *  - krótkie (mieści się w jednej linijce typing-indicator)
 *  - PL only (cały produkt jest PL)
 *
 * Server wysyła to w SSE jako:
 *   data: { meta: { tool: "search_discounts", label: "Sprawdzam zniżki" } }
 *
 * Klient (`useChatSend`) ustawia `actionLabel` w storze; `MessageList
 * TypingIndicator` woli action label nad rotującymi „thinking phrases".
 */
import type { ToolName } from './intentRouter'

export const ACTION_LABELS: Record<ToolName, string> = {
  search_events: 'Przeszukuję wydarzenia',
  get_latest_announcements: 'Sprawdzam ogłoszenia',
  get_latest_posts: 'Zaglądam na feed',
  get_calendar_in_range: 'Sprawdzam kalendarz akademicki',
  search_discounts: 'Sprawdzam zniżki',
  get_trending_discounts: 'Patrzę na popularne zniżki',
  get_my_classes_in_range: 'Sprawdzam Twój plan zajęć',
  get_my_weekly_briefing: 'Składam Twój tygodniowy briefing',
  get_upcoming_usos_registrations: 'Sprawdzam rejestracje USOS',
  get_upcoming_official_events: 'Sprawdzam najbliższe wydarzenia uczelni',
  find_user: 'Szukam tej osoby',
  get_my_user_context: 'Sprawdzam Twój kontekst',
  get_my_aula_overview: 'Sprawdzam Twoją Aulę',
  find_lecturer: 'Szukam wykładowcy',
  get_lecturer_announcements_by_name: 'Sprawdzam komunikaty wykładowcy',
  get_my_followed_lecturers: 'Sprawdzam Twoje subskrypcje',
}

/**
 * Helper — zwraca etykietę albo `null` (nieznana nazwa, bezpieczny fallback).
 */
export function getActionLabel(toolName: string): string | null {
  if (toolName in ACTION_LABELS) {
    return ACTION_LABELS[toolName as ToolName]
  }
  return null
}
