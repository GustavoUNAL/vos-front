import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { LandingAppModal } from '../LandingAppModal'
import { LANDING_APPS, type LandingApp } from '../landingApps'
import { LandingSection, LandingSectionHeader } from './shared'

type Sector = {
  id: string
  name: string
  modules: string[]
  lead: string
  flow: string[]
  kpis: { label: string; value: string }[]
  scene: { kicker: string; title: string; lines: { label: string; value: string; warn?: boolean }[] }
}

const SECTORS: Sector[] = [
  {
    id: 'cafes',
    name: 'Cafeterías',
    modules: ['sales', 'inventory', 'recipes', 'cash-close'],
    lead: 'Cobrar un latte no es solo una venta: descuenta la receta, mueve el inventario y queda listo para el cierre.',
    flow: ['sales', 'recipes', 'inventory', 'cash-close'],
    kpis: [
      { label: 'Hoy', value: '$482.400' },
      { label: 'Tickets', value: '48' },
      { label: 'Bajos', value: '3' },
    ],
    scene: {
      kicker: 'Operación · cafetería',
      title: 'Latte cobrado',
      lines: [
        { label: 'Receta descontó café y leche', value: 'Hecho' },
        { label: 'Vasos 12 oz', value: '40 u', warn: true },
        { label: 'Cierre de caja', value: 'Listo' },
      ],
    },
  },
  {
    id: 'rest',
    name: 'Restaurantes',
    modules: ['sales', 'inventory', 'recipes', 'staff'],
    lead: 'La comanda baja insumos del plato, el inventario se actualiza y el turno del equipo queda en el mismo sistema.',
    flow: ['sales', 'recipes', 'inventory', 'staff'],
    kpis: [
      { label: 'Comandas', value: '36' },
      { label: 'Turno', value: 'Noche · 4' },
      { label: 'Críticos', value: '2' },
    ],
    scene: {
      kicker: 'Operación · restaurante',
      title: 'Mesa 7 cerrada',
      lines: [
        { label: 'Pasta + bebida', value: '$64.000' },
        { label: 'Insumos del plato', value: 'Descontados' },
        { label: 'Sofía · salón', value: 'Turno PM' },
      ],
    },
  },
  {
    id: 'barber',
    name: 'Barberías',
    modules: ['booking', 'customers', 'sales', 'settings'],
    lead: 'El cliente reserva desde el enlace, llega a la silla, se cobra y queda el historial para la próxima visita.',
    flow: ['settings', 'booking', 'customers', 'sales'],
    kpis: [
      { label: 'Hoy', value: '6 citas' },
      { label: 'Próxima', value: '16:00' },
      { label: 'Web', value: '14' },
    ],
    scene: {
      kicker: 'Operación · barbería',
      title: 'Corte 16:00',
      lines: [
        { label: 'Reserva por el enlace', value: 'Carlos M.' },
        { label: 'Ficha del cliente', value: '12 visitas' },
        { label: 'Cobro en caja', value: '$35.000' },
      ],
    },
  },
  {
    id: 'shop',
    name: 'Comercios',
    modules: ['sales', 'inventory', 'products', 'shop'],
    lead: 'El mismo catálogo sirve en mostrador y en la tienda web. El inventario es uno: si se vende en un canal, baja en el otro.',
    flow: ['products', 'sales', 'inventory', 'shop'],
    kpis: [
      { label: 'Catálogo', value: '124' },
      { label: 'Pedidos web', value: '8' },
      { label: 'Agotados', value: '2' },
    ],
    scene: {
      kicker: 'Operación · comercio',
      title: 'Pedido #1043',
      lines: [
        { label: 'Latte ×2 · tienda web', value: 'Pagado' },
        { label: 'Stock compartido con caja', value: 'Actualizado' },
        { label: 'Precio del catálogo', value: '$8.500' },
      ],
    },
  },
  {
    id: 'svc',
    name: 'Empresas de servicios',
    modules: ['booking', 'customers', 'projects', 'analytics'],
    lead: 'La cita, el cliente y el trabajo se siguen juntos. La analítica sale de esa operación, no de otra planilla.',
    flow: ['booking', 'customers', 'projects', 'analytics'],
    kpis: [
      { label: 'Activos', value: '11' },
      { label: 'Mañana', value: '4 citas' },
      { label: 'Margen', value: '32%' },
    ],
    scene: {
      kicker: 'Operación · servicios',
      title: 'Instalación Norte',
      lines: [
        { label: 'Visita técnica · 10:00', value: 'Confirmada' },
        { label: 'Cliente', value: 'Empresa Norte' },
        { label: 'Siguiente hito', value: 'Viernes' },
      ],
    },
  },
]

