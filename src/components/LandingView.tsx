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

const MODULES = [
  {
    title: 'Agente IA operativo',
    text: 'Asistente que interpreta ventas, stock y márgenes para recomendarte qué comprar, qué promocionar y qué revisar hoy.',
  },
  {
    title: 'Inventario inteligente',
    text: 'Stock en vivo, mínimos, movimientos y alertas — conectado a compras y costos reales de tu negocio.',
  },
  {
    title: 'Bares y restaurantes',
    text: 'Carta, cocina, mesas, comandas, caja y flujo salón en un solo panel multi-sucursal.',
  },
  {
    title: 'Farmacias',
    text: 'Catálogo, lotes, trazabilidad y control de productos con reglas de inventario y ventas diarias.',
  },
  {
    title: 'Supermercados',
    text: 'Alto volumen de SKUs, categorías, proveedores y rotación — pensado para retail de consumo masivo.',
  },
  {
    title: 'Carrito de compras',
    text: 'Tienda web con checkout, pedidos al POS y seguimiento — tu canal online integrado al local.',
  },
  {
    title: 'Ventas y POS',
    text: 'Comprobantes, calendario, caja, mesas y cobro — todo sincronizado con inventario y finanzas.',
  },
  {
    title: 'Compras y finanzas',
    text: 'Lotes, proveedores, márgenes y analítica para ver la salud del negocio sin planillas sueltas.',
  },
] as const

const INDUSTRIES = [
  {
    title: 'Restaurantes',
    text: 'Menú, cocina, delivery y caja con datos unificados y un agente que te avisa antes de que falte insumo.',
  },
  {
    title: 'Bares y nightlife',
    text: 'Comandas rápidas, turnos, inventario de licores y ventas por mesa en tiempo real.',
  },
  {
    title: 'Farmacias',
    text: 'Control de stock sensible, rotación y ventas con trazabilidad por producto y sucursal.',
  },
  {
    title: 'Supermercados',
    text: 'Miles de referencias, categorías, compras recurrentes y tienda online conectada al almacén.',
  },
] as const

const INTEGRATIONS = [
  {
    title: 'Bases de datos existentes',
    text: 'Conectá PostgreSQL, MySQL, Neon u otros orígenes — migrá sin empezar de cero.',
  },
  {
    title: 'Excel y CSV',
    text: 'Importá catálogos, inventario y ventas desde planillas; exportá reportes cuando lo necesites.',
  },
  {
    title: 'WhatsApp y pagos',
    text: 'Comprobantes, avisos de pedidos y cobros locales (Nequi, Bre-B, efectivo).',
  },
  {
    title: 'API y más',
    text: 'Integraciones a medida: ERPs, e-commerce, contabilidad y flujos propios de tu empresa.',
  },
] as const

const FAQ = [
  {
    q: '¿Qué es VOS AI?',
    a: 'Un agente de inteligencia artificial para tu negocio: opera inventario, ventas, POS y tienda, y te ayuda a decidir con datos reales.',
  },
  {
    q: '¿Cómo obtengo acceso?',
    a: 'Enviá el formulario “Solicitar una prueba”. Revisamos tu caso y activamos tu empresa manualmente.',
  },
  {
    q: '¿Puedo traer mis datos actuales?',
    a: 'Sí. Integramos bases de datos existentes, Excel y otros formatos para no perder tu historial.',
  },
  {
    q: '¿Incluye carrito de compras?',
    a: 'Sí. Tienda pública con checkout conectado al POS y al inventario de tu local.',
  },
] as const

type Props = {
  onLoginClick?: () => void
  onAccessRequestClick?: () => void
}

