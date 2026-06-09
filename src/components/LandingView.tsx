import { useEffect, type MouseEvent } from 'react'
import { getLandingAdvisorUrl } from '../api'
import { BRAND_NAME } from '../lib/brand'
import {
  getAccessRequestUrl,
  getLoginUrl,
} from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { usePublicTheme } from '../hooks/usePublicTheme'
import { LandingChatMock, type LandingChatTurn } from './landing/LandingChatMock'
import { LandingSalesChat } from './landing/LandingSalesChat'
import '../public-shell.css'

const TAGLINE = 'El primer gerente digital para empresas.'

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

type Plan = {
  name: string
  price: string
  period: string
  note: string
  featured?: boolean
}

const PLANS: Plan[] = [
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
]

const CHAT_HERO: LandingChatTurn[] = [
  {
    who: 'Sofía',
    role: 'user',
    text: '¿Cómo va el negocio hoy? Dame el resumen completo.',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Resumen en vivo · hoy',
    text: 'Analicé ventas, utilidad, rotación e inventario de las últimas 24 h.',
    metrics: [
      { label: 'Vendido', value: '$1.250.000', hint: '+14% vs ayer' },
      { label: 'Utilidad', value: '$420.000', hint: '33,6% margen' },
      { label: 'Ticket prom.', value: '$28.400' },
      { label: 'Ventas', value: '44', hint: 'POS 62% · Web 38%' },
    ],
    bullets: [
      '<strong>Estrella del día:</strong> Mojito Tradicional · 18 uds · $216.000',
      '<strong>Hora pico:</strong> 12:30–14:00 (38% del total)',
    ],
    insight:
      '💡 <strong>Recomendación:</strong> Limón alcanza para ~2 días. Si mañana repites el volumen de hoy, conviene pedir 8 kg antes del viernes.',
  },
]

const CHAT_INVENTORY: LandingChatTurn[] = [
  {
    who: 'Laura',
    role: 'user',
    text: 'Arma mi lista de compras inteligente para esta semana.',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Compras sugeridas · prioridad alta',
    text: 'Cruce ventas de los últimos 14 días con stock actual y mínimos configurados.',
    bullets: [
      '<strong>1. Limón</strong> — 2 días restantes · pedir 8 kg (~$96.000)',
      '<strong>2. Ron blanco</strong> — bajo mínimo · 3 botellas ($285.000)',
      '<strong>3. Vasos 12oz</strong> — rotación alta · 2 paquetes ($48.000)',
      '<strong>4. Menta fresca</strong> — sin movimiento en 5 días · revisar proveedor',
    ],
    insight:
      '🛒 <strong>Inversión estimada:</strong> $380.000 · cubre 6 días de operación normal sin quiebre de stock.',
  },
]

const CHAT_FINANCE: LandingChatTurn[] = [
  {
    who: 'Andrés',
    role: 'user',
    text: '¿Cómo cerramos el mes? Quiero ver si realmente ganamos.',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Finanzas · junio 2026',
    text: 'Consolidé ventas, costos de producto, compras y nómina del mes.',
    metrics: [
      { label: 'Ventas', value: '$18,4M' },
      { label: 'Utilidad prod.', value: '$6,12M', hint: '33% sobre ventas' },
      { label: 'Compras', value: '$4,2M' },
      { label: 'Nómina', value: '$2,8M' },
    ],
    bullets: [
      '<strong>Resultado operativo aprox.:</strong> $11,4M',
      '<strong>Mejor semana:</strong> 2–8 jun ($5,1M)',
      '<strong>Categoría líder:</strong> Bebidas (58% de la utilidad)',
    ],
    insight:
      '📈 Vas <strong>+9%</strong> sobre el mismo mes del año pasado. El margen mejoró porque subió la venta de cócteles premium.',
  },
]

const CHAT_CLIENTS: LandingChatTurn[] = [
  {
    who: 'María',
    role: 'user',
    text: '¿Quién dejó de comprar y qué hacemos para recuperarlos?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Clientes inactivos · +21 días',
    text: 'Detecté 12 perfiles con historial de compra que no han vuelto en 3+ semanas.',
    bullets: [
      '<strong>Mesa 4</strong> — última visita 12 may · gasto prom. $85.000',
      '<strong>Juan P.</strong> — 8 may · pedía los viernes por la tarde',
      '<strong>Empresa XYZ</strong> — 2 may · 4 pedidos corporativos previos',
    ],
    insight:
      '🎯 <strong>Plan sugerido:</strong> mensaje de reactivación este fin de semana con 10% en su producto favorito. Potencial recuperable: ~$640.000/mes.',
  },
]

