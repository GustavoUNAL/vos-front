import { Plus } from 'lucide-react'
import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from './ui/button'

const GearFabCloseMenuContext = createContext<() => void>(() => {})

/** Dentro de `<FloatingGearFab>…</FloatingGearFab>`, cierra el menú antes de otra acción (como en Productos). */
export function useGearFabCloseMenu(): () => void {
  return useContext(GearFabCloseMenuContext)
}

/** Botón “+” del dock (mismo aspecto que Productos). Debe ir dentro de `<FloatingGearFab>`. */
export function FloatingGearFabDockAdd({
  title,
  ariaLabel,
  onClick,
}: {
  title: string
  ariaLabel: string
  onClick: () => void
}) {
  const closeMenu = useGearFabCloseMenu()
  return (
    <Button
      type="button"
      variant="primary"
      size="icon-sm"
      className="btn-catalog-dock-add shrink-0"
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        closeMenu()
        onClick()
      }}
    >
      <Plus className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.25} aria-hidden />
    </Button>
  )
}

/** Botón actualizar del dock (icono). Debe ir dentro de `<FloatingGearFab>`. */
export function FloatingGearFabDockRefresh({
  title,
  ariaLabel,
  onClick,
  disabled,
}: {
  title: string
  ariaLabel: string
  onClick: () => void | Promise<void>
  disabled?: boolean
}) {
  const closeMenu = useGearFabCloseMenu()
  return (
    <button
      type="button"
      className="btn-catalog-dock-tool btn-catalog-dock-tool--refresh"
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        closeMenu()
        void onClick()
      }}
    >
      <span className="btn-catalog-dock-tool--refresh__glyph" aria-hidden />
    </button>
  )
}

function GearPinionIcon() {
  return (
    <svg
      className="floating-gear-fab__pinion-svg"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
      />
    </svg>
  )
}

export type FloatingGearFabProps = {
  /** `aria-label` del `<nav>` (zona flotante). */
  navAriaLabel: string
  /** `title` del botón piñón cuando el menú está cerrado. */
  menuToggleTitleClosed: string
  /** `title` cuando el menú está abierto (opcional). */
  menuToggleTitleOpen?: string
  /** `aria-label` del botón piñón con menú cerrado. */
  ariaLabelMenuClosed: string
  /** `aria-label` del botón piñón con menú abierto. */
  ariaLabelMenuOpen: string
  /** Botón “Buscar / filtros” que inyecta `MobileAwareFilterBar`. */
  filterToggle: ReactNode
  /** Más controles (cada hijo directo = un slot; p. ej. “+”, resumen). */
  children?: ReactNode
}

/**
 * Piñón flotante + menú vertical (buscar/filtros + acciones). Misma UX en móvil
 * que Productos; usar con `MobileAwareFilterBar` y `composeMobileToolbar`.
 */
export function FloatingGearFab({
  navAriaLabel,
  menuToggleTitleClosed,
  menuToggleTitleOpen,
  ariaLabelMenuClosed,
  ariaLabelMenuOpen,
  filterToggle,
  children,
}: FloatingGearFabProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      const root = rootRef.current
      if (root && !root.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const extraSlots = Children.toArray(children).filter(Boolean)
  const closeCtx = useMemo(() => closeMenu, [closeMenu])

  return (
    <nav
      ref={rootRef}
      className="floating-gear-fab"
      aria-label={navAriaLabel}
    >
      <div
        id={menuId}
        className={`floating-gear-fab__menu${menuOpen ? ' is-open' : ''}`}
        role="group"
        aria-hidden={!menuOpen}
      >
        <GearFabCloseMenuContext.Provider value={closeCtx}>
          <div className="floating-gear-fab__menu-actions">
            <div className="floating-gear-fab__action-slot" onClick={closeMenu}>
              {filterToggle}
            </div>
            {extraSlots.map((node, i) => (
              <div key={i} className="floating-gear-fab__action-slot" onClick={closeMenu}>
                {node}
              </div>
            ))}
          </div>
        </GearFabCloseMenuContext.Provider>
      </div>
      <button
        type="button"
        className="floating-gear-fab__toggle"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? ariaLabelMenuOpen : ariaLabelMenuClosed}
        title={menuOpen ? (menuToggleTitleOpen ?? menuToggleTitleClosed) : menuToggleTitleClosed}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <GearPinionIcon />
      </button>
    </nav>
  )
}
