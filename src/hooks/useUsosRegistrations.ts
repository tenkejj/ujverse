/**
 * UJverse — useUsosRegistrations: lista rejestracji + subskrypcje + realtime.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Zarządza:
 *   - lista rejestracji (po filtrze)
 *   - set ID-ków zasubskrybowanych przez user'a
 *   - lista nadchodzących subskrypcji (z RPC, do bannera alarmu)
 *
 * Optimistic `toggleSubscribe(id)`:
 *   - od razu add/remove z `mySubscribedIds`, bumpuje `subscriber_count`
 *   - przy błędzie network — rollback
 *
 * Realtime:
 *   - subskrypcja na `usos_registrations` INSERT/UPDATE — żeby nowe wpisy /
 *     przesunięcia terminów leciały live
 *   - własna subscriptions table — własne mutacje przez optimistic, więc
 *     subskrybujemy tylko żeby cudze subscribe-y mogły bumpować counter
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { UsosRegistrationsService } from '../services/UsosRegistrationsService'
import { supabase } from '../supabaseClient'
import type {
  MyUpcomingRegistration,
  RegistrationFilter,
  UsosRegistration,
} from '../types/usosRegistrations'

type Params = {
  userId: string | null
  studyProgram?: string | null
  yearStarted?: number | null
}

/**
 * Akademicki rok zaczyna się w październiku.
 *   year_started=2024, now=cze 2025 → I rok
 *   year_started=2024, now=paź 2025 → II rok
 */
export function currentStudyYear(yearStarted: number, now: Date = new Date()): number {
  const currentYear = now.getFullYear()
  const academicYear = now.getMonth() >= 9 ? currentYear : currentYear - 1
  return Math.max(1, academicYear - yearStarted + 1)
}

export function useUsosRegistrations({ userId, studyProgram, yearStarted }: Params) {
  const [filter, setFilter] = useState<RegistrationFilter>({
    kind: 'all',
    search: '',
    sort: 'opens',
    myProgramOnly: false,
    subscribedOnly: false,
  })
  const [registrations, setRegistrations] = useState<UsosRegistration[]>([])
  const [mySubscribedIds, setMySubscribedIds] = useState<Set<string>>(new Set())
  const [upcoming, setUpcoming] = useState<MyUpcomingRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [upcomingLoading, setUpcomingLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const derivedYear =
    typeof yearStarted === 'number' ? currentStudyYear(yearStarted) : null

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: list, error: listErr }, { data: subs }] = await Promise.all([
      UsosRegistrationsService.list(filter, {
        studyProgram: studyProgram ?? null,
        year: derivedYear,
      }),
      userId
        ? UsosRegistrationsService.getMySubscribedIds(userId)
        : Promise.resolve({ data: new Set<string>(), error: null }),
    ])
    setLoading(false)
    if (userIdRef.current !== userId) return
    if (listErr) {
      setError(listErr.message)
      return
    }
    setError(null)
    // subscribedOnly filtruje JS-side (bo lista subskrypcji jest local)
    if (filter.subscribedOnly && subs) {
      setRegistrations(list.filter((r) => subs.has(r.id)))
    } else {
      setRegistrations(list)
    }
    setMySubscribedIds(subs)
  }, [filter, userId, studyProgram, derivedYear])

  const refreshUpcoming = useCallback(async () => {
    if (!userId) {
      setUpcoming([])
      setUpcomingLoading(false)
      return
    }
    setUpcomingLoading(true)
    const { data, error: err } = await UsosRegistrationsService.getMyUpcoming(userId)
    setUpcomingLoading(false)
    if (err) return
    setUpcoming(data)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    void refreshUpcoming()
  }, [refreshUpcoming])

  // Realtime — nowe wpisy + update terminów
  useEffect(() => {
    const channel = supabase
      .channel('usos_registrations_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'usos_registrations' },
        (payload) => {
          const row = payload.new as UsosRegistration
          setRegistrations((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'usos_registrations' },
        (payload) => {
          const row = payload.new as UsosRegistration
          setRegistrations((prev) => prev.map((r) => (r.id === row.id ? row : r)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'usos_registrations' },
        (payload) => {
          const old = payload.old as { id: string }
          setRegistrations((prev) => prev.filter((r) => r.id !== old.id))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const toggleSubscribe = useCallback(
    async (registrationId: string) => {
      if (!userId) return
      const isSubscribed = mySubscribedIds.has(registrationId)

      // Optimistic flip
      setMySubscribedIds((prev) => {
        const next = new Set(prev)
        if (isSubscribed) next.delete(registrationId)
        else next.add(registrationId)
        return next
      })
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === registrationId
            ? { ...r, subscriber_count: Math.max(0, r.subscriber_count + (isSubscribed ? -1 : 1)) }
            : r,
        ),
      )

      const { error: err } = isSubscribed
        ? await UsosRegistrationsService.unsubscribe(registrationId, userId)
        : await UsosRegistrationsService.subscribe(registrationId, userId)

      if (err) {
        setMySubscribedIds((prev) => {
          const next = new Set(prev)
          if (isSubscribed) next.add(registrationId)
          else next.delete(registrationId)
          return next
        })
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === registrationId
              ? { ...r, subscriber_count: Math.max(0, r.subscriber_count + (isSubscribed ? 1 : -1)) }
              : r,
          ),
        )
        return
      }
      // odśwież listę nadchodzących (banner alarmu)
      void refreshUpcoming()
    },
    [mySubscribedIds, userId, refreshUpcoming],
  )

  const dismissAlarm = useCallback(
    async (registrationId: string) => {
      if (!userId) return
      setUpcoming((prev) =>
        prev.map((u) =>
          u.registration_id === registrationId
            ? { ...u, dismissed_at: new Date().toISOString() }
            : u,
        ),
      )
      await UsosRegistrationsService.markDismissed(registrationId, userId)
    },
    [userId],
  )

  return {
    filter,
    setFilter,
    registrations,
    mySubscribedIds,
    upcoming,
    loading,
    upcomingLoading,
    error,
    refresh,
    refreshUpcoming,
    toggleSubscribe,
    dismissAlarm,
    derivedYear,
    studyProgram: studyProgram ?? null,
  }
}
