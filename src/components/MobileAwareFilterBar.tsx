import { Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

/** Misma base que en App.css (@media max-width 720px) */
export const MOBILE_FILTER_BREAKPOINT = '(max-width: 720px)'

export type MobileFilterToolbarParts = {
  /** Botón que abre/cierra el panel de filtros (solo móvil). */
  filterToggle: ReactElement
}

type Props = {
  /** Hay filtros distintos al estado inicial (punto / estado activo en el botón). */
  hasActiveFilters?: boolean
  /** Botones que siguen visibles junto al botón de filtros en móvil (ej. Nueva venta). */
  trailing?: ReactNode
  /**
   * Si se define, el disparador del panel no va en la fila por defecto sino dentro de este layout
   * (p. ej. dock flotante). Solo aplica en viewport móvil.
   */
  composeMobileToolbar?: (parts: MobileFilterToolbarParts) => ReactNode
  children: ReactNode
}

export function MobileAwareFilterBar({
  hasActiveFilters = false,
  trailing,
  composeMobileToolbar,
  children,
}: Props) {
  const isMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    if (!isMobile) setOpen(false)
  }, [isMobile])

  if (!isMobile) {
    return <>{children}</>
  }

  const filterToggle = (
    <Button
      type="button"
      variant={open || hasActiveFilters ? 'accent' : 'secondary'}
      size="icon-sm"
      className={cn('relative shrink-0', composeMobileToolbar && 'shrink-0')}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={
        open ? 'Cerrar búsqueda y filtros' : 'Abrir búsqueda, filtros y orden'
      }
      onClick={() => setOpen((v) => !v)}
    >
      <Search className="h-[1rem] w-[1rem]" strokeWidth={2} aria-hidden />
      {hasActiveFilters && !open ? (
        <span
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
          title="Hay filtros aplicados"
        />
      ) : null}
    </Button>
  )

  return (
    <div
      className={cn(
        'mobile-filter-sheet',
        composeMobileToolbar && 'mobile-filter-sheet--dock-compose',
      )}
    >
      {composeMobileToolbar ? (
        composeMobileToolbar({ filterToggle })
      ) : (
        <div className="vos-toolbar mobile-filter-sheet__trigger">
          {filterToggle}
          {trailing ? (
            <div className="vos-toolbar__actions mobile-filter-sheet__trailing">
              {trailing}
            </div>
          ) : null}
        </div>
      )}
      <div
        id={panelId}
        className={cn('mobile-filter-sheet__panel vos-filter-panel', open && 'is-open')}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
