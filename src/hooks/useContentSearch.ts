import { useEffect, useState } from 'react'
import { SearchService } from '../services/SearchService'
import type { SearchHit, SearchUserHit } from '../types/search'

type SearchState = {
  content: SearchHit[]
  users: SearchUserHit[]
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: SearchState = {
  content: [],
  users: [],
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

    // Bez AbortControllera — cleanup ze signal potrafi przerwać fetch zanim
    // SDK Meilisearch wyśle żądanie (StrictMode / szybka zmiana query).
    let isCurrent = true
    setState({ content: [], users: [], isLoading: true, error: null })

    void SearchService.searchUnified(normalized, {
      limit: 24,
      includeContent: true,
      includeUsers: true,
    })
      .then((response) => {
        if (!isCurrent) return
        setState({
          content: Array.isArray(response.content) ? response.content : [],
          users: Array.isArray(response.users) ? response.users : [],
          isLoading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        const message = error instanceof Error
          ? error.message
          : 'Nie udało się pobrać wyników wyszukiwania.'
        setState({ content: [], users: [], isLoading: false, error: message })
      })

    return () => {
      isCurrent = false
    }
  }, [query])

  return state
}
