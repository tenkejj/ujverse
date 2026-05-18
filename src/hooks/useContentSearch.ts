import { useEffect, useState } from 'react'
import { SearchService } from '../services/SearchService'
import type { SearchHit } from '../types/search'

type SearchState = {
  results: SearchHit[]
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: SearchState = {
  results: [],
  isLoading: false,
  error: null,
}

export function useContentSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>(INITIAL_STATE)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setState(INITIAL_STATE)
      return
    }

    const controller = new AbortController()
    setState((previous) => ({ ...previous, isLoading: true, error: null }))

    SearchService.searchContent(normalized, { signal: controller.signal })
      .then((results) => {
        if (controller.signal.aborted) return
        setState({ results, isLoading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error
          ? error.message
          : 'Nie udało się pobrać wyników wyszukiwania.'
        setState({ results: [], isLoading: false, error: message })
      })

    return () => {
      controller.abort()
    }
  }, [query])

  return state
}
