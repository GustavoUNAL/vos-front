export const BUSINESS_TYPES = [
  {
    id: 'cafe',
    name: 'Cafetería',
    blurb: 'Caja, recetas, inventario y cierre del día.',
    modules: ['Ventas', 'Inventario', 'Productos', 'Compras', 'Tareas', 'Finanzas'],
  },
  {
    id: 'restaurant',
    name: 'Restaurante',
    blurb: 'Comandas, insumos, personal y control de caja.',
    modules: ['Ventas', 'Inventario', 'Productos', 'Personal', 'Compras', 'Finanzas'],
  },
  {
    id: 'barbershop',
    name: 'Barbería / salón',
    blurb: 'Agenda pública, clientes y cobro en caja.',
    modules: ['Citas', 'Ventas', 'Clientes de la agenda', 'Finanzas'],
  },
  {
    id: 'retail',
    name: 'Comercio / tienda',
    blurb: 'Catálogo, stock, mostrador y tienda web.',
    modules: ['Productos', 'Inventario', 'Ventas', 'Compras', 'Finanzas'],
  },
  {
    id: 'services',
    name: 'Servicios / proyectos',
    blurb: 'Citas, clientes, obras y seguimiento.',
    modules: ['Citas', 'Proyectos', 'Tareas', 'Clientes de la agenda', 'Finanzas'],
  },
  {
    id: 'clinic',
    name: 'Clínica / salud',
    blurb: 'Pacientes, agenda clínica e inventario básico.',
    modules: ['Clínica', 'Inventario', 'Finanzas'],
  },
  {
    id: 'other',
    name: 'Otro negocio',
    blurb: 'Un paquete general para empezar y ajustar después.',
    modules: ['Productos', 'Ventas', 'Inventario', 'Tareas', 'Finanzas'],
  },
] as const

export type BusinessTypeOptionId = (typeof BUSINESS_TYPES)[number]['id']
