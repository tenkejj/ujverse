/**
 * UJverse — useStudySpots: zarządzanie listą miejsc nauki + filtry + check-in.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wzór skopiowany z `useUsosRegistrations.ts`:
 *   - jedno `getAllWithMyState(userId)` na mount + przy zmianach
 *   - Realtime subscription na `study_spot_checkins` (insert/update/delete)
 *     → debounce 500ms → refetch (cheap, bo RPC zwraca wszystko jednym
 *     strzałem)
 *   - Optymistyczne `toggleCheckIn` z rollback na error
 *   - Filtering po stronie klienta (mało spotów, ~20-100 docelowo)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { StudySpotsService } from '../services/StudySpotsService'
import type { Session } from '@supabase/supabase-js'
import type {
  StudySpotCreateInput,
  StudySpotFilter,
  StudySpotMood,
  StudySpotWithUserState,
} from '../types/studySpots'
import { DEFAULT_FILTER } from '../types/studySpots'

type Options = {
  session: Session | null
}

export function useStudySpots({ session }: Options) {
  const [spots, setSpots] = useState<StudySpotWithUserState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StudySpotFilter>(DEFAULT_FILTER)
  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userId = session?.user?.id ?? null

  const refetch = useCallback(async () => {
    if (!userId) {
      setSpots([])
      setLoading(false)
      return
    }
    const { data, error: rpcError } = await StudySpotsService.getAllWithMyState(userId)
    if (rpcError) {
      setError(rpcError.message)
    } else {
      setError(null)
      setSpots(data)
    }
    setLoading(false)
  }, [userId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  // Realtime presence — debounced refetch przy zmianach check-inów
  // (insert / update / delete). 500ms debounce żeby seria mutacji
  // nie szarpała listą.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`study_spots_presence_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_spot_checkins' },
        () => {
          if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current)
          refetchDebounceRef.current = setTimeout(() => {
            void refetch()
          }, 500)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'study_spot_ratings' },
        () => {
          if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current)
          refetchDebounceRef.current = setTimeout(() => {
            void refetch()
          }, 800)
        },
      )
      .subscribe()
    return () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [userId, refetch])

  const filteredSpots = useMemo(() => {
    let s = spots
    if (filter.kind !== 'all') s = s.filter((x) => x.kind === filter.kind)
    if (filter.freeOnly) s = s.filter((x) => x.is_free)
    if (filter.withPeopleOnly) s = s.filter((x) => x.active_checkins_count > 0)
    if (filter.search.trim()) {
      const term = filter.search.trim().toLowerCase()
      s = s.filter((x) => {
        const haystack = [x.name, x.address, x.description, ...x.tags]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
    }
    // Sort
    const sorted = [...s]
    if (filter.sort === 'people') {
      sorted.sort((a, b) => {
        if (b.active_checkins_count !== a.active_checkins_count) {
          return b.active_checkins_count - a.active_checkins_count
        }
        return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
      })
    } else if (filter.sort === 'rating') {
      sorted.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    }
    return sorted
  }, [spots, filter])

  /** Mój aktualny aktywny check-in (jeśli istnieje). */
  const myActiveSpot = useMemo(
    () => spots.find((s) => s.my_active_checkin_id) ?? null,
    [spots],
  )

  // -------------------------------------------------------------------
  // Mutators (optymistyczne)
  // -------------------------------------------------------------------

  const toggleCheckIn = useCallback(
    async (spotId: string, mood: StudySpotMood = 'focus') => {
      if (!userId) return { ok: false, error: 'not-logged-in' }

      const target = spots.find((s) => s.id === spotId)
      if (!target) return { ok: false, error: 'spot-not-found' }

      const isCheckedInHere = !!target.my_active_checkin_id
      const previousSpots = spots

      // Optymistyczny update
      setSpots((prev) =>
        prev.map((s) => {
          if (s.id === spotId) {
            return isCheckedInHere
              ? {
                  ...s,
                  my_active_checkin_id: null,
                  my_active_checkin_mood: null,
                  my_active_checkin_expires_at: null,
                  active_checkins_count: Math.max(0, s.active_checkins_count - 1),
                }
              : {
                  ...s,
                  my_active_checkin_id: 'pending',
                  my_active_checkin_mood: mood,
                  my_active_checkin_expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
                  active_checkins_count: s.active_checkins_count + 1,
                }
          }
          // Jeśli check-inujemy gdzie indziej, decrement licznika starego miejsca
          if (!isCheckedInHere && s.my_active_checkin_id) {
            return {
              ...s,
              my_active_checkin_id: null,
              my_active_checkin_mood: null,
              my_active_checkin_expires_at: null,
              active_checkins_count: Math.max(0, s.active_checkins_count - 1),
            }
          }
          return s
        }),
      )

      const result = isCheckedInHere
        ? await StudySpotsService.checkoutActive(userId)
        : await StudySpotsService.checkIn(spotId, userId, mood)

      if (result.error) {
        setSpots(previousSpots)
        return { ok: false, error: result.error.message }
      }
      // Refetch żeby mieć prawdziwe checkin_id zamiast 'pending'
      void refetch()
      return { ok: true, error: null }
    },
    [userId, spots, refetch],
  )

  const submitRating = useCallback(
    async (
      spotId: string,
      overall: number,
      extra?: {
        wifi?: number | null
        silence?: number | null
        sockets?: number | null
        comfort?: number | null
        comment?: string | null
      },
    ) => {
      if (!userId) return { ok: false, error: 'not-logged-in' }
      const { error: ratingError } = await StudySpotsService.upsertRating(
        spotId,
        userId,
        overall,
        extra,
      )
      if (ratingError) return { ok: false, error: ratingError.message }
      void refetch()
      return { ok: true, error: null }
    },
    [userId, refetch],
  )

  const createSpot = useCallback(
    async (input: StudySpotCreateInput) => {
      if (!userId) return { ok: false, error: 'not-logged-in' }
      const { error: createError } = await StudySpotsService.create(input, userId)
      if (createError) return { ok: false, error: createError.message }
      void refetch()
      return { ok: true, error: null }
    },
    [userId, refetch],
  )

  const uploadPhoto = useCallback(
    async (spotId: string, file: File) => {
      if (!userId) return { publicUrl: null, error: 'not-logged-in' }
      const result = await StudySpotsService.uploadPhoto(spotId, userId, file)
      if (!result.error) void refetch()
      return result
    },
    [userId, refetch],
  )

  const removePhoto = useCallback(
    async (spotId: string, photoUrl: string) => {
      const result = await StudySpotsService.removePhoto(spotId, photoUrl)
      if (!result.error) void refetch()
      return result
    },
    [refetch],
  )

  return {
    spots: filteredSpots,
    allSpots: spots,
    myActiveSpot,
    loading,
    error,
    filter,
    setFilter,
    refetch,
    toggleCheckIn,
    submitRating,
    createSpot,
    uploadPhoto,
    removePhoto,
  }
}
