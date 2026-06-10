import { motion } from 'framer-motion'
import type { MouseEvent } from 'react'
import { BRAND_NAME } from '../../../lib/brand'
import { cn } from '../../../lib/utils'

type Props = {
  accessUrl: string
  onAccess?: (e: MouseEvent<HTMLAnchorElement>) => void
  onDemo?: () => void
}

export function LandingFinalCtaSection({ accessUrl, onAccess, onDemo }: Props) {
  return (
    <section
      className="lp-final-cta public-cta landing-final-cta relative flex min-h-[88vh] items-center justify-center overflow-hidden px-4 py-20 sm:px-6"
      aria-labelledby="final-cta-title"
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 40%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 60%, color-mix(in srgb, var(--berry) 14%, transparent), transparent 50%), color-mix(in srgb, var(--surface-elevated) 40%, var(--surface))',
          backgroundSize: '200% 200%',
        }}
      />

      <motion.div
        className="relative z-[1] mx-auto w-full max-w-3xl text-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2
          id="final-cta-title"
          className="text-3xl font-semibold leading-tight tracking-tight text-[var(--heading)] sm:text-4xl md:text-[2.75rem]"
        >
          Deja de administrar hojas de cálculo.
        </h2>
        <p className="mt-4 text-2xl font-medium text-[var(--berry-light)] sm:text-3xl">
          Empieza a conversar con tu negocio.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          {BRAND_NAME} conecta ventas, inventario, compras, finanzas y clientes para
          ayudarte a tomar mejores decisiones cada día.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <motion.a
            href={accessUrl}
            onClick={onAccess}
            className={cn(
              'vos-btn vos-btn--primary vos-btn--lg relative min-w-[12rem] overflow-hidden px-8',
              'shadow-[0_0_40px_color-mix(in_srgb,var(--berry-glow)_90%,transparent)]',
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.span
              className="pointer-events-none absolute inset-0 opacity-60"
              aria-hidden
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--berry-light) 35%, transparent), transparent 70%)',
              }}
            />
            <span className="relative">Solicitar acceso</span>
          </motion.a>
          <button
            type="button"
            className="vos-btn vos-btn--secondary vos-btn--lg min-w-[12rem] px-8"
            onClick={onDemo}
          >
            Ver demostración
          </button>
        </div>
      </motion.div>
    </section>
  )
}