export function LandingView({ onLoginClick, onAccessRequestClick }: Props) {
  const loginUrl = getLoginUrl()
  const accessUrl = getAccessRequestUrl()
  const { theme, toggleTheme } = usePublicTheme()

  useEffect(() => {
    document.title = `${BRAND_NAME} — Agente de inteligencia artificial para tu negocio`
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
    <div className="public-shell">
      <div className="public-shell__grid-bg" aria-hidden />
      <div className="public-shell__orbs" aria-hidden>
        <span className="public-orb public-orb--a" />
        <span className="public-orb public-orb--b" />
        <span className="public-orb public-orb--c" />
      </div>

      <header className="public-topbar public-topbar--minimal">
        <BrandMark size="sm" />
        <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
      </header>

      <div className="public-wrap">
        <section className="public-hero public-hero--wide">
          <div className="public-hero__glow" aria-hidden />
          <p className="public-hero__eyebrow">Agente de inteligencia artificial</p>
          <h1>{BRAND_NAME}</h1>
          <p className="public-hero__lead">
            El copiloto que entiende tu negocio: inventario, ventas, clientes y márgenes — con
            recomendaciones accionables, no solo reportes.
          </p>
          <p className="public-hero__lead public-hero__lead--secondary">
            Módulos para bares, restaurantes, farmacias y supermercados. Carrito de compras,
            POS, compras y finanzas en una plataforma multi-empresa hecha para operar en LATAM.
          </p>

          <div className="public-hero__actions">
            <a className="public-btn public-btn--accent" href={accessUrl} onClick={handleAccess}>
              Solicitar una prueba
            </a>
            <a className="public-btn public-btn--ghost" href={loginUrl} onClick={handleLogin}>
              Iniciar sesión
            </a>
          </div>

          <div className="public-stats">
            <div className="public-stat"><strong>IA</strong><span>Agente operativo</span></div>
            <div className="public-stat"><strong>POS</strong><span>Bares y restaurantes</span></div>
            <div className="public-stat"><strong>Retail</strong><span>Farmacias y super</span></div>
            <div className="public-stat"><strong>Web</strong><span>Carrito integrado</span></div>
          </div>
        </section>

        <section className="public-section" aria-labelledby="modules-title">
          <div className="public-section__head">
            <h2 id="modules-title">Módulos que operan y venden por vos</h2>
            <p>
              Desde el insumo hasta el checkout online: un agente IA sobre inventario, ventas,
              compras y tienda — adaptado a cómo trabajás hoy.
            </p>
          </div>
          <div className="public-grid">
            {MODULES.map((m) => (
              <article key={m.title} className="public-card">
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section" aria-labelledby="use-title">
          <div className="public-section__head">
            <h2 id="use-title">Industrias que potenciamos</h2>
            <p>Configuración y flujos pensados para cada rubro, con datos aislados por empresa.</p>
          </div>
          <div className="public-grid public-grid--4">
            {INDUSTRIES.map((u) => (
              <article key={u.title} className="public-card public-card--flat">
                <h3>{u.title}</h3>
                <p>{u.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section" aria-labelledby="int-title">
          <div className="public-section__head">
            <h2 id="int-title">Integración con lo que ya usás</h2>
            <p>
              No hace falta tirar Excel ni cambiar de base de datos de un día para el otro —
              conectamos, importamos y seguimos creciendo.
            </p>
          </div>
          <div className="public-grid public-grid--4">
            {INTEGRATIONS.map((i) => (
              <article key={i.title} className="public-card public-card--flat">
                <h3>{i.title}</h3>
                <p>{i.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section" aria-labelledby="how-title">
          <div className="public-section__head">
            <h2 id="how-title">Cómo empezar</h2>
          </div>
          <div className="public-steps">
            <article className="public-step">
              <h3>Solicitás una prueba</h3>
              <p>Contanos tu rubro y volumen — bares, farmacia, super o restaurante.</p>
            </article>
            <article className="public-step">
              <h3>Integramos tus datos</h3>
              <p>Base existente, Excel o arranque limpio — te armamos el tenant.</p>
            </article>
            <article className="public-step">
              <h3>Tu agente opera</h3>
              <p>Panel, POS, carrito y recomendaciones IA desde el primer día.</p>
            </article>
          </div>
        </section>

        <section className="public-section" aria-labelledby="faq-title">
          <div className="public-section__head">
            <h2 id="faq-title">Preguntas frecuentes</h2>
          </div>
          <div className="public-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="public-faq__item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="public-cta" aria-labelledby="cta-title">
          <h2 id="cta-title">¿Listo para tu agente de IA?</h2>
          <p>Solicitá una prueba y activamos tu negocio con módulos, carrito e integraciones.</p>
          <div className="public-cta__actions">
            <a className="public-btn public-btn--accent" href={accessUrl} onClick={handleAccess}>
              Solicitar una prueba
            </a>
            <a className="public-btn public-btn--ghost" href={loginUrl} onClick={handleLogin}>
              Iniciar sesión
            </a>
          </div>
        </section>

        <footer className="public-footer">
          <p className="public-footer__brand">
            <strong>{BRAND_NAME}</strong>
          </p>
          <p className="public-footer__tagline">
            Agente de inteligencia artificial para tu negocio
          </p>
          <p className="public-footer__latam">Desarrollado en Colombia</p>
        </footer>
      </div>
    </div>
  )
}
