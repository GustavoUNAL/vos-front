import { useEffect, useState } from 'react'

/** Sincroniza tema claro/oscuro en landing, login y registro. */
export function usePublicTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return window.localStorage.getItem('vos_theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.shell = 'public'
    try {
      window.localStorage.setItem('vos_theme', theme)
    } catch {
      /* ignore */
    }
    return () => {
      delete document.documentElement.dataset.shell
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
