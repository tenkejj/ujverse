import { useMemo, useSyncExternalStore } from 'react'
import {
  getStudyProfileServerSnapshot,
  getStudyProfileSnapshot,
  resolveStudyContext,
  subscribeStudyProfile,
} from '../lib/info/studyProfile'

/** Programme selection supplements the existing faculty filter; it never rewrites an account. */
export function useStudyProfile(faculty: string | null) {
  const { profile, persistent } = useSyncExternalStore(
    subscribeStudyProfile,
    getStudyProfileSnapshot,
    getStudyProfileServerSnapshot,
  )
  const context = useMemo(
    () => resolveStudyContext(profile, faculty),
    [profile, faculty],
  )
  return { ...context, storedProfile: profile, persistent }
}
