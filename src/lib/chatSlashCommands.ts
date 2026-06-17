/**
 * UJverse — chatSlashCommands: preset queries dla asystenta AI dostępne
 * przez slash menu (Discord/Linear/ChatGPT-plugins pattern).
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Każda komenda mapuje 1:1 na konkretne pytanie do asystenta, świadomie
 * dobierane pod konkretne narzędzia z `api/_lib/tools/` (deterministic
 * tool routing). Trzymamy je w sync z `ChatHubView.QUICK_PROMPTS` i
 * `scripts/prewarm-chat-cache.ts` — response cache key normalizuje tekst,
 * więc dosłowna zgodność daje cross-surface cache hit.
 *
 * Trzy korzyści dla usera:
 *   1. Zero literówek / wahania ("co napisać")
 *   2. Discoverability — user widzi co AI potrafi
 *   3. Cache HIT prawie pewny (responseCache TTL 300s)
 */

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  Megaphone,
  Newspaper,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react'

export type SlashCommand = {
  /** Slug widoczny po `/` (bez `/` prefiksu w typie). */
  slug: string
  /** Tekst label w popupie. */
  label: string
  /** Krótki opis tooltipowy. */
  description: string
  /** Faktyczne zapytanie wysyłane do asystenta. */
  query: string
  /** Ikona z lucide-react. */
  icon: LucideIcon
  /** Akcent kolorystyczny tła ikony (Tailwind). */
  iconBg: string
}

