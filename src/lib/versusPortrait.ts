/**
 * Wybór portretu Versusia w empty state / composerze.
 * Preferencja lokalna — nie idzie na serwer.
 */

export type VersusPortraitId = 'owl' | 'pixel'

export type VersusPortraitOption = {
  id: VersusPortraitId
  label: string
  /** Krótki opis pod labelem w pickerze. */
  hint: string
}

export const VERSUS_PORTRAITS: readonly VersusPortraitOption[] = [
  {
    id: 'owl',
    label: 'Sowa',
    hint: 'Klasyczny mark Versusia',
  },
  {
    id: 'pixel',
    label: 'Pixel',
    hint: 'Stwórzek z rozmowy',
  },
] as const

const STORAGE_KEY = 'ujverse.versusPortrait.v1'
const DEFAULT_PORTRAIT: VersusPortraitId = 'owl'

export function isVersusPortraitId(value: unknown): value is VersusPortraitId {
  return value === 'owl' || value === 'pixel'
}

export function readVersusPortrait(): VersusPortraitId {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (isVersusPortraitId(raw)) return raw
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_PORTRAIT
}

export function writeVersusPortrait(id: VersusPortraitId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