const CHAT_ALERT: LandingChatTurn[] = [
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Alerta automática · 15:40',
    text: '⚠️ Las ventas de hoy van <strong>18% por debajo</strong> del mismo día la semana pasada.',
    bullets: [
      '<strong>Mayor caída:</strong> Café Americano (−32%)',
      '<strong>Lo que sostiene el día:</strong> Cócteles (+11%)',
    ],
    insight: 'Revisá precio o promoción del Americano entre 11:00 y 13:00.',
  },
  { who: 'Tú', role: 'user', text: '¿Cuál es el producto estrella del mes?' },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Ranking · últimos 30 días',
    metrics: [
      { label: '#1 Brownie', value: '$890K', hint: 'utilidad' },
      { label: '#2 Mojito', value: '$640K' },
      { label: 'Margen', value: '68%', hint: 'brownie' },
    ],
    insight:
      '🏆 <strong>Brownie de chocolate</strong> deja 34% más utilidad que el segundo. Conviene destacarlo en carta y en pedidos web.',
  },
]

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
  const advisorUrl = getLandingAdvisorUrl('Hola, quiero una demo de VOS AI')
  const { theme, toggleTheme } = usePublicTheme()

  useEffect(() => {
    document.title = `${BRAND_NAME} — El primer gerente digital para empresas`
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
            <p className="landing-hero__category">{TAGLINE}</p>
            <h1 id="landing-hero-title">Habla con tu negocio por WhatsApp.</h1>
            <p className="landing-hero__lead">
              {BRAND_NAME} es el gerente digital que te ayuda a administrar ventas,
              inventario, compras y finanzas simplemente conversando.
            </p>
            <div className="landing-hero__actions">
              <a className="public-btn public-btn--accent landing-v2__btn-solid" href={accessUrl} onClick={handleAccess}>
                Solicitar demo
              </a>
              <a className="public-btn public-btn--ghost" href={loginUrl} onClick={handleLogin}>
                Probar con mi negocio
              </a>
            </div>
          </div>

          <LandingChatMock turns={CHAT_HERO} />
        </section>

        <section className="public-section landing-section" aria-labelledby="problem-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">El problema</p>
            <h2 id="problem-title">Administrar una empresa no debería ser un segundo trabajo.</h2>
            <p>
              Cada día los equipos pierden horas revisando ventas, inventario, compras,
              gastos y clientes. La información existe. Pero encontrar respuestas sigue
              siendo difícil.
            </p>
          </div>
        </section>

        <section className="public-section landing-section landing-section--split" aria-labelledby="solution-title">
          <div className="landing-section__split-copy">
            <p className="landing-section__kicker">La solución</p>
            <h2 id="solution-title">Tu negocio ahora puede responderte.</h2>
            <p>Pregunta lo que quieras:</p>
            <ul className="landing-questions landing-questions--inline">
              {QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="landing-section__after">
              {BRAND_NAME} analiza toda la operación y responde en segundos.
            </p>
          </div>
          <LandingChatMock turns={CHAT_INVENTORY} compact />
        </section>

        <section className="public-section landing-section" aria-labelledby="how-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">¿Cómo funciona?</p>
            <h2 id="how-title">Tres pasos. Sin complicaciones.</h2>
          </div>
          <div className="landing-how-grid">
            <div className="public-steps landing-how-grid__steps">
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
            <LandingChatMock turns={CHAT_FINANCE} compact className="landing-how-grid__chat" />
          </div>
        </section>

        <section className="public-section landing-section" aria-labelledby="compare-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Más que un POS</p>
            <h2 id="compare-title">No es otro software. Es un gerente digital.</h2>
          </div>
          <div className="landing-compare-wrap">
            <table className="landing-compare">
              <colgroup>
                <col className="landing-compare__col-feature" />
                <col className="landing-compare__col-check" />
                <col className="landing-compare__col-check" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Característica</th>
                  <th scope="col">
                    <span className="landing-compare__label-long">POS tradicional</span>
                    <span className="landing-compare__label-short">POS</span>
                  </th>
                  <th scope="col">
                    <span className="landing-compare__label-long">{BRAND_NAME}</span>
                    <span className="landing-compare__label-short">VOS</span>
                  </th>
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

        <section className="public-section landing-section landing-section--split landing-section--split-reverse" aria-labelledby="pillars-title">
          <div className="landing-section__split-copy">
            <p className="landing-section__kicker">Todo lo que tu empresa necesita</p>
            <h2 id="pillars-title">Operación completa. Respuestas simples.</h2>
            <div className="public-grid public-grid--2 landing-pillars-compact">
              {PILLARS.map((p) => (
                <article key={p.title} className="public-card landing-pillar">
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                </article>
              ))}
            </div>
          </div>
          <LandingChatMock turns={CHAT_CLIENTS} compact />
        </section>

        <section className="public-section landing-section landing-section--split" aria-labelledby="auto-title">
          <div className="landing-section__split-copy">
            <p className="landing-section__kicker">Automatizaciones inteligentes</p>
            <h2 id="auto-title">{BRAND_NAME} puede:</h2>
            <ul className="landing-bullets">
              {AUTOMATIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <LandingChatMock turns={CHAT_ALERT} compact />
        </section>

        <section className="public-section landing-section" aria-labelledby="industries-title">
          <div className="public-section__head">
            <p className="landing-section__kicker">Diseñado para empresas reales</p>
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
            <li>Controla tu empresa desde cualquier lugar.</li>
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
          <p className="landing-hero__category landing-hero__category--cta">{TAGLINE}</p>
          <h2 id="final-cta-title">Tu empresa ya genera datos.</h2>
          <p>Es hora de que esos datos trabajen para ti.</p>
          <div className="public-cta__actions">
            <a className="public-btn public-btn--accent landing-v2__btn-solid" href={accessUrl} onClick={handleAccess}>
              Solicita una demostración
            </a>
            {advisorUrl ? (
              <a
                className="public-btn public-btn--ghost landing-whatsapp-btn"
                href={advisorUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Hablar con un asesor
              </a>
            ) : null}
          </div>
        </section>

        <footer className="public-footer landing-v2__footer">
          <p className="public-footer__brand">
            <strong>{BRAND_NAME}</strong>
          </p>
          <p className="public-footer__tagline">{TAGLINE}</p>
          <p className="landing-footer__fine">
            © {new Date().getFullYear()} {BRAND_NAME}. Todos los derechos reservados.
          </p>
        </footer>
      </div>

      <LandingSalesChat />
    </div>
  )
}
