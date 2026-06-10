import { useEffect, useState, type RefObject } from 'react'
import { useVisualViewport } from './useVisualViewport'

const KEYBOARD_THRESHOLD_PX = 80
const CHAT_SHEET_CLASS = 'app--chat-sheet-open'

/**
 * Ajusta --vv-height / --vv-offset-top y detecta teclado virtual (iOS/Android).
 * Bloquea scroll del documento mientras el chat está abierto.
 */
export function useMobileChatKeyboard(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useVisualViewport(open, rootRef)

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      setKeyboardOpen(false)
      return
    }
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      setKeyboardOpen(window.innerHeight - vv.height > KEYBOARD_THRESHOLD_PX)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    document.documentElement.classList.add(CHAT_SHEET_CLASS)
    return () => {
      document.documentElement.classList.remove(CHAT_SHEET_CLASS)
    }
  }, [open])

  return keyboardOpen
}
