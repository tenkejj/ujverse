/**
 * UJverse — React hook subskrybujący `userPreferences` z `lib/userPreferences.ts`.
 *
 * Jedno miejsce do logiki snapshot + subscribe — przed wyciągnięciem
 * `SettingsView` trzymał własną kopię. Semantyka jest 1:1 z
 * `subscribePreferences(setPrefs)` — wartość początkowa brana synchronicznie
 * z localStorage (lub DEFAULTS gdy SSR / brak storage), potem reaktywna na
 * każde wywołanie `setUserPreference`.
 */
import { useEffect, useState } from 'react'
import {
  getUserPreferences,
  subscribePreferences,
  type UserPreferences,
} from '../lib/userPreferences'

export function useUserPrefs(): UserPreferences {
  const [prefs, setPrefs] = useState<UserPreferences>(() => getUserPreferences())
  useEffect(() => subscribePreferences(setPrefs), [])
  return prefs
}
