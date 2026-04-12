import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import type { AcademicAnnouncement, AnnouncementStatus } from '../types'

function parseRow(row: Record<string, unknown>): AcademicAnnouncement | null {
  const id = row.id
  const lecturer_name = row.lecturer_name
  const body = row.body
  const status = row.status
  const created_at = row.created_at
  if (typeof id !== 'string' || typeof lecturer_name !== 'string' || typeof body !== 'string') return null
  if (typeof created_at !== 'string') return null
  if (status !== 'cancelled' && status !== 'remote' && status !== 'duty') return null
  const department =
    row.department === null || row.department === undefined
      ? null
      : typeof row.department === 'string'
        ? row.department
        : null
  const body_fingerprint =
    row.body_fingerprint === null || row.body_fingerprint === undefined
      ? null
      : typeof row.body_fingerprint === 'string'
        ? row.body_fingerprint
        : null
  return {
    id,
    body_fingerprint,
    department,
    lecturer_name,
    body,
    status: status as AnnouncementStatus,
    created_at,
  }
}

/** Odwołane na górze, potem malejąco po created_at. */
export function sortAnnouncements(rows: AcademicAnnouncement[]): AcademicAnnouncement[] {
  return [...rows].sort((a, b) => {
    const ac = a.status === 'cancelled' ? 0 : 1
    const bc = b.status === 'cancelled' ? 0 : 1
    if (ac !== bc) return ac - bc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

async function fetchAnnouncements(): Promise<{
  rows: AcademicAnnouncement[]
  error: string | null
}> {
  const { data, error: qError } = await supabase
    .from('announcements')
    .select('id, body_fingerprint, department, lecturer_name, body, status, created_at')
    .order('created_at', { ascending: false })

  if (qError) {
    return { rows: [], error: qError.message }
  }

  const rows = Array.isArray(data)
    ? data
        .map((r) => parseRow(r as Record<string, unknown>))
        .filter((x): x is AcademicAnnouncement => x !== null)
    : []
  return { rows: sortAnnouncements(rows), error: null }
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<AcademicAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    const { rows, error: fetchErr } = await fetchAnnouncements()
    if (!aliveRef.current) return
    if (!silent) setLoading(false)
    if (fetchErr) {
      setError(fetchErr)
      setAnnouncements([])
      return
    }
    setError(null)
    setAnnouncements(rows)
  }, [])

  useEffect(() => {
    aliveRef.current = true

    void load({ silent: false })

    const channel = supabase
      .channel('announcements-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        () => {
          void load({ silent: true })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        () => {
          void load({ silent: true })
        },
      )
      .subscribe()

    return () => {
      aliveRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [load])

  return { announcements, loading, error }
}
