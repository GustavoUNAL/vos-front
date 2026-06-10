import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useAnimatedCounter } from '../../../hooks/useAnimatedCounter'
import { fadeUp, GlassCard, LandingSection, LandingSectionHeader, staggerContainer } from './shared'

const METRICS = [
  { id: 'time', value: 80, suffix: '%', label: 'Menos tiempo buscando información' },
  { id: 'manual', value: 70, suffix: '%', label: 'Menos trabajo manual' },
  { id: 'answers', value: 90, suffix: '%', label: 'Respuestas más rápidas' },
] as const

export function LandingResultsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <LandingSection ariaLabelledBy="results-title">
      <LandingSectionHeader
        titleId="results-title"
        title="Más tiempo para lo que importa"
        subtitle="Menos administración. Más control."
      />

      <motion.div
        ref={ref}
        className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={staggerContainer}
      >
        {METRICS.map((metric) => (
          <MetricCard key={metric.id} metric={metric} active={inView} />
        ))}
        <motion.div variants={fadeUp} transition={{ duration: 0.45 }}>
          <GlassCard className="flex h-full min-h-[7.5rem] flex-col items-center justify-center p-4 text-center sm:min-h-[9rem] sm:p-6">
            <p className="text-3xl font-bold tracking-tight text-[var(--berry-light)] sm:text-5xl">
              24/7
            </p>
            <p className="mt-2 max-w-[12rem] text-xs leading-relaxed text-[var(--muted)] sm:mt-3 sm:text-sm">
              Visibilidad del negocio
            </p>
          </GlassCard>
        </motion.div>
      </motion.div>

      <motion.p
        className="mx-auto mt-12 max-w-2xl text-center text-lg leading-relaxed text-[var(--muted)]"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        Cuando la información está conectada, las decisiones llegan más rápido.
      </motion.p>
    </LandingSection>
  )
}

function MetricCard({
  metric,
  active,
}: {
  metric: (typeof METRICS)[number]
  active: boolean
}) {
  const count = useAnimatedCounter(metric.value, active)

  return (
    <motion.div variants={fadeUp} transition={{ duration: 0.45 }}>
      <GlassCard className="flex h-full min-h-[7.5rem] flex-col items-center justify-center p-4 text-center sm:min-h-[9rem] sm:p-6">
        <p className="text-3xl font-bold tracking-tight text-[var(--heading)] sm:text-5xl">
          <span className="bg-gradient-to-br from-[var(--berry-light)] to-[var(--accent)] bg-clip-text text-transparent">
            {count}
            {metric.suffix}
          </span>
        </p>
        <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-[var(--muted)] sm:mt-3 sm:text-sm">
          {metric.label}
        </p>
      </GlassCard>
    </motion.div>
  )
}
