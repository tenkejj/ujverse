/**
 * UJverse — hook stanu subskrypcji wykładowców („Mój Plan").
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../lib/appToast'
import { DataService } from '../services/DataService'
import { deriveKeyClient } from '../services/adapters/LecturerSubscriptionsAdapter'
import type { LecturerSubscription } from '../types'

type Params = { userId: string | null }

function errorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : ''
  const t = `${code} ${msg}`.toLowerCase()
  if (
    code === '42P01' ||
    (t.includes('lecturer_subscriptions') && t.includes('does not exist')) ||
    t.includes('schema cache') ||
    t.includes('could not find the table')
  ) {
    return 'Brak tabeli subskrypcji w bazie. Wklej migrację 20260615100000_lecturer_subscriptions.sql w SQL Editorze Supabase.'
  }
  return 'Nie udało się zaktualizować subskrypcji. Spróbuj ponownie.'
}

export type UseLecturerSubscriptionsResult = {
  userId: string | null
  subscriptions: LecturerSubscription[]
  /** Set kluczy znormalizowanych dla O(1) lookupu „czy subskrybujesz X?". */
  subscribedKeys: ReadonlySet<string>
  loading: boolean
  /** Stabilny sprawdzacz — używa `deriveKeyClient`, dopasowuje do bazy SQL. */
  isSubscribed: (lecturerName: string) => boolean
  /** Toggle z optymistyczną aktualizacją + rollback przy błędzie. */
  toggle: (lecturerName: string) => Promise<void>
  /** Twarda usuwka po id (np. ze Settings). */
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Stan subskrypcji wykładowców dla zalogowanego usera.
 *
 * Optymistyka jest na poziomie *kluczy* (`subscribedKeys`) — UI bell-button
 * reaguje od razu, bez round-tripu, a docelowy wiersz dochodzi z bazy.
 * Rollback przy błędzie cofa zarówno klucz jak i tablicę.
 */
export function useLecturerSubscriptions({
  userId,
}: Params): UseLecturerSubscriptionsResult {
  const [subscriptions, setSubscriptions] = useState<LecturerSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const inflightToggles = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    if (!userId) {
      setSubscriptions([])
      return
    }
    setLoading(true)
    const { data, error } = await DataService.listLecturerSubscriptions(userId)
    setLoading(false)
    if (error) {
      console.warn('[useLecturerSubscriptions] refresh error', error)
      return
    }
    setSubscriptions(data)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribedKeys = useMemo(
    () => new Set(subscriptions.map((s) => s.lecturer_key)),
    [subscriptions],
  )

  const isSubscribed = useCallback(
    (lecturerName: string) => subscribedKeys.has(deriveKeyClient(lecturerName)),
    [subscribedKeys],
  )

  const toggle = useCallback(
    async (lecturerName: string) => {
      if (!userId) {
        toast.error('Zaloguj się, żeby subskrybować wykładowcę.')
        return
      }
      const trimmed = lecturerName.trim()
      if (!trimmed) return
      const key = deriveKeyClient(trimmed)
      if (!key) {
        toast.error('Nazwa wykładowcy wygląda na pustą po normalizacji.')
        return
      }
      if (inflightToggles.current.has(key)) return
      inflightToggles.current.add(key)

      const existing = subscriptions.find((s) => s.lecturer_key === key)
      const wasSubscribed = Boolean(existing)

      // Optymistyczna mutacja
      const optimisticRow: LecturerSubscription =
        existing ??
        ({
          id: -Date.now(),
          user_id: userId,
          display_name: trimmed,
          lecturer_key: key,
          created_at: new Date().toISOString(),
        } satisfies LecturerSubscription)

      if (wasSubscribed) {
        setSubscriptions((prev) => prev.filter((s) => s.lecturer_key !== key))
      } else {
        setSubscriptions((prev) => [optimisticRow, ...prev])
      }

      try {
        if (wasSubscribed && existing) {
          const { error } = await DataService.unsubscribeLecturer(userId, existing.id)
          if (error) throw error
          toast.success(`Odsubskrybowano: ${existing.display_name}`)
        } else {
          const { data, error } = await DataService.subscribeLecturer(userId, trimmed)
          if (error) throw error
          if (data) {
            setSubscriptions((prev) => [
              data,
              ...prev.filter((s) => s.lecturer_key !== data.lecturer_key && s.id !== optimisticRow.id),
            ])
          }
          toast.success(`Powiadomienia włączone: ${trimmed}`)
        }
      } catch (error) {
        // Rollback
        if (wasSubscribed && existing) {
          setSubscriptions((prev) => [existing, ...prev.filter((s) => s.id !== existing.id)])
        } else {
          setSubscriptions((prev) => prev.filter((s) => s.id !== optimisticRow.id))
        }
        toast.error(errorMessage(error), { id: 'lecturer-subscribe' })
      } finally {
        inflightToggles.current.delete(key)
      }
    },
    [subscriptions, userId],
  )

  const remove = useCallback(
    async (id: number) => {
      if (!userId) return
      const existing = subscriptions.find((s) => s.id === id)
      if (!existing) return
      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
      const { error } = await DataService.unsubscribeLecturer(userId, id)
      if (error) {
        setSubscriptions((prev) => [existing, ...prev.filter((s) => s.id !== id)])
        toast.error(errorMessage(error), { id: 'lecturer-subscribe' })
      } else {
        toast.success(`Odsubskrybowano: ${existing.display_name}`)
      }
    },
    [subscriptions, userId],
  )

  return useMemo(
    () => ({
      userId,
      subscriptions,
      subscribedKeys,
      loading,
      isSubscribed,
      toggle,
      remove,
      refresh,
    }),
    [isSubscribed, loading, refresh, remove, subscriptions, subscribedKeys, toggle, userId],
  )
}
