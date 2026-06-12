/**
 * UJverse — useDiscounts: lista + filtry + use tracking dla "Couponek UJ".
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Trzyma cztery state'y w jednym miejscu:
 *   - lista zniżek (po filtrze)
 *   - top trending (RPC `trending_discounts` 7-day window)
 *   - set ID-ków "moich" użytych zniżek
 *   - geolokalizacja usera (opcjonalna, dla dystansów)
 *
 * Optimistic `markUse(id)`:
 *   - od razu dodaje do `myUsedIds`, bumpuje `use_count` na karcie
 *   - wywołuje RPC; przy `already_used=true` cofa bump (server jest prawdą)
 *   - przy błędzie network — rollback set + count
 *
 * Realtime:
 *   - subskrypcja na `student_discount_uses` INSERT — bumpujemy lokalnie
 *     `use_count` dla *cudzych* uses. Ignorujemy własne (już dodaliśmy
 *     optymistycznie).
 *   - subskrypcja na `student_discounts` INSERT — prepend nowej.
 *
 * Geo:
 *   - `requestGeo()` używa `navigator.geolocation.getCurrentPosition` —
 *     wymagane explicit user click (privacy). Cache w localStorage 1h.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DiscountsService } from '../services/DiscountsService'
import { supabase } from '../supabaseClient'
import type { StudentDiscount, DiscountFilter, DiscountWithDistance } from '../types/discounts'

const GEO_CACHE_KEY = 'ujverse.discounts.geo.v1'
const GEO_CACHE_TTL_MS = 60 * 60 * 1000

type GeoCache = { lat: number; lng: number; ts: number }

type Params = {
  userId: string | null
}

function readGeoCache(): GeoCache | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GeoCache>
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.ts !== 'number'
    ) {
      return null
    }
    if (Date.now() - parsed.ts > GEO_CACHE_TTL_MS) return null
    return parsed as GeoCache
  } catch {
    return null
  }
}

function writeGeoCache(lat: number, lng: number) {
  try {
    const payload: GeoCache = { lat, lng, ts: Date.now() }
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371_000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function useDiscounts({ userId }: Params) {
  const [filter, setFilter] = useState<DiscountFilter>({
    category: 'all',
    search: '',
    sort: 'use',
    verifiedOnly: false,
  })
  const [discounts, setDiscounts] = useState<StudentDiscount[]>([])
  const [trending, setTrending] = useState<Array<StudentDiscount & { recentUses: number }>>([])
  const [myUsedIds, setMyUsedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(() => {
    const cached = readGeoCache()
    return cached ? { lat: cached.lat, lng: cached.lng } : null
  })
  const [geoStatus, setGeoStatus] = useState<'idle' | 'pending' | 'ok' | 'denied' | 'error'>(
    () => (readGeoCache() ? 'ok' : 'idle'),
  )

  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [{ data: list, error: listErr }, { data: used }] = await Promise.all([
      DiscountsService.list(filter),
      userId ? DiscountsService.getMyUsedDiscountIds(userId) : Promise.resolve({ data: new Set<string>(), error: null }),
    ])
    setLoading(false)
    if (userIdRef.current !== userId) return
    if (listErr) {
      setError(listErr.message)
      return
    }
    setError(null)
    setDiscounts(list)
    setMyUsedIds(used)
  }, [filter, userId])

  const refreshTrending = useCallback(async () => {
    setTrendingLoading(true)
    const { data, error } = await DiscountsService.trending(5)
    setTrendingLoading(false)
    if (error) return
    setTrending(data)
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { void refreshTrending() }, [refreshTrending])

  // Realtime: nowe zniżki + nowe uses
  useEffect(() => {
    const channel = supabase
      .channel('student_discounts_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_discounts' }, (payload) => {
        const row = payload.new as StudentDiscount
        if (row.hidden_at) return
        // Prepend tylko gdy match z aktualnym filtrem (proste check).
        if (filter.category !== 'all' && row.category !== filter.category) return
        setDiscounts((prev) => (prev.some((d) => d.id === row.id) ? prev : [row, ...prev]))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_discount_uses' }, (payload) => {
        const row = payload.new as { discount_id: string; user_id: string }
        // Bump use_count w lokalnej liście; ignoruj własne (już optymistycznie).
        if (row.user_id === userIdRef.current) return
        setDiscounts((prev) => prev.map((d) => (d.id === row.discount_id ? { ...d, use_count: d.use_count + 1 } : d)))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [filter.category])

  const markUse = useCallback(
    async (discountId: string) => {
      if (!userId) return
      const wasUsed = myUsedIds.has(discountId)
      if (wasUsed) return // idempotent — nic do roboty

      // Optimistic
      setMyUsedIds((prev) => {
        const next = new Set(prev)
        next.add(discountId)
        return next
      })
      setDiscounts((prev) => prev.map((d) => (d.id === discountId ? { ...d, use_count: d.use_count + 1 } : d)))

      const { useCount, alreadyUsed, error: err } = await DiscountsService.markUse(discountId)
      if (err) {
        // rollback
        setMyUsedIds((prev) => {
          const next = new Set(prev)
          next.delete(discountId)
          return next
        })
        setDiscounts((prev) => prev.map((d) => (d.id === discountId ? { ...d, use_count: Math.max(0, d.use_count - 1) } : d)))
        return
      }
      if (alreadyUsed) {
        // server widział wcześniejszy use — cofaj nasz optymistyczny bump
        setDiscounts((prev) => prev.map((d) => (d.id === discountId ? { ...d, use_count: useCount } : d)))
      } else {
        setDiscounts((prev) => prev.map((d) => (d.id === discountId ? { ...d, use_count: useCount } : d)))
      }
    },
    [myUsedIds, userId],
  )

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      return
    }
    setGeoStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setGeo({ lat: latitude, lng: longitude })
        setGeoStatus('ok')
        writeGeoCache(latitude, longitude)
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: false, maximumAge: 15 * 60_000, timeout: 8000 },
    )
  }, [])

  /** Lista z dystansem (gdy mamy geo) — używana przez UI dla pill "≤500m". */
  const discountsWithDistance = useMemo<DiscountWithDistance[]>(() => {
    return discounts.map((d) => {
      if (!geo || d.lat == null || d.lng == null) return { ...d, distanceMeters: null }
      return { ...d, distanceMeters: haversineMeters(geo, { lat: d.lat, lng: d.lng }) }
    })
  }, [discounts, geo])

  return {
    filter,
    setFilter,
    discounts: discountsWithDistance,
    trending,
    myUsedIds,
    loading,
    trendingLoading,
    error,
    refresh,
    refreshTrending,
    markUse,
    geo,
    geoStatus,
    requestGeo,
  }
}
