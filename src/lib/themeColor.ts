export const THEME_STORAGE_KEY = 'vos_theme_v2'
export const DEFAULT_THEME: 'dark' | 'light' = 'light'
export const DEFAULT_DARK = '#0e1014'
export const DEFAULT_LIGHT = '#f4f5f7'

export function readStoredTheme(): 'dark' | 'light' {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME
}

export function persistTheme(theme: 'dark' | 'light') {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function setThemeColor(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}

export function themeColorForScheme(theme: 'dark' | 'light') {
  return theme === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK
}
