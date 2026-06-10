import { motion } from 'framer-motion'
import { BRAND_NAME } from '../../../lib/brand'
import { cn } from '../../../lib/utils'
import { fadeUp, GlassCard, LandingSection, LandingSectionHeader, staggerContainer } from './shared'

const POS_ITEMS = [
  'Registra ventas',
  'Muestra reportes básicos',
  'Guarda información',
  'Requiere análisis manual',
  'Funciona como herramienta de caja',
] as const

const VOS_ITEMS = [
  'Entiende tu operación',
  'Explica lo que ocurre',
  'Detecta oportunidades',
  'Recomienda acciones',
  'Responde preguntas en lenguaje natural',
] as const

export function LandingCompareSection() {
  return (
    <LandingSection ariaLabelledBy="compare-title">
      <LandingSectionHeader
        titleId="compare-title"
        title="Más que un POS"
        subtitle="No somos una caja registradora digital. Somos el sistema operativo de tu negocio."
      />

      <div className="relative">
        <motion.div
          className="mb-4 flex justify-center sm:pointer-events-none sm:absolute sm:-top-3 sm:right-0 sm:z-10 sm:mb-0 md:-top-4 md:right-4"
          initial={{ opacity: 0, y: -12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <span className="inline-flex max-w-full rounded-full border border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_75%,var(--surface-elevated))] px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-[var(--accent-text)] shadow-[0_8px_28px_color-mix(in_srgb,var(--accent)_18%,transparent)] sm:px-4 sm:py-1.5 sm:text-xs">
            Nueva generación de software empresarial
          </span>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
        >
          <CompareColumn title="POS tradicional" items={POS_ITEMS} variant="pos" />
          <CompareColumn title={BRAND_NAME} items={VOS_ITEMS} variant="vos" highlight />
        </motion.div>
      </div>
    </LandingSection>
  )
}

function CompareColumn({
  title,
  items,
  variant,
  highlight = false,
}: {
  title: string
  items: readonly string[]
  variant: 'pos' | 'vos'
  highlight?: boolean
}) {
  return (
    <GlassCard
      className={cn(
        'group overflow-hidden p-3 sm:p-5 md:p-6',
        highlight &&
          'ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)] sm:scale-[1.01] md:scale-[1.02]',
      )}
      hover
    >
      <motion.div variants={fadeUp} transition={{ duration: 0.45 }}>
        <p
          className={cn(
            'mb-3 text-[0.65rem] font-bold uppercase tracking-[0.06em] sm:mb-5 sm:text-sm sm:tracking-[0.08em]',
            variant === 'vos' ? 'text-[var(--berry-light)]' : 'text-[var(--muted)]',
          )}
        >
          {title}
        </p>
        <ul className="space-y-1.5 sm:space-y-2.5" role="list">
          {items.map((item, i) => (
            <motion.li
              key={item}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className={cn(
                'rounded-lg border px-2.5 py-2 text-[0.7rem] leading-snug transition-colors duration-200 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm',
                variant === 'vos'
                  ? 'border-[color-mix(in_srgb,var(--accent)_22%,var(--border))] bg-[color-mix(in_srgb,var(--accent-soft)_35%,transparent)] text-[var(--heading)] group-hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))]'
                  : 'border-[color-mix(in_srgb,var(--border)_65%,transparent)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] text-[var(--muted)] hover:text-[var(--heading)]',
              )}
            >
              {item}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </GlassCard>
  )
}
