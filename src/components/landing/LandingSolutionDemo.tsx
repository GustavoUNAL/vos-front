import { BRAND_NAME } from '../../lib/brand'
import { LandingChatMock, type LandingChatTurn } from './LandingChatMock'

const USER = 'María'

/** Una sola conversación: las 5 preguntas en secuencia */
export const SOLUTION_CONVERSATION: LandingChatTurn[] = [
  {
    who: USER,
    role: 'user',
    text: '¿Cuánto vendí hoy?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Ventas · hoy',
    text: 'Sumé POS, tienda web y pedidos del día con desglose por canal.',
    metrics: [
      { label: 'Total', value: '$1.250.000', hint: '+14% vs ayer', trend: 'up' },
      { label: 'POS', value: '$775.000' },
      { label: 'Web', value: '$475.000' },
      { label: 'Tickets', value: '44' },
    ],
  },
  {
    who: USER,
    role: 'user',
    text: '¿Qué debo comprar?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Compras · recomendación',
    text: 'Cruce stock actual con ventas de los últimos 7 días y alertas de mínimo.',
    metrics: [
      { label: 'Críticos', value: '3 ítems', hint: 'pedir hoy', trend: 'down' },
      { label: 'Esta semana', value: '8 ítems' },
      { label: 'Inversión est.', value: '$890.000' },
    ],
    bullets: [
      '<strong>Leche entera</strong> — 2 días de cobertura · pedir 24 L',
      '<strong>Café molido</strong> — mínimo alcanzado · pedir 5 kg',
      '<strong>Vasos 12 oz</strong> — ritmo alto · pedir 2 cajas',
    ],
  },
  {
    who: USER,
    role: 'user',
    text: '¿Cuál fue mi utilidad?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Finanzas · mes actual',
    text: 'Utilidad neta con costos de inventario, nómina y gastos operativos cargados.',
    metrics: [
      { label: 'Utilidad', value: '$4.820.000', hint: '+9% vs mes ant.', trend: 'up' },
      { label: 'Margen', value: '34,2%' },
      { label: 'Ingresos', value: '$14.100.000' },
      { label: 'Costos', value: '$9.280.000' },
    ],
  },
  {
    who: USER,
    role: 'user',
    text: '¿Qué productos generan más ganancias?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Productos · top margen',
    text: 'Ordené por utilidad absoluta y margen % en los últimos 30 días.',
    metrics: [
      { label: '#1', value: 'Cappuccino', hint: '$1,2M util.', trend: 'up' },
      { label: '#2', value: 'Cheesecake', hint: '58% margen' },
      { label: '#3', value: 'Cold brew', hint: '42% margen' },
    ],
    bullets: [
      '<strong>Cappuccino</strong> — 312 uds · $1.248.000 de utilidad',
      '<strong>Cheesecake</strong> — 89 uds · margen 58%',
    ],
  },
  {
    who: USER,
    role: 'user',
    text: '¿Qué clientes no han regresado?',
  },
  {
    who: BRAND_NAME,
    role: 'ai',
    badge: 'Clientes · inactivos',
    text: 'Compraron antes pero no vuelven hace más de 30 días.',
    metrics: [
      { label: 'Sin volver', value: '24 clientes' },
      { label: 'Ticket prom.', value: '$31.200' },
      { label: 'Valor en riesgo', value: '$748.000', hint: 'histórico/mes' },
    ],
    bullets: [
      '<strong>Valentina R.</strong> — última visita hace 45 días · 8 compras',
      '<strong>Miguel T.</strong> — hace 38 días · pedía los viernes',
    ],
    insight:
      'Un mensaje personalizado a los 5 de mayor ticket puede recuperar ~$180.000 este mes.',
  },
]

export function LandingSolutionDemo() {
  return (
    <div className="landing-solution-demo">
      <LandingChatMock
        turns={SOLUTION_CONVERSATION}
        framed
        readOnly
        conversationLoop
        className="landing-section__demo"
        caption="Asistente con datos reales de tu negocio"
      />
    </div>
  )
}
