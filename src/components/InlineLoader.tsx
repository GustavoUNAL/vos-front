import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

type InlineLoaderProps = {
  label?: string
  /** inline = en fila; block = centrado en bloque */
  layout?: 'inline' | 'block'
  size?: 'sm' | 'md'
  className?: string
}

export function InlineLoader({
  label = 'Cargando…',
  layout = 'inline',
  size = 'md',
  className,
}: InlineLoaderProps) {
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div
      className={cn(
        'inline-loader',
        layout === 'block' && 'inline-loader--block',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <Loader2
        className={cn('inline-loader__icon animate-spin', iconClass)}
        strokeWidth={2.25}
        aria-hidden
      />
      {label ? <span className="inline-loader__label">{label}</span> : null}
    </div>
  )
}
