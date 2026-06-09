import { useEffect, type MouseEvent } from 'react'
import { BRAND_NAME } from '../lib/brand'
import {
  getAccessRequestUrl,
  getLoginUrl,
} from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'

const QUESTIONS = [
  '¿Cuánto vendí hoy?',
  '¿Qué debo comprar?',
  '¿Cuál fue mi utilidad?',
  '¿Qué productos generan más ganancias?',
  '¿Qué clientes no han regresado?',
] as const

const COMPARE_ROWS = [
  { feature: 'Registrar ventas', pos: true, vos: true },
  { feature: 'Inventario', pos: true, vos: true },
  { feature: 'Reportes', pos: true, vos: true },
  { feature: 'IA integrada', pos: false, vos: true },
  { feature: 'WhatsApp', pos: false, vos: true },
  { feature: 'Recomendaciones', pos: false, vos: true },
  { feature: 'Automatizaciones', pos: false, vos: true },
  { feature: 'Asistente empresarial', pos: false, vos: true },
] as const

const PILLARS = [
  { title: 'Ventas', text: 'Control total de ingresos.' },
  { title: 'Inventario', text: 'Conoce exactamente qué tienes.' },
  { title: 'Compras', text: 'Sabe qué comprar y cuándo.' },
  { title: 'Finanzas', text: 'Entiende si realmente estás ganando dinero.' },
  { title: 'Clientes', text: 'Conoce quién compra y quién dejó de comprar.' },
  { title: 'IA', text: 'Tu gerente digital disponible 24/7.' },
] as const

const AUTOMATIONS = [
  'Enviar reportes diarios.',
  'Alertar faltantes.',
  'Recomendar compras.',
  'Detectar caídas en ventas.',
  'Identificar productos estrella.',
] as const

const INDUSTRIES = [
  'Cafeterías',
  'Bares',
  'Restaurantes',
  'Tiendas',
  'Ferreterías',
  'Negocios de servicios',
] as const

const PLANS = [
  {
    name: 'Starter',
    price: '$49.000',
    period: '/ mes',
    note: 'Operación esencial con asistente IA.',
  },
  {
    name: 'Business',
    price: '$99.000',
    period: '/ mes',
    note: 'Más IA y WhatsApp.',
    featured: true,
  },
  {
    name: 'Premium',
    price: '$199.000',
    period: '/ mes',
    note: 'Automatizaciones avanzadas.',
  },
] as const

const WHATSAPP_DEMO =
  (import.meta.env.VITE_LANDING_WHATSAPP_URL as string | undefined)?.trim() ||
  'https://wa.me/573207909835?text=Hola%2C%20quiero%20una%20demo%20de%20VOS%20AI'

type Props = {
  onLoginClick?: () => void
  onAccessRequestClick?: () => void
}

function CheckIcon({ ok }: { ok: boolean }) {
  return (
    <span className={`landing-compare__mark${ok ? ' landing-compare__mark--yes' : ''}`}>
      {ok ? '✓' : '—'}
    </span>
  )
}

