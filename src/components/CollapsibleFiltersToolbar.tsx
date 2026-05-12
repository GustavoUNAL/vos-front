import { useId, useState, type ReactNode } from 'react'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import { FloatingGearFab } from './FloatingGearFab'

type CollapsibleFiltersToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  onRefresh: () => void
  refreshDisabled?: boolean
  /** Muestra indicador cuando hay filtros distintos al “todo”. */
  hasActiveFilters: boolean
  /** Contenido del panel (tipo, categoría, limpiar, etc.) */
  filterDrawer: ReactNode
}

export function CollapsibleFiltersToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  onRefresh,
  refreshDisabled,
  hasActiveFilters,
  filterDrawer,
}: CollapsibleFiltersToolbarProps) {
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const drawerId = useId()
  const triggerId = useId()

  const bar = (
    <div
      className={`inventory-filter-bar inventory-filter-bar--collapsible costs-toolbar app-toolbar-zone${filtersOpen ? ' is-filters-open' : ''}`}
    >
      <div className="inventory-filter-bar__controls" role="search">
        <label className="inventory-filter">
          <span className="inventory-filter__label">Buscar</span>
          <input
            className="inventory-filter__input"
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchAriaLabel}
          />
        </label>
      </div>
      <div className="inventory-filter-bar__actions">
        <button
          type="button"
          className={`btn-secondary btn-compact btn-filters-toggle${hasActiveFilters ? ' btn-filters-toggle--active' : ''}${filtersOpen ? ' btn-filters-toggle--open' : ''}`}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-controls={drawerId}
          id={triggerId}
          title={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
        >
          <span className="icon-filters" aria-hidden />
          <span className="btn-filters-toggle-label">Filtros</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact"
          onClick={() => void onRefresh()}
          disabled={refreshDisabled}
        >
          Actualizar
        </button>
      </div>
      <div
        id={drawerId}
        role="region"
        aria-label="Filtros"
        hidden={!filtersOpen}
        className={`toolbar-filter-drawer${filtersOpen ? ' is-open' : ''}`}
      >
        {filterDrawer}
      </div>
    </div>
  )

  return (
    <MobileAwareFilterBar
      hasActiveFilters={hasActiveFilters}
      composeMobileToolbar={
        isMobileFilters
          ? ({ filterToggle }) => (
              <FloatingGearFab
                navAriaLabel="Búsqueda y filtros"
                menuToggleTitleClosed="Configuración del listado"
                menuToggleTitleOpen="Cerrar menú"
                ariaLabelMenuClosed="Abrir menú: buscar y más filtros"
                ariaLabelMenuOpen="Cerrar menú de filtros"
                filterToggle={filterToggle}
              />
            )
          : undefined
      }
    >
      {bar}
    </MobileAwareFilterBar>
  )
}
