import { useEffect } from 'react'
import { BRAND_NAME } from '../lib/brand'
import { getLegalPage, type LegalPageId } from '../lib/legalContent'
import { getLandingUrl } from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { SiteFooter } from './SiteFooter'
import '../public-shell.css'
import './vos-auth.css'

type Props = {
  page: LegalPageId
}

export function LegalPageView({ page }: Props) {
  const content = getLegalPage(page)
  const landingUrl = getLandingUrl()

  useEffect(() => {
    document.title = `${content.title} · ${BRAND_NAME}`
  }, [content.title])

  return (
    <div className="public-shell vos-auth legal-page">
      <header className="va-nav">
        <div className="va-nav__bar">
          <a className="va-nav__brand" href={landingUrl} aria-label={`${BRAND_NAME} inicio`}>
            <BrandMark size="sm" />
          </a>
          <a className="va-btn va-btn--ghost" href={landingUrl}>
            Inicio
          </a>
        </div>
      </header>

      <div className="public-wrap legal-page__wrap">
        <article className="legal-page__card">
          <header className="legal-page__head">
            <p className="legal-page__kicker">Legal</p>
            <h1>{content.title}</h1>
            <p className="legal-page__updated muted">Última actualización: {content.updated}</p>
            <p className="legal-page__intro">{content.intro}</p>
          </header>

          <div className="legal-page__body">
            {content.sections.map((section) => (
              <section key={section.title} className="legal-page__section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>

          <footer className="legal-page__actions">
            <a href={landingUrl}>Volver al inicio</a>
          </footer>
        </article>

        <SiteFooter tagline="Una plataforma. Múltiples soluciones. Inteligencia integrada." />
      </div>
    </div>
  )
}
