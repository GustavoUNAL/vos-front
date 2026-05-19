import { getApiBase } from '../api'
import { HistoryView } from './components/history/HistoryView'
import { PosOrderView } from './components/order/PosOrderView'
import { PaymentView } from './components/payment/PaymentView'
import { TablesDashboard } from './components/tables/TablesDashboard'
import { useAppTheme } from './hooks/useAppTheme'
import { usePosRealtime } from './hooks/usePosRealtime'
import { PosStoreProvider, usePosStore } from './store/posStore'
import './pos.css'

function PosRouter() {
  const baseUrl = getApiBase()
  const { state } = usePosStore()
  usePosRealtime(baseUrl)

  switch (state.screen) {
    case 'order':
      return <PosOrderView baseUrl={baseUrl} />
    case 'payment':
      return <PaymentView baseUrl={baseUrl} />
    case 'history':
      return <HistoryView baseUrl={baseUrl} />
    case 'tables':
    default:
      return <TablesDashboard baseUrl={baseUrl} />
  }
}

function PosRoot() {
  const theme = useAppTheme()
  return (
    <div className={`pos-root pos-root--${theme}`} data-theme={theme}>
      <PosRouter />
    </div>
  )
}

export function PosApp() {
  return (
    <PosStoreProvider>
      <PosRoot />
    </PosStoreProvider>
  )
}
