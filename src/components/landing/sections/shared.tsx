import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
}

type SectionHeaderProps = {
  kicker?: string
  title: string
  titleId?: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
}

export function LandingSectionHeader({
  kicker,
  title,
  titleId,
  subtitle,
  align = 'center',
  className,
}: SectionHeaderProps) {
  return (
    <motion.header
      className={cn(
        'mb-8 max-w-3xl sm:mb-12',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className,
      )}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {kicker ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--berry-light)]">
          {kicker}
        </p>
      ) : null}
      <h2
        id={titleId}
        className="text-2xl font-semibold leading-tight tracking-tight text-[var(--heading)] sm:text-3xl md:text-[2rem]"
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">{subtitle}</p>
      ) : null}
    </motion.header>
  )
}

type GlassCardProps = {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function GlassCard({ children, className, hover = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[color-mix(in_srgb,var(--border)_72%,transparent)]',
        'bg-[color-mix(in_srgb,var(--surface-elevated)_68%,transparent)] backdrop-blur-md',
        'shadow-[0_20px_50px_color-mix(in_srgb,var(--shadow-soft)_55%,transparent)]',
        hover &&
          'transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:shadow-[0_28px_60px_color-mix(in_srgb,var(--shadow-soft)_70%,transparent)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function LandingSection({
  id,
  ariaLabelledBy,
  children,
  className,
}: {
  id?: string
  ariaLabelledBy?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn('lp-section public-section landing-section', className)}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </section>
  )
}