function appsFor(ids: string[]): LandingApp[] {
  return ids.map((id) => LANDING_APPS[id]).filter(Boolean)
}

export function LandingSectorsSection() {
  const [active, setActive] = useState(SECTORS[0].id)
  const [open, setOpen] = useState<LandingApp | null>(null)
  const current = SECTORS.find((s) => s.id === active) ?? SECTORS[0]
  const apps = appsFor(current.modules)
  const flow = appsFor(current.flow)

  return (
    <LandingSection id="sectores" ariaLabelledBy="sectors-title" className="lp-sectors">
      <LandingSectionHeader
        className="lp-sectors__head"
        titleId="sectors-title"
        kicker="Negocios"
        title={
          <>
            <span className="lp-sectors__title-full">Cada negocio tiene su recorrido.</span>
            <span className="lp-sectors__title-short">Según el oficio.</span>
          </>
        }
        subtitle="Elija un sector y mire cómo se mueve un día normal."
      />
      <div className="lp-sectors__tabs" role="tablist" aria-label="Sectores">
        {SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === active}
            className={cn('lp-sectors__tab', s.id === active && 'is-on')}
            onClick={() => setActive(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="lp-sectors__adapt" aria-live="polite">
        <div className="lp-sectors__copy">
          <p className="lp-sectors__lead">{current.lead}</p>
          <p className="lp-sectors__label">Cómo se adapta</p>
          <ol className="lp-sectors__flow">
            {flow.map((app, i) => (
              <li key={`${current.id}-flow-${app.view}`}>
                {i > 0 ? <span className="lp-sectors__arrow" aria-hidden /> : null}
                <button
                  type="button"
                  className={`lp-sectors__step lp-apps__tile--${app.tone}`}
                  aria-haspopup="dialog"
                  aria-label={`${app.name}. ${app.text} Abrir detalle.`}
                  onClick={() => setOpen(app)}
                >
                  <span>
                    <strong>{i + 1}. {app.name}</strong>
                    <em>{app.from}</em>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <figure className="lp-sectors__scene">
          <header>
            <p>{current.scene.kicker}</p>
            <strong>{current.scene.title}</strong>
          </header>
          <ul>
            {current.scene.lines.map((line) => (
              <li key={line.label} className={line.warn ? 'is-warn' : undefined}>
                <span>{line.label}</span>
                <b>{line.value}</b>
              </li>
            ))}
          </ul>
          <dl>
            {current.kpis.map((kpi) => (
              <div key={kpi.label}>
                <dt>{kpi.label}</dt>
                <dd>{kpi.value}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>

      <p className="lp-sectors__label">Módulos de este negocio</p>
      <div className="lp-sectors__mods">
        {apps.map((app) => (
          <button
            key={`${current.id}-${app.view}`}
            type="button"
            className={`lp-sectors__mod lp-apps__tile--${app.tone}`}
            aria-haspopup="dialog"
            aria-expanded={open?.view === app.view}
            onClick={() => setOpen(app)}
          >
            <span>{app.name}</span>
          </button>
        ))}
      </div>
      {open ? <LandingAppModal app={open} onClose={() => setOpen(null)} /> : null}
    </LandingSection>
  )
}
