import { useEffect, useRef, useState } from 'react'
import { LandingAppModal } from '../LandingAppModal'
import { LANDING_CORE_APPS, type LandingApp } from '../landingApps'
import { LandingSection, LandingSectionHeader } from './shared'

const PLACE_MS = 160

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function LandingCapabilityCards() {
  const [open, setOpen] = useState<LandingApp | null>(null)
  const [placed, setPlaced] = useState(0)
  const [active, setActive] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    if (prefersReducedMotion()) {
      setActive(true)
      setPlaced(LANDING_CORE_APPS.length)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setActive(true)
        io.disconnect()
      },
      { threshold: 0.28 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!active || prefersReducedMotion()) return
    if (placed >= LANDING_CORE_APPS.length) return
    const id = window.setTimeout(() => setPlaced((n) => n + 1), PLACE_MS)
    return () => window.clearTimeout(id)
  }, [active, placed])

  return (
    <LandingSection id="modulos" ariaLabelledBy="modules-title" className="lp-caps">
      <LandingSectionHeader
        className="lp-caps__head"
        titleId="modules-title"
        kicker="Módulos"
        title="Cada cosa en su sitio."
        subtitle="Abra un módulo para ver qué guarda y cómo se usa en el día."
      />
      <div ref={boardRef} className="lp-apps__board lp-caps__board">
        {LANDING_CORE_APPS.map((card, i) => (
          <button
            key={card.view}
            type="button"
            className={`lp-apps__tile lp-apps__tile--${card.tone}${i < placed ? ' is-in' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={open?.view === card.view}
            aria-label={`${card.name}. ${card.text} Abrir detalle.`}
            onClick={() => setOpen(card)}
          >
            <span className="lp-apps__copy">
              <span className="lp-apps__label">{card.name}</span>
              <span className="lp-apps__hint">{card.text}</span>
            </span>
            <span className="lp-apps__more" aria-hidden>
              Ver
            </span>
          </button>
        ))}
      </div>
      {open ? <LandingAppModal app={open} onClose={() => setOpen(null)} /> : null}
    </LandingSection>
  )
}
