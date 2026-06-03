import { useCallback, useEffect, useRef, useState } from 'react'
import { TagService, type OfficialTagRow } from '../services/TagService'

export type UseOfficialTagsResult = {
  tags: OfficialTagRow[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useOfficialTags(enabled = true): UseOfficialTagsResult {
  const [tags, setTags] = useState<OfficialTagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const reload = useCallback(async () => {
    if (!enabled) {
      setTags([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { tags: next, error: fetchError } = TagService.getOfficialTags()
    if (!aliveRef.current) return
    if (fetchError) {
      setError(fetchError.message)
      setTags([])
    } else {
      setTags(next)
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    aliveRef.current = true
    if (!enabled) {
      setTags([])
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

  return { tags, loading, error, reload }
}
