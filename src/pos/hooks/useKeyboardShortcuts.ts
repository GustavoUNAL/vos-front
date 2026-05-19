import { useEffect } from 'react'

type ShortcutMap = Record<string, () => void>

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }
      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('mod')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')
      const fn = shortcuts[combo]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts, enabled])
}
