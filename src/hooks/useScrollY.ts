import { useEffect, useState } from 'react'

export function useScrollY(): number {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const read = () => {
      setScrollY(window.scrollY ?? document.documentElement.scrollTop)
    }
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [])

  return scrollY
}
