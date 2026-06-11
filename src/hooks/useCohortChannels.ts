/**
 * UJverse — useCohortChannels: state + Realtime dla sub-kanałów Auli.
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 *
 * Wymiar danych:
 *   - `channels`  = active sub-kanały (UI rail główna lista)
 *   - `archived`  = zarchiwizowane (accordion na dole rail)
 *   - virtual #general = `null` channel_id (nie ma rekordu, ale traktowany
 *     jak każdy aktywny kanał w UI)
 *
 * Slug ↔ id resolver honoruje reserved slug `general` → mapuje na
 * `activeChannelId = null` (#general).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../lib/appToast'
import { supabase } from '../supabaseClient'
import { CohortService } from '../services/CohortService'
import type { ChannelKind, CohortChannel } from '../types/database'

export const GENERAL_SLUG = 'general'

/**
 * `localStorage` key for last active channel slug per cohort.
 * Stored as JSON map: `{ [cohortId]: slug }`. Single key — łatwo wipe.
 */
const LAST_CHANNEL_STORAGE_KEY = 'ujverse.aula.lastChannelByCohort'

type LastChannelMap = Record<string, string>

function readLastChannelMap(): LastChannelMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LastChannelMap
    }
    return {}
  } catch {
    return {}
  }
}

function writeLastChannelMap(map: LastChannelMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* noop */
  }
}

/** Per-cohort read. Returns slug lub null gdy brak wpisu. */
export function readLastChannel(cohortId: string): string | null {
  const map = readLastChannelMap()
  const slug = map[cohortId]
  return typeof slug === 'string' && slug.length > 0 ? slug : null
}

/** Per-cohort write. Sluga `general` też zapisujemy (explicit choice). */
export function writeLastChannel(cohortId: string, slug: string): void {
  const map = readLastChannelMap()
  if (map[cohortId] === slug) return
  map[cohortId] = slug
  writeLastChannelMap(map)
}

/**
 * `localStorage` key for per-cohort kind filter (Set<ChannelKind>).
 * Stored as JSON map: `{ [cohortId]: ChannelKind[] }`. Sorted alphabetically
 * dla stabilnego JSON (łatwiejszy diff w devtools).
 */
const KIND_FILTER_STORAGE_KEY = 'ujverse.aula.channelKindFilter'

type KindFilterMap = Record<string, ChannelKind[]>

const ALL_KINDS: readonly ChannelKind[] = ['wyk', 'cw', 'lab', 'sem', 'proj', 'inne']

function isChannelKind(value: unknown): value is ChannelKind {
  return typeof value === 'string' && (ALL_KINDS as readonly string[]).includes(value)
}

function readKindFilterMap(): KindFilterMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KIND_FILTER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: KindFilterMap = {}
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          const sanitized = value.filter(isChannelKind)
          if (sanitized.length > 0) out[key] = sanitized
        }
      }
      return out
    }
    return {}
  } catch {
    return {}
  }
}

function writeKindFilterMap(map: KindFilterMap): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KIND_FILTER_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* noop */
  }
}

/** Per-cohort read. Returns sorted array (puste = brak filtru). */
export function readKindFilter(cohortId: string): ChannelKind[] {
  const map = readKindFilterMap()
  const arr = map[cohortId]
  return Array.isArray(arr) ? arr.filter(isChannelKind) : []
}

/** Per-cohort write. Pusty array → usuwa wpis (czyste localStorage). */
export function writeKindFilter(cohortId: string, kinds: ChannelKind[]): void {
  const map = readKindFilterMap()
  const sanitized = Array.from(new Set(kinds.filter(isChannelKind))).sort()
  const current = (map[cohortId] ?? []).join(',')
  if (current === sanitized.join(',')) return
  if (sanitized.length === 0) {
    delete map[cohortId]
  } else {
    map[cohortId] = sanitized
  }
  writeKindFilterMap(map)
}

type Params = {
  cohortId: string | null
}

/**
 * `activeChannelId` jest "kanonicznym" stanem aktywnego kanału:
 *   - `null` = #general (virtual)
 *   - `number` = konkretny sub-kanał
 *   - `undefined` jest niedozwolony (zawsze ma jakąś wartość po zamontowaniu)
 */
export type ActiveChannelId = number | null