export function LandingView({ onLoginClick, onAccessRequestClick }: Props) {
  const loginUrl = getLoginUrl()
  const accessUrl = getAccessRequestUrl()
  const { theme, toggleTheme } = usePublicTheme()

  useEffect(() => {
    document.title = `${BRAND_NAME} — El primer gerente digital para pequeños negocios`
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

  return (
    <div className="public-shell landing-v2">
      <div className="public-shell__grid-bg" aria-hidden />
      <div className="public-shell__orbs" aria-hidden>
        <span className="public-orb public-orb--a" />
        <span className="public-orb public-orb--b" />
        <span className="public-orb public-orb--c" />
      </div>

      <header className="public-topbar public-topbar--minimal landing-v2__topbar">
        <BrandMark size="sm" />
        <div className="landing-v2__topbar-actions">
          <a className="public-btn public-btn--ghost landing-v2__top-login" href={loginUrl} onClick={handleLogin}>
            Iniciar sesión
          </a>
          <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
        </div>
      </header>

      <div className="public-wrap landing-v2__wrap">
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero__copy">
            <p className="landing-hero__category">
              El primer gerente digital para pequeños negocios.
            </p>
            <h1 id="landing-hero-title">Habla con tu negocio por WhatsApp.</h1>
            <p className="landing-hero__lead">
              {BRAND_NAME} es el gerente digital que te ayuda a administrar ventas,
              inventario, compras y finanzas simplemente conversando.
            </p>
            <div className="landing-hero__actions">
              <a className="public-btn public-btn--accent" href={accessUrl} onClick={handleAccess}>
                Solicitar demo
              </a>
              <a className="public-btn public-btn--ghost" href={loginUrl} onClick={handleLogin}>
                Probar con mi negocio
              </a>
            </div>
          </div>

          <div className="landing-chat" aria-label="Ejemplo de conversación con VOS AI">
            <div className="landing-chat__head">
              <span className="landing-chat__dot" />
              <span className="landing-chat__dot" />
              <span className="landing-chat__dot" />
              <span className="landing-chat__title">{BRAND_NAME}</span>
            </div>
            <div className="landing-chat__body">
              <div className="landing-chat__bubble landing-chat__bubble--user">
                <span className="landing-chat__who">Dueño</span>
                <p>¿Cuánto vendí hoy?</p>
              </div>
              <div className="landing-chat__bubble landing-chat__bubble--ai">
                <span className="landing-chat__who">{BRAND_NAME}</span>
                <p>
                  <strong>Ventas de hoy:</strong> $1.250.000
                  <br />
                  <strong>Utilidad estimada:</strong> $420.000
                  <br />
                  <strong>Producto más vendido:</strong> Mojito Tradicional
                  <br />
                  <strong>Inventario crítico:</strong> Limón (2 días restantes)
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="problem-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">El problema</p>
            <h2 id="problem-title">Administrar un negocio no debería ser un segundo trabajo.</h2>
            <p>
              Cada día los dueños pierden horas revisando ventas, inventario, compras,
              gastos y clientes. La información existe. Pero encontrar respuestas sigue
              siendo difícil.
            </p>
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="solution-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">La solución</p>
            <h2 id="solution-title">Tu negocio ahora puede responderte.</h2>
            <p>Pregunta lo que quieras:</p>
          </div>
          <ul className="landing-questions">
            {QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <p className="landing-section__after">
            {BRAND_NAME} analiza toda la operación y responde en segundos.
          </p>
        </section>

        <section className="public-section landing-section" aria-labelledby="how-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">¿Cómo funciona?</p>
            <h2 id="how-title">Tres pasos. Sin complicaciones.</h2>
          </div>
          <div className="public-steps">
            <article className="public-step">
              <h3>Registra tu operación</h3>
              <p>Ventas, compras e inventario.</p>
            </article>
            <article className="public-step">
              <h3>La IA analiza tu negocio</h3>
              <p>Procesa datos y detecta oportunidades.</p>
            </article>
            <article className="public-step">
              <h3>Pregunta por WhatsApp</h3>
              <p>Obtén respuestas y recomendaciones.</p>
            </article>
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="compare-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Más que un POS</p>
            <h2 id="compare-title">No es otro software. Es un gerente digital.</h2>
          </div>
          <div className="landing-compare-wrap">
            <table className="landing-compare">
              <thead>
                <tr>
                  <th scope="col">Característica</th>
                  <th scope="col">POS tradicional</th>
                  <th scope="col">{BRAND_NAME}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td><CheckIcon ok={row.pos} /></td>
                    <td><CheckIcon ok={row.vos} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="pillars-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Todo lo que tu negocio necesita</p>
            <h2 id="pillars-title">Operación completa. Respuestas simples.</h2>
          </div>
          <div className="public-grid public-grid--3">
            {PILLARS.map((p) => (
              <article key={p.title} className="public-card landing-pillar">
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="auto-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Automatizaciones inteligentes</p>
            <h2 id="auto-title">{BRAND_NAME} puede:</h2>
          </div>
          <ul className="landing-bullets">
            {AUTOMATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="public-section landing-section" aria-labelledby="industries-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Diseñado para negocios reales</p>
            <h2 id="industries-title">Ideal para:</h2>
          </div>
          <div className="landing-chips">
            {INDUSTRIES.map((name) => (
              <span key={name} className="landing-chip">{name}</span>
            ))}
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="results-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Resultados</p>
            <h2 id="results-title">Menos horas administrando. Más tiempo creciendo.</h2>
          </div>
          <ul className="landing-results">
            <li>Recupera tiempo.</li>
            <li>Toma mejores decisiones.</li>
            <li>Controla tu negocio desde cualquier lugar.</li>
            <li>Crece sin complicarte.</li>
          </ul>
        </section>

        <section className="public-section landing-section" aria-labelledby="plans-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Planes</p>
            <h2 id="plans-title">Empieza simple. Escala cuando quieras.</h2>
          </div>
          <div className="landing-plans">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`landing-plan${plan.featured ? ' landing-plan--featured' : ''}`}
              >
                <h3>{plan.name}</h3>
                <p className="landing-plan__price">
                  <span>{plan.price}</span>
                  <small>{plan.period}</small>
                </p>
                <p className="landing-plan__note">{plan.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-cta landing-final-cta" aria-labelledby="final-cta-title">
          <p className="landing-hero__category landing-hero__category--cta">
            El primer gerente digital para pequeños negocios.
          </p>
          <h2 id="final-cta-title">Tu negocio ya genera datos.</h2>
          <p>Es hora de que esos datos trabajen para ti.</p>
          <div className="public-cta__actions">
            <a className="public-btn public-btn--accent" href={accessUrl} onClick={handleAccess}>
              Solicita una demostración
            </a>
            <a
              className="public-btn public-btn--ghost landing-whatsapp-btn"
              href={WHATSAPP_DEMO}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </section>

        <footer className="public-footer">
          <p className="public-footer__brand">
            <strong>{BRAND_NAME}</strong>
          </p>
          <p className="public-footer__tagline">
            El primer gerente digital para pequeños negocios.
          </p>
          <p className="public-footer__latam">Desarrollado en Colombia</p>
        </footer>
      </div>
    </div>
  )
}
