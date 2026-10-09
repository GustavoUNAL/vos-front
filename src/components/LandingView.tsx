import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { BRAND_NAME } from '../lib/brand'
import { SiteFooter } from './SiteFooter'
import { getLoginUrl } from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { usePublicTheme } from '../hooks/usePublicTheme'
import { LandingProductPreview } from './landing/LandingProductPreview'
import {
  LandingCapabilityCards,
  LandingNameSection,
  LandingSectorsSection,
} from './landing/sections'
import '../public-shell.css'
import './landing/attio-home.css'
import './landing/sections/landing-platform.css'
import './landing/github-home.css'

const NAV_LINKS = [
  { href: '#modulos', label: 'Módulos' },
  { href: '#sectores', label: 'Sectores' },
] as const

type Props = {
  onLoginClick?: () => void
  onAccessRequestClick?: () => void
  onHealthLoginClick?: () => void
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
        d="M15 4.25H3M15 9H3M15 13.75H3"
      />
    </svg>
  )
}

export function LandingView({
  onLoginClick,
}: Props) {
  const loginUrl = getLoginUrl()
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = usePublicTheme()

  useLayoutEffect(() => {
    document.title = `${BRAND_NAME} — Sistema de manejo de datos para empresas`
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    function onScroll() {
      setHeaderScrolled((shell?.scrollTop ?? 0) > 12)
    }
    onScroll()
    shell.addEventListener('scroll', onScroll, { passive: true })
    return () => shell.removeEventListener('scroll', onScroll)
  }, [])

  function handleLogin(e: MouseEvent<HTMLAnchorElement>) {
    if (!onLoginClick) return
    e.preventDefault()
    onLoginClick()
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div ref={shellRef} className="public-shell landing-v2 attio-home lp-platform lp-gh">
      <header className={headerScrolled ? 'attio-header is-scrolled' : 'attio-header'}>
        <div className="attio-container">
          <nav className="attio-nav" aria-label="Principal">
            <button
              type="button"
              className="attio-nav__menu"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon />
            </button>
            <a className="attio-nav__brand" href="#top" aria-label={`${BRAND_NAME} inicio`}>
              <BrandMark size="sm" />
            </a>
            <ul className="attio-nav__links">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
            <div className="attio-nav__tools">
              <PublicThemeSwitch
                theme={theme}
                onToggle={toggleTheme}
                compact
                className="lp-gh-theme"
              />
              <a className="attio-nav__login attio-nav__login--mobile" href={loginUrl} onClick={handleLogin}>
                Acceder
              </a>
              <a className="attio-nav__login attio-nav__login--desktop" href={loginUrl} onClick={handleLogin}>
                Acceder
              </a>
            </div>
          </nav>
          <div className={menuOpen ? 'attio-nav__drawer is-open' : 'attio-nav__drawer'}>
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <a
              className="attio-btn attio-btn--outline attio-nav__drawer-access"
              href={loginUrl}
              onClick={(e) => {
                closeMenu()
                handleLogin(e)
              }}
            >
              Acceder
            </a>
          </div>
        </div>
      </header>

      <div id="top" className="public-wrap landing-v2__wrap landing-v2__wrap--scroll">
        <div className="attio-container">
          <div className="attio-frame">
            <header className="attio-hero lp-gh-hero" id="producto" aria-labelledby="landing-hero-title">
              <div className="attio-hero__copy">
                <h1 id="landing-hero-title">
                  Sistema de manejo
                  <br />
                  de datos para empresas.
                </h1>
                <p className="attio-hero__lead">
                  Ventas, inventario, citas y clientes. El mismo trabajo de siempre, con los números a la vista.
                </p>
                <div className="attio-hero__cta">
                  <a className="attio-btn attio-btn--outline" href={loginUrl} onClick={handleLogin}>
                    Acceder
                  </a>
                </div>
              </div>
              <div className="lp-gh-visual">
                <LandingProductPreview />
              </div>
            </header>
          </div>
        </div>

        <div className="attio-container">
          <div className="attio-frame">
            <LandingCapabilityCards />
            <LandingSectorsSection />
            <LandingNameSection />
          </div>
        </div>

        <SiteFooter tagline="Hecho para el día a día de un negocio." />
      </div>
    </div>
  )
}
