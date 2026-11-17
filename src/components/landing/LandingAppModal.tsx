import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LandingAppDemo } from './LandingAppDemo'
import { LandingArt } from './LandingArt'
import { LANDING_APP_STATUS, type LandingApp } from './landingApps'

export function LandingAppModal({
  app,
  onClose,
}: {
  app: LandingApp
  onClose: () => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const shell = document.querySelector('.lp-gh.public-shell') as HTMLElement | null
    const prevOverflow = shell?.style.overflowY ?? ''
    const prevFocus = document.activeElement as HTMLElement | null
    if (shell) shell.style.overflowY = 'hidden'
    dialogRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (shell) shell.style.overflowY = prevOverflow
      prevFocus?.focus()
    }
  }, [app, onClose])

  const mount = document.querySelector('.public-shell') ?? document.body

  return createPortal(
    <div className="lp-cap-modal lp-t30" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="lp-cap-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lp-cap-modal__top">
          <p className={`lp-cap-modal__status lp-cap--${app.status}`}>
            {LANDING_APP_STATUS[app.status]}
          </p>
          <button
            ref={closeRef}
            type="button"
            className="lp-cap-modal__x"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="lp-cap-modal__title">
          <LandingArt view={app.view} size="modal" />
          <h3 id={titleId}>{app.name}</h3>
        </div>
        <p className="lp-cap-modal__text">{app.text}</p>

        <div className="lp-cap-modal__body">
          <div className="lp-cap-modal__info">
            <section>
              <h4>Cómo se guarda</h4>
              <p>{app.saves}</p>
            </section>
            <section>
              <h4>Ventajas</h4>
              <ul>
                {app.advantages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <p className="lp-cap-modal__from">{app.from}</p>
          </div>
          <LandingAppDemo view={app.view} />
        </div>
      </div>
    </div>,
    mount,
  )
}
