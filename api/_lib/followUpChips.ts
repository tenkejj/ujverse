/**
 * Follow-Up Chips — sugerowane szybkie akcje pokazywane pod odpowiedzią
 * Versusia. User klika, klient wstawia tekst chipa do composera i wysyła.
 *
 * Filozofia: zerowy koszt LLM. Mapa toolName → 2-3 statyczne sugestie,
 * dobrane manualnie żeby były „następnym naturalnym pytaniem". User
 * widzi „pokaż zniżki" → klika „Tylko jedzenie" → bot zawęża.
 *
 * Server emituje to w SSE jako:
 *   data: { meta: { chips: ["Tylko jedzenie", "Bliżej Rynku"] } }
 *
 * Klient (`useChatSend`) zapisuje na ostatniej assistant message; UI
 * (`MessageList`) renderuje pod ostatnią odpowiedzią asystenta.
 *
 * Tradeoff vs LLM-generated chipy:
 *   - LLM: bardziej kontekstowe ("pokaż jutro też w Kazimierzu") ale +1
 *     round-trip do Llama 8B = ~150ms i ~$0.0001/per
 *   - Static: zero kosztu, generic ale wystarczająco dobre dla 80%
 *     przypadków. Wybrałem static — można zrobić upgrade jak będzie potrzeba.
 */

import type { ToolName } from './intentRouter.js'

const CHIPS_BY_TOOL: Record<ToolName, readonly string[]> = {
  search_events: ['Jutro też?', 'Tylko za darmo', 'Tylko UJ'],
  get_latest_announcements: ['Tylko mojego kierunku', 'Pokaż starsze', 'Szukaj w treści'],
  get_announcement_details: ['Pełna treść', 'Kiedy aktywne?', 'Inne na ten temat'],
  get_latest_posts: ['Pokaż więcej', 'Tylko z dzisiaj', 'Co na feedzie?'],
  get_calendar_in_range: ['Co po sesji?', 'Tylko egzaminy', 'Co jutro?'],
  search_discounts: ['Tylko jedzenie', 'Bliżej Rynku', 'Pokaż więcej'],
  get_trending_discounts: ['Pokaż wszystkie', 'Tylko jedzenie', 'Bliżej centrum'],
  get_my_classes_in_range: ['Co jutro?', 'Cały tydzień', 'Tylko egzaminy'],
  get_my_weekly_briefing: ['Co jutro?', 'Tylko zniżki', 'Co w Auli?'],
  get_upcoming_usos_registrations: ['Pokaż wszystkie', 'Co w planie?'],
  get_upcoming_official_events: ['Tylko UJ', 'Pokaż w przyszłym tygodniu'],
  find_user: ['Pokaż jego posty', 'Znajdź inną osobę'],
  get_my_user_context: ['Co w planie?', 'Pokaż zniżki'],
  get_my_aula_overview: ['Tylko deadliney', 'Tylko ankiety', 'Co jutro?'],
  find_lecturer: ['Jego ogłoszenia', 'Subskrybuj go'],
  get_lecturer_announcements_by_name: ['Pokaż starsze', 'Subskrybuj go'],
  get_my_followed_lecturers: ['Najnowsze ogłoszenia', 'Kogo jeszcze dodać?'],
}

/**
 * Zwraca 2-3 follow-up chipy dla danego toola. Pusta tablica = brak
 * sugestii (np. dla `get_my_user_context` — nie ma sensownego next-step).
 *
 * Klient musi tolerować pustą tablicę i nie renderować rzędu chipów.
 */
export function getFollowUpChips(toolName: string): readonly string[] {
  if (!(toolName in CHIPS_BY_TOOL)) return []
  return CHIPS_BY_TOOL[toolName as ToolName]
}
