import { useEffect, useState, type MouseEvent } from 'react'
import { BRAND_NAME } from '../../lib/brand'
import { getLoginUrl, getRegisterUrl } from '../../lib/authRoutes'
import { BrandMark } from '../BrandMark'
import { SiteFooter } from '../SiteFooter'

type Props = {
  onLoginClick?: () => void
  onStartClick?: () => void
}

const NAV = [
  { id: 'plataforma', label: 'Plataforma' },
  { id: 'capacidades', label: 'Capacidades' },
  { id: 'inteligencia', label: 'Inteligencia' },
  { id: 'soluciones', label: 'Soluciones' },
  { id: 'arquitectura', label: 'Arquitectura' },
] as const

const LAYERS = [
  { name: 'Organizaciones', text: 'Cada empresa tiene su propio espacio. Los datos no se mezclan.' },
  { name: 'Usuarios y permisos', text: 'Cada persona entra según su rol. Ve y cambia solo lo que le corresponde.' },
  { name: 'Datos compartidos', text: 'Una venta, un movimiento de stock y una cita viven en el mismo registro.' },
  { name: 'Aplicaciones', text: 'Ventas, inventario, caja, agenda, tienda, proyectos y el consultorio odontológico.' },
  { name: 'Inteligencia', text: 'El asistente consulta esos registros y responde con el permiso de quien pregunta.' },
] as const

const CAPABILITIES = [
  ['ERP', 'Catálogo, compras, inventario y operación en un solo sistema.'],
  ['CRM', 'El cliente se arma con ventas y citas ya registradas.'],
  ['Finanzas', 'Ventas, compras, gastos y caja, leídos de la operación.'],
  ['Inventarios', 'Existencias, recetas y compras sobre el mismo stock.'],
  ['Ventas', 'Punto de venta, comandas y el historial de cada transacción.'],
  ['Comercio digital', 'La tienda publica el mismo catálogo y descuenta el mismo inventario.'],
  ['Proyectos', 'Trabajos con cliente, estado y siguiente paso.'],
  ['Equipos', 'Personal, turnos y tareas del negocio.'],
  ['Analítica', 'Indicadores a partir de lo que ya quedó guardado.'],
  ['Asistente', 'Preguntas sobre la operación, contestadas con esos datos.'],
] as const

const QUESTIONS = [
  {
    q: '¿Cómo cerró la operación esta semana?',
    a: 'Lee ventas, medios de pago y el cierre. Responde con lo que está registrado, no con una estimación.',
  },
  {
    q: '¿Qué se está agotando?',
    a: 'Cruza existencias y recetas. Señala lo que está bajo si ese movimiento ya está en el inventario.',
  },
  {
    q: '¿Cuánto debería haber en caja?',
    a: 'Separa el movimiento de efectivo y de Nequi a partir de las ventas y los gastos cargados.',
  },
] as const

const SOLUTIONS = [
  ['VOS Gastro', 'Comandas, recetas, mesas y cierre para cafés y restaurantes.'],
  ['VOS Retail', 'Catálogo de mostrador y tienda con un inventario compartido.'],
  ['VOS Health', 'Módulo odontológico: agenda del consultorio y ficha de pacientes.'],
  ['VOS Services', 'Reservas, servicios y cobro para negocios que viven de citas.'],
  ['VOS Projects', 'Proyectos, equipo y tareas sobre los mismos clientes.'],
] as const

const NODES = [
  { id: 'erp', label: 'Operación', x: 18, y: 28 },
  { id: 'crm', label: 'Clientes', x: 78, y: 24 },
  { id: 'fin', label: 'Finanzas', x: 84, y: 62 },
  { id: 'ops', label: 'Inventario', x: 22, y: 70 },
  { id: 'ai', label: 'Inteligencia', x: 50, y: 12 },
] as const

