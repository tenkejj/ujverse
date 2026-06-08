/**
 * userPreferences — pojedyncze źródło prawdy dla klienckich preferencji UI.
 *
 * Wszystko co użytkownik przełącza w ustawieniach (poza motywem, którym zarządza
 * `ThemeContext`) trafia tutaj. Wartości trzymamy w `localStorage`, a wizualne
 * efekty (gęstość, ograniczone animacje) aplikujemy przez atrybuty
 * `data-density` / `data-reduced-motion` na `<html>`. CSS w `index.css`
 * konsumuje te atrybuty.
 *
 * Subskrypcja (`subscribePreferences`) pozwala komponentom (np. `SettingsView`)
 * reagować na zmiany bez globalnego store'a.
 */

export type Density = 'comfortable' | 'compact'

export type UserPreferences = {
  /** Ogranicza animacje / transitions w całej apce. */
  reducedMotion: boolean
  /** Gęstość interfejsu: domyślnie wygodna, alternatywa kompaktowa. */
  density: Density
  /** Globalny przełącznik dźwięku przy nowych powiadomieniach. */
  notificationSound: boolean
  /** Pokaż mój profil w wyszukiwarce (filtr klienta). */
  showProfileInSearch: boolean
  /** Pokaż badge wydziału przy moich postach. */
  showDepartmentOnPosts: boolean
}

const STORAGE_KEY = 'uj_user_prefs_v1'

const DEFAULTS: UserPreferences = {
  reducedMotion: false,
  density: 'comfortable',
  notificationSound: true,
  showProfileInSearch: true,
  showDepartmentOnPosts: true,
}

type Listener = (prefs: UserPreferences) => void
const listeners = new Set<Listener>()

let cached: UserPreferences | null = null

function safeRead(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UserPreferences> | null
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS }
    return {
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULTS.reducedMotion,
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      notificationSound:
        typeof parsed.notificationSound === 'boolean' ? parsed.notificationSound : DEFAULTS.notificationSound,
      showProfileInSearch:
        typeof parsed.showProfileInSearch === 'boolean' ? parsed.showProfileInSearch : DEFAULTS.showProfileInSearch,
      showDepartmentOnPosts:
        typeof parsed.showDepartmentOnPosts === 'boolean'
          ? parsed.showDepartmentOnPosts
          : DEFAULTS.showDepartmentOnPosts,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function safeWrite(prefs: UserPreferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function getUserPreferences(): UserPreferences {
  if (!cached) cached = safeRead()
  return cached
}

export function setUserPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): UserPreferences {
  const current = getUserPreferences()
  const next: UserPreferences = { ...current, [key]: value }
  cached = next
  safeWrite(next)
  applyVisualPreferences(next)
  for (const fn of listeners) fn(next)
  return next
}

export function resetUserPreferences(): UserPreferences {
  cached = { ...DEFAULTS }
  safeWrite(cached)
  applyVisualPreferences(cached)
  for (const fn of listeners) fn(cached)
  return cached
}

export function subscribePreferences(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Wpisuje atrybuty data-* na <html> tak, żeby globalny CSS w `index.css`
 * (selektory `html[data-reduced-motion="true"]`, `html[data-density="compact"]`)
 * mógł wymusić odpowiednie reguły bez konieczności przepuszczania prefs przez
 * setki komponentów.
 */
export function applyVisualPreferences(prefs: UserPreferences = getUserPreferences()) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (prefs.reducedMotion) {
    root.setAttribute('data-reduced-motion', 'true')
  } else {
    root.removeAttribute('data-reduced-motion')
  }
  root.setAttribute('data-density', prefs.density)
}
