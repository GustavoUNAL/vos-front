import { useEffect, useRef } from 'react'

const MOBILE_MQ = '(max-width: 720px)'

/**
 * Revela los mocks de conversación al hacer scroll (solo móvil).
 * El texto de la landing permanece fijo/visible.
 */
export function useLandingScrollReveal() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = wrapRef.current
    if (!root) return

    const mobile = window.matchMedia(MOBILE_MQ)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const markVisible = (el: Element) => el.classList.add('is-visible')

    const setup = () => {
      const chats = root.querySelectorAll(
        '.landing-chat-reveal:not(.landing-chat-reveal--centered-play)',
      )
      chats.forEach((chat) => chat.classList.remove('is-visible'))

      if (!mobile.matches || reduced.matches) {
        chats.forEach(markVisible)
        return undefined
      }

      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              markVisible(entry.target)
              obs.unobserve(entry.target)
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
      )

      chats.forEach((chat) => obs.observe(chat))
      return () => obs.disconnect()
    }

    let cleanup = setup()
    const onMobileChange = () => {
      cleanup?.()
      cleanup = setup()
    }
    mobile.addEventListener('change', onMobileChange)

    return () => {
      cleanup?.()
      mobile.removeEventListener('change', onMobileChange)
    }
  }, [])

  return wrapRef
}
