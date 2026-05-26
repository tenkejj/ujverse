import { useEffect, useState } from 'react'
import { DataService } from '../services/DataService'
import { SearchService } from '../services/SearchService'
import type { EventMeta, UnifiedContent } from '../types/content'
import type { SearchHit, SearchUserHit } from '../types/search'

type SearchState = {
  content: SearchHit[]
  users: SearchUserHit[]
  events: UnifiedContent<EventMeta>[]
  isLoading: boolean
  error: string | null
}

const INITIAL_STATE: SearchState = {
  content: [],
  users: [],
  events: [],
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
    setState({ content: [], users: [], events: [], isLoading: true, error: null })

    let meiliDone = false
    let eventsDone = false
    let meiliError: string | null = null
    let eventsError: string | null = null
    let content: SearchHit[] = []
    let users: SearchUserHit[] = []
    let events: UnifiedContent<EventMeta>[] = []

    const maybeFinish = () => {
      if (!isCurrent || !meiliDone || !eventsDone) return
      const error = meiliError ?? eventsError
      setState({
        content,
        users,
        events,
        isLoading: false,
        error,
      })
    }

    void SearchService.searchUnified(normalized, {
      limit: 24,
      includeContent: true,
      includeUsers: true,
    })
      .then((response) => {
        if (!isCurrent) return
        content = Array.isArray(response.content) ? response.content : []
        users = Array.isArray(response.users) ? response.users : []
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        meiliError = error instanceof Error
          ? error.message
          : 'Nie udało się pobrać wyników wyszukiwania.'
      })
      .finally(() => {
        if (!isCurrent) return
        meiliDone = true
        maybeFinish()
      })

    void DataService.searchEvents(normalized, { limit: 24 })
      .then((rows) => {
        if (!isCurrent) return
        events = rows
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        eventsError = error instanceof Error
          ? error.message
          : 'Nie udało się wyszukać wydarzeń.'
      })
      .finally(() => {
        if (!isCurrent) return
        eventsDone = true
        maybeFinish()
      })

    return () => {
      isCurrent = false
    }
  }, [query])

  return state
}
