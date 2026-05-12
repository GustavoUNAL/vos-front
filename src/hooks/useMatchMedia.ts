import { useEffect, useState } from 'react'

/** Escucha `window.matchMedia`; en SSR / primer render devuelve `false`. */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [query])

  return matches
}
