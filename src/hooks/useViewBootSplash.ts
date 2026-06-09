import { useEffect, useState } from 'react'

/** Barra de progreso animada mientras `active` sea true. */
export function useViewBootSplash(active: boolean) {
  const [progress, setProgress] = useState(8)
  const [visible, setVisible] = useState(active)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setProgress((p) => (p < 14 ? 14 : p))
      const tick = window.setInterval(() => {
        setProgress((p) => (p < 88 ? Math.min(88, p + 5) : p))
      }, 160)
      return () => window.clearInterval(tick)
    }

    setProgress(100)
    const hide = window.setTimeout(() => setVisible(false), 380)
    return () => window.clearTimeout(hide)
  }, [active])

  return { visible, progress }
}

/** Splash solo en la primera carga de la vista (no en paginación ni refetch). */
export function useInitialViewLoad(ready: boolean) {
  const [pending, setPending] = useState(true)

  useEffect(() => {
    if (ready) setPending(false)
  }, [ready])

  return useViewBootSplash(pending)
}
