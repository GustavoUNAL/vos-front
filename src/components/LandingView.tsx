import { useEffect, type MouseEvent } from 'react'
import { useLandingScrollReveal } from '../hooks/useLandingScrollReveal'
import { BRAND_NAME, BRAND_TAGLINE } from '../lib/brand'
import { SiteFooter } from './SiteFooter'
import {
  getAccessRequestUrl,
  getLoginUrl,
} from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { usePublicTheme } from '../hooks/usePublicTheme'
import { LandingChatMock, type LandingChatTurn } from './landing/LandingChatMock'
import { LandingSolutionDemo } from './landing/LandingSolutionDemo'
import { LandingSalesChat } from './landing/LandingSalesChat'
import {
  LandingAutomationsSection,
  LandingCompareSection,
  LandingFinalCtaSection,
  LandingIndustriesSection,
  LandingResultsSection,
} from './landing/sections'
import './landing/sections/landing-premium.css'
import '../public-shell.css'

const VALIDATION_STEPS = [
  {
    title: 'Diagnóstico',
    text: 'Entendemos cómo funciona tu negocio hoy.',
  },
  {
    title: 'Digitalización',
    text: 'Convertimos registros físicos, hojas de cálculo y procesos manuales en información estructurada.',
  },
  {
    title: 'Automatización',
    text: 'Centralizamos ventas, inventario, compras y clientes en una sola plataforma.',
  },
  {
    title: 'Inteligencia',
    text: 'La IA analiza la información de tu negocio y te ayuda a vender más, comprar mejor y tomar decisiones con datos.',
  },
] as const

/** Hero — demo en bucle (una pregunta a la vez, tamaño fijo) */
const HERO_DEMOS: LandingChatTurn[][] = [
  [
    {
      who: 'Sofía',
      role: 'user',
      text: '¿Cuánto vendí hoy?',
    },
    {
      who: BRAND_NAME,
      role: 'ai',
      badge: 'Ventas · hoy',
      text: 'POS, tienda web y pedidos del día:',
      metrics: [
        { label: 'Total', value: '$1.250.000', hint: '+14% vs ayer', trend: 'up' },
        { label: 'POS', value: '$775.000' },
        { label: 'Web', value: '$475.000' },
        { label: 'Tickets', value: '44' },
      ],
    },
  ],
  [
    {
      who: 'Sofía',
      role: 'user',
      text: '¿Qué debo comprar?',
    },
    {
      who: BRAND_NAME,
      role: 'ai',
      badge: 'Compras · esta semana',
      text: 'Según stock y ritmo de venta, recomiendo pedir hoy:',
      bullets: [
        '<strong>Leche entera</strong> — 2 días de cobertura',
        '<strong>Café molido</strong> — mínimo alcanzado',
        '<strong>Vasos 12 oz</strong> — ritmo alto del fin de semana',
      ],
    },
  ],
  [
    {
      who: 'Sofía',
      role: 'user',
      text: '¿Cuál fue mi utilidad?',
    },
    {
      who: BRAND_NAME,
      role: 'ai',
      badge: 'Finanzas · mes actual',
      text: 'Utilidad neta con costos de inventario y operación:',
      metrics: [
        { label: 'Utilidad', value: '$4.820.000', hint: '+9% vs mes ant.', trend: 'up' },
        { label: 'Margen', value: '34,2%' },
        { label: 'Ingresos', value: '$14.100.000' },
      ],
    },
  ],
]

type Props = {
  onLoginClick?: () => void
  onAccessRequestClick?: () => void
}

