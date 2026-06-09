import type { ReactNode } from 'react'
import { FloatingGearFabDockAdd } from './FloatingGearFab'

export type MobileModuleViewMode = 'calendar' | 'list' | 'grid'

type Props = {
  onAdd?: () => void
  addTitle?: string
  addAriaLabel?: string
  summary?: ReactNode
  viewMode?: MobileModuleViewMode
  onViewModeChange?: (mode: MobileModuleViewMode) => void
  primaryViewLabel?: string
  secondaryViewLabel?: string
  primaryViewValue?: MobileModuleViewMode
  secondaryViewValue?: MobileModuleViewMode
  viewToggleAriaLabel?: string
  leading?: ReactNode
}

/** Fila superior móvil (buscar + acciones + resumen + toggle), mismo patrón que Productos. */
export function MobileModuleToolbar({
  onAdd,
  addTitle = 'Nuevo',
  addAriaLabel = 'Nuevo',
  summary,
  viewMode,
  onViewModeChange,
  primaryViewLabel,
  secondaryViewLabel,
  primaryViewValue = 'calendar',
  secondaryViewValue = 'list',
  viewToggleAriaLabel = 'Vista del módulo',
  leading,
}: Props) {
  const showToggle =
    viewMode != null &&
    onViewModeChange != null &&
    primaryViewLabel != null &&
    secondaryViewLabel != null

  return (
    <div className="vos-toolbar__actions mobile-list-toolbar__actions mobile-list-toolbar__actions--module">
      {leading}
      {onAdd ? (
        <FloatingGearFabDockAdd
          title={addTitle}
          ariaLabel={addAriaLabel}
          onClick={onAdd}
        />
      ) : null}
      <div className="mobile-list-toolbar__tail">
        {summary}
        {showToggle ? (
          <div
            className="view-toggle view-toggle--compact module-view-toggle"
            role="tablist"
            aria-label={viewToggleAriaLabel}
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === primaryViewValue}
              className={viewMode === primaryViewValue ? 'active' : ''}
              onClick={() => onViewModeChange(primaryViewValue)}
            >
              {primaryViewLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === secondaryViewValue}
              className={viewMode === secondaryViewValue ? 'active' : ''}
              onClick={() => onViewModeChange(secondaryViewValue)}
            >
              {secondaryViewLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