/**
 * Stały zestaw komend — 11 sztuk po dorzuceniu zniżek, planu, briefingu,
 * rejestracji USOS. Pierwsze 4 są **dokładnie** te same queries co w
 * `QUICK_PROMPTS` w `ChatHubView.tsx` / `ChatAssistantFab.tsx`
 *
 * Mapping na narzędzia (1:1):
 *   /feed         → get_latest_posts
 *   /oglosznia    → get_latest_announcements
 *   /tydzien      → get_upcoming_official_events (default 14d)
 *   /naukowe      → search_events("nauk")
 *   /wziks        → get_latest_announcements (filter w toolu)
 *   /juwenalia    → search_events("juwenalia")
 *   /zniski       → search_discounts (top 10 verified)
 *   /trending     → get_trending_discounts
 *   /plan         → get_my_classes_in_range (today)
 *   /brief        → get_my_weekly_briefing
 *   /rejestracje  → get_upcoming_usos_registrations
 *   /pomoc        → meta-info bez tooli
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    slug: 'feed',
    label: 'Co nowego na feedzie',
    description: 'Najnowsze posty społeczności',
    query: 'Co nowego na feedzie?',
    icon: Newspaper,
    iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  },
  {
    slug: 'oglosznia',
    label: 'Najnowsze ogłoszenia',
    description: 'Komunikaty akademickie',
    query: 'Najnowsze ogłoszenia',
    icon: Megaphone,
    iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    slug: 'tydzien',
    label: 'Co w przyszłym tygodniu',
    description: 'Wydarzenia na najbliższy tydzień',
    query: 'Co w przyszłym tygodniu?',
    icon: CalendarDays,
    iconBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  {
    slug: 'naukowe',
    label: 'Wydarzenia naukowe',
    description: 'Konferencje, sympozja, panele',
    query: 'Wydarzenia naukowe',
    icon: GraduationCap,
    iconBg: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  {
    slug: 'zniski',
    label: 'Zniżki studenckie',
    description: 'Couponek UJ — top zniżki w Krakowie',
    query: 'Pokaż zniżki studenckie',
    icon: Tag,
    iconBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  {
    slug: 'trending',
    label: 'Trendujące zniżki',
    description: 'Co studenci ostatnio biorą',
    query: 'Jakie zniżki są teraz najpopularniejsze?',
    icon: TrendingUp,
    iconBg: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  },
  {
    slug: 'plan',
    label: 'Mój plan na dziś',
    description: 'Dzisiejsze zajęcia z odwołanymi',
    query: 'Co mam dziś w planie?',
    icon: CalendarDays,
    iconBg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  },
  {
    slug: 'brief',
    label: 'Briefing tygodniowy',
    description: 'Podsumowanie tego tygodnia',
    query: 'Pokaż mój briefing tygodniowy',
    icon: ClipboardList,
    iconBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  {
    slug: 'rejestracje',
    label: 'Rejestracje USOS',
    description: 'Nadchodzące rejestracje na przedmioty',
    query: 'Jakie są nadchodzące rejestracje USOS?',
    icon: Bell,
    iconBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    slug: 'wziks',
    label: 'Ogłoszenia WZIKS',
    description: 'Komunikaty wydziałowe',
    query: 'Pokaż ogłoszenia z Wydziału Zarządzania i Komunikacji Społecznej',
    icon: Bell,
    iconBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    slug: 'juwenalia',
    label: 'Juwenalia UJ',
    description: 'Kiedy są tegoroczne juwenalia',
    query: 'Kiedy są juwenalia UJ?',
    icon: Sparkles,
    iconBg: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  },
  {
    slug: 'jutro',
    label: 'Plan na jutro',
    description: 'Jutrzejsze zajęcia z USOS',
    query: 'Co mam jutro?',
    icon: CalendarDays,
    iconBg: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  },
  {
    slug: 'aula',
    label: 'Co w Auli',
    description: 'Deadliney, ankiety, zadania',
    query: 'Co w Auli?',
    icon: ClipboardList,
    iconBg: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  {
    slug: 'wykladowcy',
    label: 'Moi wykładowcy',
    description: 'Subskrypcje i ich ogłoszenia',
    query: 'Moi wykładowcy',
    icon: Users,
    iconBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  {
    slug: 'powiadomienia',
    label: 'Nieprzeczytane',
    description: 'Lajki, komentarze, Aula, wykładowcy',
    query: 'Moje powiadomienia',
    icon: Bell,
    iconBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    slug: 'przegapilem',
    label: 'Co przegapiłem',
    description: 'Powiadomienia, plan, Aula, ogłoszenia',
    query: 'Co przegapiłem?',
    icon: Sparkles,
    iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    slug: 'pomoc',
    label: 'Co potrafisz',
    description: 'Lista możliwości Versusia',
    query: 'Co potrafisz?',
    icon: HelpCircle,
    iconBg: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200',
  },
]

/**
 * Filtr komend dla draftu zaczynającego się od `/`. Zwraca uporządkowaną
 * listę (slug-prefix-match przed substring-match-w-labelu).
 *
 * @param raw — pełen draft (z `/` na początku). Wszystko po pierwszej spacji
 *              jest ignorowane — slash menu zamyka się przy wstawieniu spacji.
 * @returns posortowane match-e, lub pełna lista gdy query po `/` jest pusty.
 */
export function filterSlashCommands(raw: string): SlashCommand[] {
  if (!raw.startsWith('/')) return []
  const q = raw.slice(1).toLowerCase().trim()
  if (!q) return [...SLASH_COMMANDS]

  // Tylko commandy ze slug-prefix-match albo substring w labelu.
  const matches: Array<{ cmd: SlashCommand; score: number }> = []
  for (const cmd of SLASH_COMMANDS) {
    const slug = cmd.slug.toLowerCase()
    const label = cmd.label.toLowerCase()
    if (slug.startsWith(q)) {
      matches.push({ cmd, score: 0 }) // best
    } else if (slug.includes(q)) {
      matches.push({ cmd, score: 1 })
    } else if (label.includes(q)) {
      matches.push({ cmd, score: 2 })
    }
  }
  matches.sort((a, b) => a.score - b.score)
  return matches.map((m) => m.cmd)
}

/**
 * Detekcja: czy raw draft jest "slash-mode"? Spacja kończy tryb (user
 * zaczął pisać normalne pytanie po komendzie). Multi-line też kończy.
 */
export function isSlashMode(raw: string): boolean {
  if (!raw.startsWith('/')) return false
  // Jeśli jest jakaś biała spacja w drafcie po `/` → tryb komendy zakończony
  return !/\s/.test(raw)
}