function scrollToId(id: string) {
  const shell = document.querySelector('.public-shell')
  const el = document.getElementById(id)
  if (!shell || !el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = el.getBoundingClientRect().top - shell.getBoundingClientRect().top + shell.scrollTop - 72
  shell.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
}

export function VosHome({ onLoginClick, onStartClick }: Props) {
  const loginUrl = getLoginUrl()
  const startUrl = getRegisterUrl()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [question, setQuestion] = useState(0)
  const answer = QUESTIONS[question] ?? QUESTIONS[0]

  useEffect(() => {
    document.title = `${BRAND_NAME} — La infraestructura inteligente para gestionar empresas`
    document.querySelector('meta[name="description"]')?.setAttribute(
      'content',
      'VOS IA es una plataforma modular: gestión, ventas, inventario, finanzas y un asistente que consulta los datos de cada empresa.',
    )
  }, [])

  useEffect(() => {
    const shell = document.querySelector('.public-shell')
    if (!shell) return
    const onScroll = () => setScrolled(shell.scrollTop > 8)
    onScroll()
    shell.addEventListener('scroll', onScroll, { passive: true })
    return () => shell.removeEventListener('scroll', onScroll)
  }, [])

  function go(id: string) {
    setOpen(false)
    scrollToId(id)
  }

  function login(e: MouseEvent<HTMLAnchorElement>) {
    if (!onLoginClick) return
    e.preventDefault()
    onLoginClick()
  }

  function start(e: MouseEvent<HTMLAnchorElement>) {
    if (!onStartClick) return
    e.preventDefault()
    onStartClick()
  }

  return (
    <>
      <header className={scrolled ? 'vh-nav is-scrolled' : 'vh-nav'}>
        <div className="vh-wrap vh-nav__bar">
          <a className="vh-nav__brand" href="#/" aria-label={`${BRAND_NAME} inicio`} onClick={(e) => { e.preventDefault(); go('top') }}>
            <BrandMark size="sm" />
          </a>
          <ul className="vh-nav__links">
            {NAV.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => go(item.id)}>{item.label}</button>
              </li>
            ))}
          </ul>
          <div className="vh-nav__actions">
            <a className="vh-btn vh-btn--ghost" href={loginUrl} onClick={login}>Iniciar sesión</a>
            <a className="vh-btn vh-btn--solid" href={startUrl} onClick={start}>Comenzar</a>
          </div>
          <button
            type="button"
            className="vh-nav__menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={open ? 'vh-wrap vh-drawer is-open' : 'vh-wrap vh-drawer'}>
          {NAV.map((item) => (
            <button key={item.id} type="button" onClick={() => go(item.id)}>{item.label}</button>
          ))}
          <a href={loginUrl} onClick={login}>Iniciar sesión</a>
          <a className="vh-btn vh-btn--solid" href={startUrl} onClick={start}>Comenzar</a>
        </div>
      </header>

      <main id="top">
        <section className="vh-wrap vh-hero" aria-labelledby="vh-hero-title">
          <div>
            <p className="vh-kicker">Plataforma empresarial</p>
            <h1 id="vh-hero-title">
              Una plataforma para todo lo que tu empresa puede llegar a ser.
            </h1>
            <p className="vh-lead">
              VOS IA conecta la gestión empresarial, las operaciones y la inteligencia artificial en un ecosistema modular diseñado para crecer.
            </p>
            <div className="vh-hero__cta">
              <button className="vh-btn vh-btn--solid" type="button" onClick={() => go('plataforma')}>Explorar la plataforma</button>
              <button className="vh-btn vh-btn--line" type="button" onClick={() => go('soluciones')}>Conocer nuestras soluciones</button>
            </div>
          </div>
          <CoreMap />
        </section>

        <section className="vh-section" id="plataforma" aria-labelledby="vh-platform">
          <div className="vh-wrap">
            <p className="vh-kicker">La plataforma</p>
            <h2 id="vh-platform">Todo comienza con una plataforma.</h2>
            <p className="vh-section__lead">
              VOS IA es la base. Las aplicaciones de una empresa comparten organización, permisos y datos. Una solución nueva no abre otro sistema: se apoya en el mismo registro.
            </p>
            <ol className="vh-layers">
              {LAYERS.map((layer, i) => (
                <li key={layer.name}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{layer.name}</strong>
                  <p>{layer.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="vh-section" id="capacidades" aria-labelledby="vh-caps">
          <div className="vh-wrap vh-split">
            <div>
              <p className="vh-kicker">Capacidades</p>
              <h2 id="vh-caps">Las capacidades que conectan una empresa.</h2>
              <p className="vh-section__lead">
                No son programas sueltos. Cada una escribe y lee el mismo núcleo.
              </p>
            </div>
            <ul className="vh-spec">
              {CAPABILITIES.map(([name, text]) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="vh-section vh-dark" id="inteligencia" aria-labelledby="vh-ai">
          <div className="vh-wrap">
            <p className="vh-kicker">Inteligencia artificial</p>
            <h2 id="vh-ai">La inteligencia no es un módulo. Es parte de toda la plataforma.</h2>
            <p className="vh-section__lead">
              El asistente no guarda una conversación aparte. Consulta ventas, inventario, caja y el resto de lo registrado, y responde dentro del permiso de quien pregunta. Si el dato no está, no lo inventa.
            </p>
            <div className="vh-ai">
              <ul className="vh-qs" role="tablist" aria-label="Consultas de ejemplo">
                {QUESTIONS.map((item, i) => (
                  <li key={item.q}>
                    <button type="button" role="tab" aria-selected={i === question} className={i === question ? 'is-on' : undefined} onClick={() => setQuestion(i)}>
                      {item.q}
                    </button>
                  </li>
                ))}
              </ul>
              <article className="vh-answer" role="tabpanel">
                <p className="vh-muted">Sobre los datos de la empresa</p>
                <p className="vh-answer__body">{answer.a}</p>
                <p className="vh-note">Ejemplo de cómo responde. Las cifras, cuando las hay, salen de los registros de esa empresa.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="vh-section" id="soluciones" aria-labelledby="vh-solutions">
          <div className="vh-wrap">
            <p className="vh-kicker">Soluciones</p>
            <h2 id="vh-solutions">Una plataforma. Diferentes industrias.</h2>
            <p className="vh-section__lead">
              Cada vertical usa los módulos que le sirven. Todas comparten la misma infraestructura: empresa, permisos y datos.
            </p>
            <ul className="vh-solutions">
              {SOLUTIONS.map(([name, text]) => (
                <li key={name}>
                  <strong>{name}</strong>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="vh-section" id="arquitectura" aria-labelledby="vh-arch">
          <div className="vh-wrap vh-arch">
            <div>
              <p className="vh-kicker">Arquitectura</p>
              <h2 id="vh-arch">Construida para conectarse y evolucionar.</h2>
              <p className="vh-section__lead">
                Las aplicaciones de una empresa hablan el mismo idioma porque nacen del mismo sistema. Un pedido de tienda, una comanda y una cita actualizan el mismo núcleo.
              </p>
            </div>
            <ol className="vh-stack" aria-label="Capas de la plataforma">
              <li><span>Aplicaciones</span><b>Ventas, inventario, agenda, tienda, proyectos, odontología</b></li>
              <li><span>Inteligencia</span><b>Consultas sobre los datos ya registrados</b></li>
              <li><span>Núcleo</span><b>Empresa, usuarios, permisos y el registro compartido</b></li>
            </ol>
          </div>
        </section>

        <section className="vh-section vh-dark vh-cta" aria-labelledby="vh-cta">
          <div className="vh-wrap">
            <h2 id="vh-cta">El siguiente paso de tu empresa comienza aquí.</h2>
            <p className="vh-section__lead">Descubre una nueva forma de conectar, gestionar y desarrollar soluciones empresariales.</p>
            <div className="vh-hero__cta">
              <button className="vh-btn vh-btn--accent" type="button" onClick={() => go('plataforma')}>Explorar VOS IA</button>
              <a className="vh-btn vh-btn--line vh-btn--on-dark" href={startUrl} onClick={start}>Comenzar</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter tagline="Una plataforma. Múltiples soluciones. Inteligencia integrada." />
    </>
  )
}

function CoreMap() {
  return (
    <figure className="vh-core" aria-label="Aplicaciones conectadas al núcleo de VOS IA">
      <svg viewBox="0 0 100 100" role="img">
        {NODES.map((node) => (
          <line key={node.id} x1="50" y1="50" x2={node.x} y2={node.y} />
        ))}
        <circle cx="50" cy="50" r="10" />
      </svg>
      <p className="vh-core__hub">VOS IA</p>
      {NODES.map((node) => (
        <span key={node.id} className={`vh-core__node vh-core__node--${node.id}`} style={{ left: `${node.x}%`, top: `${node.y}%` }}>
          {node.label}
        </span>
      ))}
      <figcaption className="vh-note">Las aplicaciones de una empresa leen y escriben el mismo núcleo.</figcaption>
    </figure>
  )
}
