import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { fadeUp, GlassCard, LandingSection, LandingSectionHeader } from './shared'

type IndustryId =
  | 'cafeterias'
  | 'bares'
  | 'restaurantes'
  | 'tiendas'
  | 'ferreterias'
  | 'farmacias'
  | 'servicios'

type IndustryPreset = {
  id: IndustryId
  label: string
  products: string[]
  kpis: { label: string; value: string }[]
  inventory: { item: string; status: string }[]
}

const INDUSTRIES: IndustryPreset[] = [
  {
    id: 'cafeterias',
    label: 'Cafeterías',
    products: ['Capuccino', 'Latte', 'Espresso'],
    kpis: [
      { label: 'Ventas del día', value: '$1.250.000' },
      { label: 'Margen promedio', value: '34,2%' },
      { label: 'Inventario de café', value: '12 kg' },
    ],
    inventory: [
      { item: 'Café molido', status: '4 días' },
      { item: 'Leche entera', status: '2 días' },
      { item: 'Vasos 12 oz', status: 'OK' },
    ],
  },
  {
    id: 'bares',
    label: 'Bares',
    products: ['Mojito', 'Gin tonic', 'Cerveza artesanal'],
    kpis: [
      { label: 'Ventas del día', value: '$2.180.000' },
      { label: 'Ticket promedio', value: '$48.500' },
      { label: 'Hora pico', value: '21:00' },
    ],
    inventory: [
      { item: 'Ron blanco', status: '3 días' },
      { item: 'Menta fresca', status: 'Crítico' },
      { item: 'Hielo', status: 'OK' },
    ],
  },
  {
    id: 'restaurantes',
    label: 'Restaurantes',
    products: ['Pasta del día', 'Proteína a la plancha', 'Postre de temporada'],
    kpis: [
      { label: 'Cubiertos hoy', value: '186' },
      { label: 'Food cost', value: '28,4%' },
      { label: 'Rotación mesa', value: '2,1x' },
    ],
    inventory: [
      { item: 'Proteína res', status: '2 días' },
      { item: 'Verduras', status: '1 día' },
      { item: 'Aceite', status: 'OK' },
    ],
  },
  {
    id: 'tiendas',
    label: 'Tiendas',
    products: ['Camiseta básica', 'Jean slim', 'Zapatillas urbanas'],
    kpis: [
      { label: 'Ventas del día', value: '$890.000' },
      { label: 'Conversión', value: '18,6%' },
      { label: 'Stock bajo', value: '7 SKUs' },
    ],
    inventory: [
      { item: 'Talla M — camiseta', status: 'Crítico' },
      { item: 'Jean 32', status: 'OK' },
      { item: 'Zapatillas 42', status: '5 uds' },
    ],
  },
  {
    id: 'ferreterias',
    label: 'Ferreterías',
    products: ['Cable THHN', 'Breakers', 'Tubería PVC'],
    kpis: [
      { label: 'Inventario crítico', value: '5 ítems' },
      { label: 'Compras sugeridas', value: '$1.420.000' },
      { label: 'Productos más vendidos', value: 'Cable 2.5 mm' },
    ],
    inventory: [
      { item: 'Cable THHN', status: 'Crítico' },
      { item: 'Breakers 20A', status: '3 días' },
      { item: 'Tubería PVC', status: 'OK' },
    ],
  },
  {
    id: 'farmacias',
    label: 'Farmacias',
    products: ['Acetaminofén', 'Omeprazol', 'Suero oral'],
    kpis: [
      { label: 'Ventas del día', value: '$980.000' },
      { label: 'Controlados', value: '142 ítems' },
      { label: 'Vencimientos', value: '8 próximos' },
    ],
    inventory: [
      { item: 'Acetaminofén 500 mg', status: 'OK' },
      { item: 'Suero oral', status: 'Crítico' },
      { item: 'Alcohol antiséptico', status: '5 días' },
    ],
  },
  {
    id: 'servicios',
    label: 'Servicios',
    products: ['Consultoría', 'Mantenimiento', 'Instalación'],
    kpis: [
      { label: 'Citas del día', value: '14' },
      { label: 'Ingresos proyectados', value: '$620.000' },
      { label: 'Clientes activos', value: '128' },
    ],
    inventory: [
      { item: 'Repuestos A', status: 'OK' },
      { item: 'Kit estándar', status: '2 kits' },
      { item: 'Consumibles', status: 'Pedir' },
    ],
  },
]

export function LandingIndustriesSection() {
  const [activeId, setActiveId] = useState<IndustryId>('cafeterias')
  const active = INDUSTRIES.find((i) => i.id === activeId) ?? INDUSTRIES[0]

  return (
    <LandingSection ariaLabelledBy="industries-title">
      <LandingSectionHeader
        titleId="industries-title"
        title="Hecho para negocios como el tuyo"
        subtitle="Adaptamos la plataforma a la realidad de cada negocio."
      />

      <div
        className="lp-industry-tabs mb-6 flex gap-2 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:justify-center sm:overflow-visible"
        role="tablist"
        aria-label="Tipo de negocio"
      >
        {INDUSTRIES.map((industry) => (
          <button
            key={industry.id}
            type="button"
            role="tab"
            aria-selected={activeId === industry.id}
            aria-controls="industry-panel"
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-4 sm:py-2 sm:text-sm',
              activeId === industry.id
                ? 'border-[color-mix(in_srgb,var(--accent)_50%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_70%,var(--surface-elevated))] text-[var(--heading)] shadow-[0_0_24px_color-mix(in_srgb,var(--accent)_14%,transparent)]'
                : 'border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-elevated)_50%,transparent)] text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] hover:text-[var(--heading)]',
            )}
            onClick={() => setActiveId(industry.id)}
          >
            {industry.label}
          </button>
        ))}
      </div>

      <GlassCard className="overflow-hidden p-3 sm:p-6 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            id="industry-panel"
            role="tabpanel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div>
              <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--berry-light)] sm:mb-4 sm:text-xs">
                Dashboard de ejemplo · {active.label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {active.kpis.map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.35 }}
                    className={cn(
                      'rounded-lg border border-[color-mix(in_srgb,var(--border)_65%,transparent)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-2.5 sm:rounded-xl sm:p-4',
                      i === 2 && 'col-span-2 sm:col-span-1',
                    )}
                  >
                    <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--muted)] sm:text-[0.65rem]">
                      {kpi.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--heading)] sm:mt-1 sm:text-lg">
                      {kpi.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-1">
              <div>
                <h3 className="mb-2 text-xs font-semibold text-[var(--heading)] sm:mb-3 sm:text-sm">
                  Productos
                </h3>
                <ul className="space-y-2" role="list">
                  {active.products.map((product, i) => (
                    <motion.li
                      key={product}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="rounded-lg border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-2 py-1.5 text-[0.72rem] text-[var(--heading)] sm:px-3 sm:py-2 sm:text-sm"
                    >
                      {product}
                    </motion.li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-[var(--heading)] sm:mb-3 sm:text-sm">
                  Inventario
                </h3>
                <ul className="space-y-2" role="list">
                  {active.inventory.map((row, i) => (
                    <motion.li
                      key={row.item}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + i * 0.05 }}
                      className="flex flex-col gap-0.5 rounded-lg border border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2"
                    >
                      <span className="text-[0.72rem] text-[var(--heading)] sm:text-sm">{row.item}</span>
                      <span className="text-[0.65rem] font-medium text-[var(--muted)] sm:text-xs">
                        {row.status}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </GlassCard>
    </LandingSection>
  )
}
