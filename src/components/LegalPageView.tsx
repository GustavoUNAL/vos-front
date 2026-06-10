import { useEffect } from 'react'
import { BRAND_NAME } from '../lib/brand'
import { getLegalPage, type LegalPageId } from '../lib/legalContent'
import { getLandingUrl } from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { SiteFooter } from './SiteFooter'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'

type Props = {
  page: LegalPageId
}

export function LegalPageView({ page }: Props) {
  const content = getLegalPage(page)
  const { theme, toggleTheme } = usePublicTheme()
  const landingUrl = getLandingUrl()

  useEffect(() => {
    document.title = `${content.title} · ${BRAND_NAME}`
  }, [content.title])

  return (
    <div className="public-shell landing-v2 legal-page">
      <div className="public-shell__grid-bg" aria-hidden />
      <header className="public-topbar public-topbar--minimal legal-page__topbar">
        <a href={landingUrl} className="legal-page__brand" aria-label="Volver al inicio">
          <BrandMark size="sm" />
        </a>
        <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
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
            <a className="public-btn public-btn--ghost" href={landingUrl}>
              ← Volver al inicio
            </a>
          </footer>
        </article>

        <SiteFooter />
      </div>
    </div>
  )
}
