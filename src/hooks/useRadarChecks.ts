import { useSyncExternalStore } from 'react'
import {
  parseRadarChecks,
  RADAR_CHECKS_KEY,
  serializeRadarChecks,
  withRadarCheck,
  type RadarChecks,
} from '../lib/info/radarChecks'

type Snapshot = { checks: RadarChecks; persistent: boolean }
let snapshot: Snapshot | null = null
const listeners = new Set<() => void>()
const emptySnapshot: Snapshot = { checks: {}, persistent: false }

function read(): Snapshot {
  if (typeof window === 'undefined') return emptySnapshot
  try {
    return {
      checks: parseRadarChecks(localStorage.getItem(RADAR_CHECKS_KEY)),
      persistent: true,
    }
  } catch {
    return emptySnapshot
  }
}
function getSnapshot() {
  if (!snapshot) snapshot = read()
  return snapshot
}
function emit() {
  for (const listener of listeners) listener()
}
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== RADAR_CHECKS_KEY) return
  snapshot = read()
  emit()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', onStorage)
  }
}
export function setRadarChecked(key: string, checked: boolean) {
  const current = getSnapshot()
  const checks = withRadarCheck(current.checks, key, checked)
  let persistent = current.persistent
  if (persistent) {
    try {
      localStorage.setItem(RADAR_CHECKS_KEY, serializeRadarChecks(checks))
    } catch {
      persistent = false
    }
  }
  snapshot = { checks, persistent }
  emit()
}
export function useRadarChecks() {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot)
}
