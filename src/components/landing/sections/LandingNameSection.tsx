import { LandingSection } from './shared'
import { SITE_LINKEDIN } from '../../../lib/siteContact'

export function LandingNameSection() {
  return (
    <LandingSection id="nombre" ariaLabelledBy="name-title" className="lp-name">
      <article className="lp-name__card">
        <p className="lp-name__kicker">El nombre</p>
        <p className="lp-name__logo" aria-hidden>
          <span className="lp-name__mark lp-name__mark--vos">VOS</span>
          <span className="lp-name__mark lp-name__mark--ai">-AI</span>
        </p>
        <h2 id="name-title">¿Por qué se llama así?</h2>
        <div className="lp-name__parts">
          <p>
            <span className="lp-name__mark lp-name__mark--vos">VOS</span>
            es usted. El negocio es suyo: las ventas, las citas, el inventario y los clientes.
          </p>
          <p>
            <span className="lp-name__mark lp-name__mark--ai">-AI</span>
            resume el día, avisa si algo falta y deja hechas las tareas que se repiten.
          </p>
        </div>
        <a
          className="lp-name__linkedin"
          href={SITE_LINKEDIN}
          target="_blank"
          rel="noopener noreferrer me"
        >
          LinkedIn
        </a>
      </article>
    </LandingSection>
  )
}
