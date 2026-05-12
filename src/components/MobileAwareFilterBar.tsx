import {
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useMatchMedia } from '../hooks/useMatchMedia'

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
    <button
      type="button"
      className={`btn-mobile-filters${composeMobileToolbar ? ' btn-catalog-dock-tool' : ''}${hasActiveFilters ? ' btn-mobile-filters--active' : ''}${open ? ' btn-mobile-filters--open' : ''}`}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={
        open ? 'Cerrar búsqueda y filtros' : 'Abrir búsqueda, filtros y orden'
      }
      onClick={() => setOpen((v) => !v)}
    >
      <span className="icon-mobile-search" aria-hidden />
      <span className="btn-mobile-filters__label">Buscar</span>
      {hasActiveFilters && !open ? (
        <span className="btn-mobile-filters__dot" title="Hay filtros aplicados" />
      ) : null}
    </button>
  )

  return (
    <div
      className={`mobile-filter-sheet${composeMobileToolbar ? ' mobile-filter-sheet--dock-compose' : ''}`}
    >
      {composeMobileToolbar ? (
        composeMobileToolbar({ filterToggle })
      ) : (
        <div className="mobile-filter-sheet__trigger">
          {filterToggle}
          {trailing ? (
            <div className="mobile-filter-sheet__trailing">{trailing}</div>
          ) : null}
        </div>
      )}
      <div
        id={panelId}
        className={`mobile-filter-sheet__panel${open ? ' is-open' : ''}`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  )
}