export function useCohortChannels({ cohortId }: Params) {
  const [allChannels, setAllChannels] = useState<CohortChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChannelId, setActiveChannelIdState] = useState<ActiveChannelId>(null)
  const [kindFilter, setKindFilterState] = useState<Set<ChannelKind>>(new Set())
  const lastCohortRef = useRef<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!cohortId) {
      setAllChannels([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await CohortService.getChannels(cohortId)
    if (error) {
      console.error('[useCohortChannels] fetch', error.message)
      setAllChannels([])
    } else {
      setAllChannels(data)
    }
    setLoading(false)
  }, [cohortId])

  useEffect(() => {
    // Zmiana cohortu → reset active na #general (URL sync zrobi swoje
    // w AulaView, ale defensywnie chronimy przed wskazaniem id z innego
    // cohortu).
    if (lastCohortRef.current !== cohortId) {
      setActiveChannelIdState(null)
      if (cohortId) {
        setKindFilterState(new Set(readKindFilter(cohortId)))
      } else {
        setKindFilterState(new Set())
      }
      lastCohortRef.current = cohortId
    }
    void fetchAll()
  }, [cohortId, fetchAll])

  // Realtime: nowe / archived / unarchived kanały.
  useEffect(() => {
    if (!cohortId) return
    const channel = CohortService.subscribeToChannels(
      cohortId,
      {
        onInsert: (row) => {
          setAllChannels((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev
            return [...prev, row].sort(sortChannels)
          })
        },
        onUpdate: (row) => {
          setAllChannels((prev) =>
            prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)).sort(sortChannels),
          )
        },
        onDelete: (row) => {
          setAllChannels((prev) => prev.filter((c) => c.id !== row.id))
          // Jeśli aktywny kanał zniknął (service-role hard-delete) → fallback
          // na #general.
          setActiveChannelIdState((curr) => (curr === row.id ? null : curr))
        },
      },
    )
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cohortId])

  const channels = useMemo(
    () => allChannels.filter((c) => c.archived_at == null),
    [allChannels],
  )
  const archived = useMemo(
    () => allChannels.filter((c) => c.archived_at != null),
    [allChannels],
  )

  /**
   * Set wszystkich `kind` które obecnie mają **aktywne** sale w cohorcie.
   * Używamy w `ChannelRail` żeby zdecydować czy w ogóle pokazywać pigułki
   * filter — jeśli rocznik ma tylko 1 typ, filter byłby bezsensowny.
   */
  const availableKinds = useMemo<Set<ChannelKind>>(() => {
    const set = new Set<ChannelKind>()
    for (const c of channels) set.add(c.kind)
    return set
  }, [channels])

  const toggleKindFilter = useCallback(
    (kind: ChannelKind) => {
      setKindFilterState((prev) => {
        const next = new Set(prev)
        if (next.has(kind)) next.delete(kind)
        else next.add(kind)
        if (cohortId) writeKindFilter(cohortId, Array.from(next))
        return next
      })
    },
    [cohortId],
  )

  const clearKindFilter = useCallback(() => {
    setKindFilterState((prev) => {
      if (prev.size === 0) return prev
      if (cohortId) writeKindFilter(cohortId, [])
      return new Set()
    })
  }, [cohortId])

  const channelsById = useMemo(() => {
    const m = new Map<number, CohortChannel>()
    for (const c of allChannels) m.set(c.id, c)
    return m
  }, [allChannels])

  const channelsBySlug = useMemo(() => {
    const m = new Map<string, CohortChannel>()
    for (const c of allChannels) m.set(c.slug, c)
    return m
  }, [allChannels])

  const activeChannel = useMemo<CohortChannel | null>(
    () => (activeChannelId == null ? null : channelsById.get(activeChannelId) ?? null),
    [activeChannelId, channelsById],
  )

  /**
   * Slug → ActiveChannelId. `general` (lub null/undefined slug) → null.
   * Nieznany slug też → null (graceful fallback — AulaView pokaże #general).
   */
  const resolveSlugToChannelId = useCallback(
    (slug: string | null | undefined): ActiveChannelId => {
      if (!slug || slug === GENERAL_SLUG) return null
      const ch = channelsBySlug.get(slug)
      return ch ? ch.id : null
    },
    [channelsBySlug],
  )

  /**
   * ActiveChannelId → slug. `null` → `'general'`. Używamy przy budowaniu URL
   * (`?channel=<slug>`).
   */
  const resolveChannelIdToSlug = useCallback(
    (id: ActiveChannelId): string => {
      if (id == null) return GENERAL_SLUG
      const ch = channelsById.get(id)
      return ch?.slug ?? GENERAL_SLUG
    },
    [channelsById],
  )

  const setActiveChannelId = useCallback((id: ActiveChannelId) => {
    setActiveChannelIdState(id)
  }, [])

  const setActiveChannelBySlug = useCallback(
    (slug: string | null | undefined) => {
      setActiveChannelIdState(resolveSlugToChannelId(slug))
    },
    [resolveSlugToChannelId],
  )

  const createChannel = useCallback(
    async (params: {
      userId: string
      slug: string
      name: string
      description?: string | null
      kind?: ChannelKind
    }): Promise<CohortChannel | null> => {
      if (!cohortId) return null
      const { data, error } = await CohortService.createChannel({
        cohortId,
        userId: params.userId,
        slug: params.slug,
        name: params.name,
        description: params.description,
        kind: params.kind,
      })
      if (error || !data) {
        const msg = error?.message ?? ''
        if (msg.includes('cohort_channels_slug_unique') || msg.includes('duplicate key')) {
          toast.error('Sala o tym slug już istnieje.')
        } else if (msg.includes('cohort_channels_slug_check')) {
          toast.error('Niedozwolony slug.')
        } else if (msg.includes('cohort_channels_kind_check')) {
          toast.error('Niedozwolony typ sali.')
        } else {
          toast.error('Nie udało się utworzyć sali.')
        }
        return null
      }
      setAllChannels((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [...prev, data].sort(sortChannels)
      })
      setActiveChannelIdState(data.id)
      toast.success(`Stworzono salę: ${data.name}`)
      return data
    },
    [cohortId],
  )

  const updateChannel = useCallback(
    async (
      channelId: number,
      patch: { name?: string; description?: string | null; kind?: ChannelKind },
    ): Promise<boolean> => {
      const { data, error } = await CohortService.updateChannel(channelId, patch)
      if (error || !data) {
        toast.error('Nie udało się zapisać zmian sali.')
        return false
      }
      setAllChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, ...data } : c)).sort(sortChannels),
      )
      toast.success('Zapisano zmiany sali.')
      return true
    },
    [],
  )

  const archiveChannel = useCallback(
    async (channelId: number): Promise<boolean> => {
      // Pobierz nazwę PRZED update — po archiwizacji może już jej nie być
      // w UI listach (filter `archived_at != null` przerzuca do archived
      // bucket).
      const nameBefore =
        allChannels.find((c) => c.id === channelId)?.name ?? null
      const { error } = await CohortService.archiveChannel(channelId)
      if (error) {
        toast.error('Nie udało się zarchiwizować sali.')
        return false
      }
      setAllChannels((prev) =>
        prev
          .map((c) => (c.id === channelId ? { ...c, archived_at: new Date().toISOString() } : c))
          .sort(sortChannels),
      )
      // Auto-switch na Salę główną jeśli to była aktywna sala (kompozytor
      // disabled na archived).
      setActiveChannelIdState((curr) => (curr === channelId ? null : curr))
      if (nameBefore) toast.success(`Zarchiwizowano salę: ${nameBefore}.`)
      else toast.success('Zarchiwizowano salę.')
      return true
    },
    [allChannels],
  )

  const unarchiveChannel = useCallback(
    async (channelId: number): Promise<boolean> => {
      const nameBefore =
        allChannels.find((c) => c.id === channelId)?.name ?? null
      const { error } = await CohortService.unarchiveChannel(channelId)
      if (error) {
        toast.error('Nie udało się przywrócić sali.')
        return false
      }
      setAllChannels((prev) =>
        prev
          .map((c) => (c.id === channelId ? { ...c, archived_at: null } : c))
          .sort(sortChannels),
      )
      if (nameBefore) toast.success(`Przywrócono salę: ${nameBefore}.`)
      else toast.success('Przywrócono salę.')
      return true
    },
    [allChannels],
  )

  return useMemo(
    () => ({
      channels,
      archived,
      allChannels,
      activeChannelId,
      activeChannel,
      loading,
      kindFilter,
      availableKinds,
      toggleKindFilter,
      clearKindFilter,
      setActiveChannelId,
      setActiveChannelBySlug,
      resolveSlugToChannelId,
      resolveChannelIdToSlug,
      createChannel,
      updateChannel,
      archiveChannel,
      unarchiveChannel,
      refetch: fetchAll,
    }),
    [
      channels,
      archived,
      allChannels,
      activeChannelId,
      activeChannel,
      loading,
      kindFilter,
      availableKinds,
      toggleKindFilter,
      clearKindFilter,
      setActiveChannelId,
      setActiveChannelBySlug,
      resolveSlugToChannelId,
      resolveChannelIdToSlug,
      createChannel,
      updateChannel,
      archiveChannel,
      unarchiveChannel,
      fetchAll,
    ],
  )
}

/**
 * Sort: aktywne najpierw (archived_at NULLS FIRST), wewnątrz po
 * `created_at DESC` (mirror SQL index). UI dzieli na buckety, ale lista
 * `allChannels` jest spójna z DB.
 */
function sortChannels(a: CohortChannel, b: CohortChannel): number {
  const aArch = a.archived_at != null
  const bArch = b.archived_at != null
  if (aArch !== bArch) return aArch ? 1 : -1
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

/** Walidacja sluga zgodna z CHECK w SQL. */
export function isValidChannelSlug(slug: string): boolean {
  if (slug === GENERAL_SLUG) return false
  return /^[a-z0-9][a-z0-9_-]{0,30}$/.test(slug)
}

/** Auto-derive slug z `name` (kebab-case, ASCII-only, max 31 znaków). */
export function deriveSlugFromName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 31)
  return cleaned
}
