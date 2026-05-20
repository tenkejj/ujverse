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
  console.log('🔧 [useContentSearch] HOOK CALLED:', { query, type: typeof query, len: query?.length })
  const [state, setState] = useState<SearchState>(INITIAL_STATE)

  useEffect(() => {
    console.log('🌀 [useContentSearch] EFFECT FIRED, query:', JSON.stringify(query))
    const normalized = query.trim()
    if (normalized.length < 2) {
      console.log('⏭ [useContentSearch] early return (< 2 znaki), normalized=', JSON.stringify(normalized))
      setState(INITIAL_STATE)
      return
    }

    // Nie używamy AbortController, bo w StrictMode cleanup pierwszego mountu
    // potrafi przerwać sygnał ZANIM SDK Meilisearch zdąży wywołać fetch().
    // Fetch z już-aborted signal nie wychodzi w sieć — wtedy Network tab
    // zostaje pusty, a stan utyka jako "brak wyników". Flaga isCurrent
    // pozwala zapytaniu zawsze realnie wystartować i tylko odfiltrowuje
    // nieaktualne odpowiedzi.
    let isCurrent = true
    setState((previous) => ({ ...previous, isLoading: true, error: null }))

    console.log('🚀 [useContentSearch] Wywołuję sieć dla frazy:', normalized)
    SearchService.searchContent(normalized)
      .then((results) => {
        console.log('📥 [useContentSearch] Serwer zwrócił hity:', results)
        if (!isCurrent) return
        setState({ results, isLoading: false, error: null })
      })
      .catch((error: unknown) => {
        console.error('❌ [useContentSearch] Błąd searchContent:', error)
        if (!isCurrent) return
        const message = error instanceof Error
          ? error.message
          : 'Nie udało się pobrać wyników wyszukiwania.'
        setState({ results: [], isLoading: false, error: message })
      })

    return () => {
      isCurrent = false
    }
  }, [query])

  return state
}
