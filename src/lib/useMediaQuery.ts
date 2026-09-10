'use client'
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false) // SSR-safe: false en el primer render

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}

export const useIsWide = () => useMediaQuery('(min-width: 768px)')      // ≥ md
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')  // ≥ lg
