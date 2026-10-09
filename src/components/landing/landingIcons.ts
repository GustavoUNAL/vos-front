import analitica from '../../assets/landing/icon-analitica.jpg'
import automatizacion from '../../assets/landing/icon-automatizacion.jpg'
import catalogo from '../../assets/landing/icon-catalogo.jpg'
import cierre from '../../assets/landing/icon-cierre.jpg'
import citas from '../../assets/landing/icon-citas.jpg'
import clientes from '../../assets/landing/icon-clientes.jpg'
import enlace from '../../assets/landing/icon-enlace.jpg'
import equipo from '../../assets/landing/icon-equipo.jpg'
import inventario from '../../assets/landing/icon-inventario.jpg'
import panel from '../../assets/landing/icon-panel.jpg'
import pos from '../../assets/landing/icon-pos.jpg'
import proyectos from '../../assets/landing/icon-proyectos.jpg'
import compras from '../../assets/landing/icon-compras.jpg'
import recetas from '../../assets/landing/icon-recetas.jpg'
import tienda from '../../assets/landing/icon-tienda.jpg'
import ventas from '../../assets/landing/icon-ventas.jpg'

const LANDING_ICONS: Record<string, string> = {
  sales: ventas,
  inventory: inventario,
  recipes: recetas,
  booking: citas,
  customers: clientes,
  analytics: analitica,
  tasks: automatizacion,
  'cash-close': cierre,
  staff: equipo,
  settings: enlace,
  products: catalogo,
  shop: tienda,
  projects: proyectos,
  pos,
  purchases: compras,
  platform: panel,
}

export function landingIcon(view: string) {
  return LANDING_ICONS[view] ?? ''
}