export function LandingView({ onLoginClick, onAccessRequestClick }: Props) {
  const loginUrl = getLoginUrl()
  const accessUrl = getAccessRequestUrl()
  const { theme, toggleTheme } = usePublicTheme()
  const scrollWrapRef = useLandingScrollReveal()

  useEffect(() => {
    document.title = `${BRAND_NAME} — Sistema operativo inteligente para tu negocio`
  }, [])

  function handleLogin(e: MouseEvent<HTMLAnchorElement>) {
    if (!onLoginClick) return
    e.preventDefault()
    onLoginClick()
  }

  function handleAccess(e: MouseEvent<HTMLAnchorElement>) {
    if (!onAccessRequestClick) return
    e.preventDefault()
    onAccessRequestClick()
  }

  function scrollToDemo() {
    document.getElementById('solution-title')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }

  return (
    <div className="public-shell landing-v2">
      <header className="public-topbar public-topbar--minimal landing-v2__topbar">
        <BrandMark size="sm" />
        <div className="landing-v2__topbar-actions">
          <a className="public-btn public-btn--ghost landing-v2__top-login" href={loginUrl} onClick={handleLogin}>
            <span className="landing-v2__top-login-label--full">Ir a mi negocio</span>
            <span className="landing-v2__top-login-label--short">Entrar</span>
          </a>
          <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
        </div>
      </header>

      <div ref={scrollWrapRef} className="public-wrap landing-v2__wrap landing-v2__wrap--scroll">
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero__copy">
            <p className="landing-hero__eyebrow">{BRAND_TAGLINE}</p>
            <h1 id="landing-hero-title">
              Tu negocio, bajo control.
            </h1>
            <p className="landing-hero__lead">
              {BRAND_NAME} une ventas, inventario, compras y un asistente IA que responde
              con los datos reales de tu operación — desde el celular o el computador.
            </p>
            <div className="landing-hero__actions">
              <a className="public-btn public-btn--accent landing-v2__btn-solid" href={accessUrl} onClick={handleAccess}>
                Quiero VOS AI en mi negocio
              </a>
              <a
                className="public-btn public-btn--ghost landing-hero__cta-secondary"
                href={loginUrl}
                onClick={handleLogin}
              >
                Ya tengo cuenta
              </a>
            </div>
          </div>

          <LandingChatMock
            demoLoop={HERO_DEMOS}
            framed
            playWhenCentered
            readOnly
            caption="Asistente con datos reales de tu negocio"
          />
        </section>

        <section
          className="public-section landing-section landing-validation"
          aria-labelledby="validation-title"
        >
          <div className="public-section__head">
            <p className="landing-section__kicker">Empezar</p>
            <h2 id="validation-title">De papel a inteligencia artificial en cuatro pasos</h2>
          </div>
          <div className="landing-validation-grid">
            {VALIDATION_STEPS.map((step, i) => (
              <article key={step.title} className="landing-validation-step">
                <span className="landing-validation-step__num" aria-hidden>
                  {i + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <div className="landing-validation-cta">
            <a className="public-btn public-btn--accent landing-v2__btn-solid" href={accessUrl} onClick={handleAccess}>
              Quiero VOS AI en mi negocio
            </a>
          </div>
        </section>

        <section
          className="public-section landing-section"
          aria-labelledby="problem-title"
        >
          <div className="public-section__head">
            <p className="landing-section__kicker">El problema</p>
            <h2 id="problem-title">Tu información está trabajando en lugares distintos.</h2>
            <p>
              Las ventas están en un lado, el inventario en otro, las compras en WhatsApp y
              los reportes en hojas de cálculo. Los datos existen, pero nadie los conecta.
            </p>
            <p>
              Mientras buscas información, pierdes tiempo, oportunidades y capacidad para
              tomar mejores decisiones.
            </p>
            <p className="landing-section__after">
              {BRAND_NAME} digitaliza, organiza y conecta toda la operación de tu negocio
              para convertir datos dispersos en decisiones claras.
            </p>
          </div>
        </section>

        <section
          className="public-section landing-section landing-section--solution"
          aria-labelledby="solution-title"
        >
          <div className="public-section__head landing-section--solution__head">
            <p className="landing-section__kicker">La solución</p>
            <h2 id="solution-title">
              Deja de buscar información. Empieza a hacer preguntas.
            </h2>
            <p>
              {BRAND_NAME} conecta ventas, inventario, compras, finanzas y clientes
              para que puedas obtener respuestas instantáneas, análisis y
              recomendaciones basadas en los datos reales de tu negocio.
            </p>
          </div>
          <LandingSolutionDemo />
        </section>

        <section
          className="public-section landing-section"
          aria-labelledby="how-title"
        >
          <div className="public-section__head">
            <p className="landing-section__kicker">Cómo funciona</p>
            <h2 id="how-title">
              Digitalizamos. Conectamos. Analizamos. Conversamos.
            </h2>
          </div>
          <div className="public-steps landing-how-steps">
            <article className="public-step">
              <h3>Digitalizamos</h3>
              <p>
                Convertimos ventas, compras, inventario y procesos manuales en
                información organizada.
              </p>
            </article>
            <article className="public-step">
              <h3>Conectamos</h3>
              <p>Centralizamos toda la operación en una sola plataforma.</p>
            </article>
            <article className="public-step">
              <h3>Analizamos</h3>
              <p>
                La IA detecta tendencias, riesgos y oportunidades
                automáticamente.
              </p>
            </article>
            <article className="public-step">
              <h3>Conversamos</h3>
              <p>
                Pregúntale a tu negocio como si hablaras con un experto
                  disponible 24/7.
              </p>
            </article>
          </div>
        </section>

        <LandingCompareSection />
        <LandingAutomationsSection />
        <LandingIndustriesSection />
        <LandingResultsSection />
        <LandingFinalCtaSection
          accessUrl={accessUrl}
          onAccess={handleAccess}
          onDemo={scrollToDemo}
        />

        <SiteFooter tagline={BRAND_TAGLINE} />
      </div>

      <div className="landing-mobile-cta" role="region" aria-label="Acciones rápidas">
        <a
          className="public-btn public-btn--accent landing-v2__btn-solid landing-mobile-cta__primary"
          href={accessUrl}
          onClick={handleAccess}
        >
          Quiero VOS AI
        </a>
        <a
          className="landing-mobile-cta__ghost"
          href={loginUrl}
          onClick={handleLogin}
        >
          Entrar
        </a>
      </div>

      <LandingSalesChat />
    </div>
  )
}
