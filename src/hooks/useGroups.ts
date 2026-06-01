import { useCallback, useEffect, useRef, useState } from 'react'
import { GroupService, type GroupRow } from '../services/GroupService'

export type UseGroupsResult = {
  groups: GroupRow[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useGroups(enabled = true): UseGroupsResult {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const reload = useCallback(async () => {
    if (!enabled) {
      setGroups([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { groups: next, error: fetchError } = await GroupService.listGroups()
    if (!aliveRef.current) return
    if (fetchError) {
      setError(fetchError.message)
      setGroups([])
    } else {
      setGroups(next)
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    aliveRef.current = true
    if (!enabled) {
      setGroups([])
      setError(null)
      setLoading(false)
      return () => {
        aliveRef.current = false
      }
    }
    void reload()
    return () => {
      aliveRef.current = false
    }
  }, [enabled, reload])

  return { groups, loading, error, reload }
}
