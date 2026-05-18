import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const getInitial = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState<boolean>(getInitial)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()

    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}
