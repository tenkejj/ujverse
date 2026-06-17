/**
 * Podgląd i czyszczenie pamięci Versusia (`/api/me/memory`).
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from '../lib/appToast'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const MEMORY_ENDPOINT = `${API_BASE}/api/me/memory`

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export type UseVersusMemoryResult = {
  facts: readonly string[]
  loading: boolean
  clearing: boolean
  refresh: () => Promise<void>
  clear: () => Promise<void>
}

export function useVersusMemory(enabled: boolean): UseVersusMemoryResult {
  const [facts, setFacts] = useState<readonly string[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFacts([])
      return
    }
    setLoading(true)
    try {
      const headers = await authHeaders()
      if (!headers) {
        setFacts([])
        return
      }
      const res = await fetch(MEMORY_ENDPOINT, { method: 'GET', headers })
      if (res.status === 401) {
        setFacts([])
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as { facts?: string[] }
      setFacts(Array.isArray(body.facts) ? body.facts : [])
    } catch {
      toast.error('Nie udało się wczytać pamięci Versusia.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const clear = useCallback(async () => {
    if (!enabled || facts.length === 0) {
      toast('Pamięć Versusia jest już pusta.')
      return
    }
    setClearing(true)
    try {
      const headers = await authHeaders()
      if (!headers) {
        toast.error('Zaloguj się ponownie.')
        return
      }
      const res = await fetch(MEMORY_ENDPOINT, { method: 'DELETE', headers })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      setFacts([])
      toast.success('Wyczyszczono pamięć Versusia.')
    } catch {
      toast.error('Nie udało się wyczyścić pamięci.')
    } finally {
      setClearing(false)
    }
  }, [enabled, facts.length])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { facts, loading, clearing, refresh, clear }
}
