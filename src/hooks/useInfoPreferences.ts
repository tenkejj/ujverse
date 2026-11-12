/**
 * Lokalne preferencje warstwy informacyjnej: wydział, ukryte sekcje, zapisane.
 *
 * Zewnętrzny store (`useSyncExternalStore`) nad `localStorage`. Gdy storage
 * jest niedostępny (tryb prywatny, blokada), wszystko działa w pamięci do
 * końca sesji karty — `persistent: false` pozwala UI to uczciwie powiedzieć.
 * Zmiany z innych kart docierają przez zdarzenie `storage`.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  DEFAULT_INFO_PREFS,
  INFO_PREFS_STORAGE_KEY,
  parseInfoPrefs,
  resolveFaculty,
  serializeInfoPrefs,
  withFacultyChoice,
  withSectionHidden,
  type DashboardSectionId,
  type FacultyResolution,
  type InfoPrefs,
} from '../lib/info/preferences'
import {
  SAVED_STORAGE_KEY,
  parseSaved,
  serializeSaved,
  toSavedItem,
  toggleSavedItem,
  type SavedItem,
} from '../lib/info/saved'
import type { InfoItem, InfoKind } from '../lib/info/types'

type StoreState = {
  prefs: InfoPrefs
  saved: SavedItem[]
  persistent: boolean
}

const listeners = new Set<() => void>()
let state: StoreState | null = null

function probeStorage(): boolean {
  try {
    const key = '__ujverse_probe__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readState(): StoreState {
  if (typeof window === 'undefined' || !probeStorage()) {
    return { prefs: DEFAULT_INFO_PREFS, saved: [], persistent: false }
  }
  return {
    prefs: parseInfoPrefs(readItem(INFO_PREFS_STORAGE_KEY)),
    saved: parseSaved(readItem(SAVED_STORAGE_KEY)),
    persistent: true,
  }
}

function getState(): StoreState {
  if (!state) state = readState()
  return state
}

function emit() {
  for (const listener of listeners) listener()
}

function commit(patch: Partial<Pick<StoreState, 'prefs' | 'saved'>>) {
  let next: StoreState = { ...getState(), ...patch }
  if (next.persistent) {
    try {
      if (patch.prefs) window.localStorage.setItem(INFO_PREFS_STORAGE_KEY, serializeInfoPrefs(next.prefs))
      if (patch.saved) window.localStorage.setItem(SAVED_STORAGE_KEY, serializeSaved(next.saved))
    } catch {
      next = { ...next, persistent: false }
    }
  }
  state = next
  emit()
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== INFO_PREFS_STORAGE_KEY && event.key !== SAVED_STORAGE_KEY) return
  state = readState()
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

export function useInfoStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function setDashboardSectionHidden(section: DashboardSectionId, hidden: boolean) {
  commit({ prefs: withSectionHidden(getState().prefs, section, hidden) })
}

export function toggleSavedInfoItem(item: InfoItem) {
  commit({ saved: toggleSavedItem(getState().saved, toSavedItem(item)) })
}

export function removeSavedInfoItem(kind: InfoKind, id: string) {
  commit({ saved: getState().saved.filter((entry) => !(entry.kind === kind && entry.id === id)) })
}

export type FacultyPreference = FacultyResolution & {
  setFaculty: (faculty: string | null) => void
  /** Czy wybór przetrwa odświeżenie (dostępny `localStorage`). */
  persistent: boolean
}

/**
 * Wydział dla widoków informacyjnych. Kolejność rozstrzygania — patrz
 * `resolveFaculty`. Zmiana zapisuje się wyłącznie na urządzeniu.
 */
export function useFacultyPreference(input: {
  sessionUserId: string | null
  profileDepartment: string | null | undefined
}): FacultyPreference {
  const { prefs, persistent } = useInfoStore()
  const { sessionUserId, profileDepartment } = input
  const resolution = useMemo(
    () => resolveFaculty({ prefs, sessionUserId, profileDepartment }),
    [prefs, sessionUserId, profileDepartment],
  )
  const setFaculty = useCallback(
    (faculty: string | null) => {
      commit({ prefs: withFacultyChoice(getState().prefs, faculty, sessionUserId) })
    },
    [sessionUserId],
  )
  return { ...resolution, setFaculty, persistent }
}
