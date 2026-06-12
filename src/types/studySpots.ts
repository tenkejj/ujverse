/**
 * UJverse — Study Spots: typy + helpery.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import {
  BookOpen,
  Coffee,
  Trees,
  Building2,
  Laptop,
  Library,
  type LucideIcon,
} from 'lucide-react'

export const STUDY_SPOT_KINDS = [
  'library_uj',
  'library_other',
  'cafe',
  'coworking',
  'courtyard',
  'akademik',
  'other',
] as const

export type StudySpotKind = (typeof STUDY_SPOT_KINDS)[number]

export type StudySpotKindMeta = {
  label: string
  icon: LucideIcon
  /** Tailwind tint class for kind badge */
  tintClass: string
}

export const STUDY_SPOT_KIND_META: Record<StudySpotKind, StudySpotKindMeta> = {
  library_uj: {
    label: 'Biblioteka UJ',
    icon: Library,
    tintClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  library_other: {
    label: 'Biblioteka',
    icon: BookOpen,
    tintClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  },
  cafe: {
    label: 'Kawiarnia',
    icon: Coffee,
    tintClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
  coworking: {
    label: 'Coworking',
    icon: Laptop,
    tintClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  },
  courtyard: {
    label: 'Plener / dziedziniec',
    icon: Trees,
    tintClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  akademik: {
    label: 'Akademik',
    icon: Building2,
    tintClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  other: {
    label: 'Inne',
    icon: Building2,
    tintClass: 'bg-stone-100 text-stone-700 dark:bg-stone-500/15 dark:text-stone-300',
  },
}

export const STUDY_SPOT_MOODS = ['focus', 'casual', 'group'] as const
export type StudySpotMood = (typeof STUDY_SPOT_MOODS)[number]

export const MOOD_META: Record<StudySpotMood, { label: string; emoji: string; tintClass: string }> = {
  focus: { label: 'Focus', emoji: '🎯', tintClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  casual: { label: 'Luźno', emoji: '☕', tintClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  group: { label: 'Grupowo', emoji: '👥', tintClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
}

export type StudySpot = {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  kind: StudySpotKind
  building_id: string | null
  description: string | null
  hours_text: string | null
  photo_urls: string[]
  wifi_quality: number | null
  silence_level: number | null
  sockets_count_estimate: number | null
  tags: string[]
  website_url: string | null
  google_maps_url: string | null
  is_free: boolean
  price_hint: string | null
  rating_avg: number | null
  rating_count: number
  active_checkins_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Output z RPC `get_study_spots_full(p_user_id)` — wszystko z `study_spots` + user state. */
export type StudySpotWithUserState = StudySpot & {
  my_rating: number | null
  my_active_checkin_id: string | null
  my_active_checkin_mood: StudySpotMood | null
  my_active_checkin_expires_at: string | null
}

export type StudySpotCheckin = {
  id: string
  spot_id: string
  user_id: string
  mood: StudySpotMood
  checked_in_at: string
  checked_out_at: string | null
  expires_at: string
  comment: string | null
}

/** Output z RPC `get_active_checkins_with_profiles(p_spot_id)`. */
export type ActiveCheckinWithProfile = {
  checkin_id: string
  user_id: string
  mood: StudySpotMood
  checked_in_at: string
  expires_at: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

export type StudySpotRating = {
  id: string
  spot_id: string
  user_id: string
  overall: number
  wifi: number | null
  silence: number | null
  sockets: number | null
  comfort: number | null
  comment: string | null
  created_at: string
  updated_at: string
}

export type StudySpotFilter = {
  kind: StudySpotKind | 'all'
  search: string
  /** Pokazuj tylko wolne miejsca (is_free=true). */
  freeOnly: boolean
  /** Pokazuj tylko miejsca z aktywnymi check-insami. */
  withPeopleOnly: boolean
  sort: 'people' | 'rating' | 'name'
}

export const DEFAULT_FILTER: StudySpotFilter = {
  kind: 'all',
  search: '',
  freeOnly: false,
  withPeopleOnly: false,
  sort: 'people',
}

export type StudySpotCreateInput = {
  name: string
  address: string
  lat: number
  lng: number
  kind: StudySpotKind
  description?: string | null
  hours_text?: string | null
  tags?: string[]
  website_url?: string | null
  google_maps_url?: string | null
  is_free?: boolean
  price_hint?: string | null
}

/** Helpery formatowania */
export function formatRating(rating: number | null, count: number): string {
  if (rating === null || count === 0) return 'Brak ocen'
  return `${rating.toFixed(1)} (${count})`
}

export function timeRemainingMs(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

export function formatTimeRemaining(expiresAt: string): string {
  const ms = timeRemainingMs(expiresAt)
  if (ms === 0) return 'wygasł'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m`
}
