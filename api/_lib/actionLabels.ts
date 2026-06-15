/**
 * Action Labels — mapa `toolName` → krótkie, ludzkie etykiety tego, co
 * Versuś właśnie robi. Pokazujemy je w UI zamiast losowych „Myślę…",
 * gdy serwer wie konkretnie, którego narzędzia używa.
 *
 * Reguły naming:
 *  - 1. os. l. poj. lub bezosobowo („Sprawdzam…", „Lecę po…", „Patrzę…")
 *  - bez kropki na końcu (klient sam dorzuca trzy kropki / animację)
 *  - krótkie (mieści się w jednej linijce typing-indicator)
 *  - PL only, luźny ton w stylu znajomego studenta
 *  - 2-4 warianty per tool → losowo wybierany dla wariancji UX
 *
 * Server wysyła to w SSE jako:
 *   data: { meta: { tool: "search_discounts", label: "Lecę po zniżki" } }
 *
 * Klient (`useChatSend`) ustawia `actionLabel` w storze; `MessageList
 * TypingIndicator` woli action label nad rotującymi „thinking phrases".
 */
import type { ToolName } from './intentRouter.js'

const ACTION_LABEL_VARIANTS: Record<ToolName, readonly string[]> = {
  search_events: [
    'Patrzę co się dzieje',
    'Lecę po wydarzenia',
    'Skanuję plakaty',
  ],
  get_latest_announcements: [
    'Łapię świeże ogłoszenia',
    'Patrzę co nowego z UJ',
    'Sprawdzam komunikaty',
  ],
  get_announcement_details: [
    'Szukam tego konkretnego ogłoszenia',
    'Wertuję komunikaty',
    'Patrzę w treść',
  ],
  get_latest_posts: [
    'Zaglądam na feed',
    'Patrzę co tam ludzie piszą',
    'Skanuję feed',
  ],
  get_calendar_in_range: [
    'Sprawdzam kalendarz akademicki',
    'Patrzę w plan roku',
    'Lecę do kalendarza',
  ],
  search_discounts: [
    'Lecę po zniżki',
    'Łapię promo',
    'Patrzę gdzie się opłaca',
  ],
  get_trending_discounts: [
    'Patrzę co tani modne',
    'Łapię topkę zniżek',
    'Zerkam na hity',
  ],
  get_my_classes_in_range: [
    'Zaglądam do Twojego planu',
    'Lecę po Twoje zajęcia',
    'Sprawdzam co masz',
  ],
  get_my_weekly_briefing: [
    'Składam Twój tygodniowy briefing',
    'Lecę po podsumowanie tygodnia',
  ],
  get_upcoming_usos_registrations: [
    'Sprawdzam rejestracje USOS',
    'Patrzę na rejki',
  ],
  get_upcoming_official_events: [
    'Sprawdzam co tam UJ szykuje',
    'Lecę po oficjalne wydarzenia',
  ],
  find_user: ['Szukam tej osoby', 'Lecę po profil'],
  get_my_user_context: ['Sprawdzam Twój kontekst', 'Patrzę kim jesteś'],
  get_my_aula_overview: [
    'Sprawdzam Twoją Aulę',
    'Lecę po Aulę',
    'Patrzę co tam w Auli',
  ],
  find_lecturer: ['Szukam wykładowcy', 'Lecę po wykładowcę'],
  get_lecturer_announcements_by_name: [
    'Sprawdzam komunikaty wykładowcy',
    'Lecę po jego ogłoszenia',
  ],
  get_my_followed_lecturers: [
    'Sprawdzam kogo śledzisz',
    'Patrzę na Twoje subskrypcje',
  ],
}

/**
 * Helper — zwraca losową etykietę z wariantów dla danego toola, albo `null`
 * (nieznana nazwa, bezpieczny fallback do generycznych thinking phrases).
 *
 * Dlaczego losowo: dwa pod rząd zapytania o ten sam tool dają różną
 * etykietę → user widzi że bot „myśli", a nie powtarza w kółko jedno
 * zdanie. Tani wariant — zero LLM calls, czysta funkcja.
 */
export function getActionLabel(toolName: string): string | null {
  if (!(toolName in ACTION_LABEL_VARIANTS)) return null
  const variants = ACTION_LABEL_VARIANTS[toolName as ToolName]
  if (variants.length === 0) return null
  const idx = Math.floor(Math.random() * variants.length)
  return variants[idx] ?? null
}
