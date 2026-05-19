import { useEffect, useState } from 'react'

export type AppTheme = 'dark' | 'light'

function readTheme(): AppTheme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Sincroniza el POS con el interruptor de tema global (sidebar). */
export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(readTheme)

  useEffect(() => {
    const root = document.documentElement
    const obs = new MutationObserver(() => setTheme(readTheme()))
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return theme
}
