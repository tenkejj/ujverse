import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  Megaphone,
  Radio,
} from 'lucide-react'

/** Etykieta sekcji w prawej kolumnie (UI — bez wpływu na DB). */
export const STREFY_SECTION_LABEL = 'STREFY'

/** Alias — sekcja nadal pokazuje top z ostatnich 7 dni. */
export const TRENDING_SECTION_LABEL = STREFY_SECTION_LABEL

export const CHANNELS_SECTION_LABEL = STREFY_SECTION_LABEL

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  ankieta: ClipboardList,
  ankiety: ClipboardList,
  ogloszenie: Megaphone,
  ogloszenia: Megaphone,
  wydarzenie: CalendarDays,
  wydarzenia: CalendarDays,
  pomoc: HelpCircle,
  praca: Briefcase,
}

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  ankieta: 'Ankiety i głosowania wśród studentów UJ.',
  ankiety: 'Ankiety i głosowania wśród studentów UJ.',
  ogloszenie: 'Ogłoszenia i informacje z życia uczelni.',
  ogloszenia: 'Ogłoszenia i informacje z życia uczelni.',
  wydarzenie: 'Wydarzenia, spotkania i inicjatywy społeczności.',
  wydarzenia: 'Wydarzenia, spotkania i inicjatywy społeczności.',
  pomoc: 'Prośby o pomoc i wsparcie w sprawach studenckich.',
  praca: 'Oferty pracy, staży i współpracy.',
}

export function getChannelIcon(slug: string): LucideIcon {
  return CHANNEL_ICONS[slug.trim().toLowerCase()] ?? Radio
}

export function getChannelDescription(slug: string, displayName?: string): string {
  const key = slug.trim().toLowerCase()
  if (CHANNEL_DESCRIPTIONS[key]) return CHANNEL_DESCRIPTIONS[key]
  const label = displayName?.trim() || key
  return `Wpisy społeczności oznaczone tagiem #${key} — strefa „${label}".`
}
