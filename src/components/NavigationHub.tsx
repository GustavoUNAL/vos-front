import { SALES_FLOOR_ONLY } from '../appScope'
import type { NavGroupId } from '../navTypes'

export type HubTargetView =
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'sales'
  | 'pos'
  | 'purchases'
  | 'costs'
  | 'gastos'
  | 'explorer'

type HubSection = {
  id: NavGroupId
  title: string
  hint: string
  items: { view: HubTargetView; label: string; hint: string }[]
}

function HubCardIcon({ view }: { view: HubTargetView }) {
  const c = 'nav-hub-card__glyph'
  switch (view) {
    case 'products':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'recipes':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 3h12a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="M9 8h6M9 12h4"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'inventory':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 16.5V8.2a1.9 1.9 0 0 0-.9-1.6l-7-4.1a1.9 1.9 0 0 0-2 0l-7 4.1A1.9 1.9 0 0 0 3 8.2v8.3a1.9 1.9 0 0 0 1 1.6l7 4.1a1.9 1.9 0 0 0 2 0l7-4.1a1.9 1.9 0 0 0 1-1.6Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="m3.3 7.7 8.7 5 8.7-5M12 22V12.7"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'sales':
    case 'pos':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9h15l-1.5 9h-12L6 9Zm0 0L5 3H2"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.35" fill="currentColor" />
          <circle cx="18" cy="20" r="1.35" fill="currentColor" />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 3v2m6-2v2M5 9h14l-1 12H6L5 9Zm0 0-.7-3.5A1 1 0 0 1 5.3 4h13.4a1 1 0 0 1 .9 1.5L19 9"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'costs':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 4h10v16H7V4Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="M10 8h4M10 12h4M10 16h2"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'gastos':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="M8 11h8M8 15h5"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'explorer':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <ellipse
            cx="12"
            cy="6.5"
            rx="7"
            ry="3"
            stroke="currentColor"
            strokeWidth="1.35"
          />
          <path
            d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    default:
      return null
  }
}

export function NavigationHub({
  inventoryHint,
  purchasesHint,
  onNavigate,
}: {
  inventoryHint: string
  purchasesHint: string
  onNavigate: (view: HubTargetView) => void
}) {
  const sections: HubSection[] = SALES_FLOOR_ONLY
    ? [
        {
          id: 'catalog',
          title: 'Productos a la venta',
          hint: 'Carta, precios, categorías y visibilidad',
          items: [
            {
              view: 'products',
              label: 'Productos a la venta',
              hint: 'Configuración de la carta',
            },
          ],
        },
        {
          id: 'sales',
          title: 'Ventas',
          hint: 'Tickets, cobros e historial',
          items: [
            {
              view: 'sales',
              label: 'Ventas',
              hint: 'Registrar y consultar ventas',
            },
          ],
        },
      ]
    : [
        {
          id: 'catalog',
          title: 'Productos a la venta',
          hint: 'Carta, recetas y fichas',
          items: [
            {
              view: 'products',
              label: 'Productos a la venta',
              hint: 'Carta y precios',
            },
            {
              view: 'recipes',
              label: 'Recetas',
              hint: 'Fichas técnicas',
            },
          ],
        },
        {
          id: 'stock',
          title: 'Inventario',
          hint:
            [inventoryHint, purchasesHint].filter(Boolean).join(' · ') ||
            'Insumos en existencia y compras por lote',
          items: [
            {
              view: 'inventory',
              label: 'Productos',
              hint: 'Insumos y existencias por ítem',
            },
            {
              view: 'purchases',
              label: 'Compras',
              hint: 'Lotes de compra y proveedores',
            },
          ],
        },
        {
          id: 'sales',
          title: 'Ventas',
          hint: 'Ingresos del día',
          items: [
            {
              view: 'sales',
              label: 'Ventas',
              hint: 'Tickets y cobros',
            },
            {
              view: 'pos',
              label: 'POS · Mesas',
              hint: 'Salón, pedidos y cobro en vivo',
            },
          ],
        },
        {
          id: 'finance',
          title: 'Finanzas',
          hint: 'Costos y gastos operativos',
          items: [
            {
              view: 'costs',
              label: 'Costos',
              hint: 'Costos por producto',
            },
            {
              view: 'gastos',
              label: 'Gastos',
              hint: 'Fijos y variables',
            },
          ],
        },
        {
          id: 'data',
          title: 'Datos',
          hint: 'Consultas de solo lectura',
          items: [
            {
              view: 'explorer',
              label: 'Explorador DB',
              hint: 'Tablas en lectura',
            },
          ],
        },
      ]

  return (
    <div className="nav-hub nav-hub--dashboard">
      <h1 className="sr-only">vos.ai — inicio</h1>

      <div className="nav-hub__sections">
        {sections.map((section) => (
          <section
            key={section.id}
            className={`nav-hub__section nav-hub__section--${section.id}`}
            aria-labelledby={`hub-${section.id}-title`}
          >
            <div className="nav-hub__section-head">
              <h2 className="nav-hub__section-title" id={`hub-${section.id}-title`}>
                {section.title}
              </h2>
              <p className="nav-hub__section-hint">{section.hint}</p>
            </div>
            <ul className="nav-hub__cards">
              {section.items.map((item) => (
                <li key={item.view}>
                  <button
                    type="button"
                    className="nav-hub-card"
                    onClick={() => onNavigate(item.view)}
                  >
                    <span className="nav-hub-card__icon" aria-hidden>
                      <HubCardIcon view={item.view} />
                    </span>
                    <span className="nav-hub-card__body">
                      <span className="nav-hub-card__label">{item.label}</span>
                      <span className="nav-hub-card__hint">{item.hint}</span>
                    </span>
                    <span className="nav-hub-card__arrow" aria-hidden>
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
