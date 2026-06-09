import { useEffect, type RefObject } from 'react'

/**
 * Sincroniza --vv-height y --vv-offset-top para que paneles fijos
 * se ajusten cuando el teclado virtual reduce el viewport en móvil.
 */
export function useVisualViewport(
  active: boolean,
  targetRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const el = targetRef.current
    const vv = window.visualViewport
    if (!el || !vv) return

    const sync = () => {
      el.style.setProperty('--vv-height', `${vv.height}px`)
      el.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)

    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
      el.style.removeProperty('--vv-height')
      el.style.removeProperty('--vv-offset-top')
    }
  }, [active, targetRef])
}
