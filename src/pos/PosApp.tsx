import { getApiBase } from '../api'
import { PLATFORM_MODE } from '../appScope'
import { HistoryView } from './components/history/HistoryView'
import { PosOrderView } from './components/order/PosOrderView'
import { PaymentView } from './components/payment/PaymentView'
import { PosPendingEntry } from './components/PosPendingEntry'
import { ShopOrdersView } from './components/shop/ShopOrdersView'
import { TablesDashboard } from './components/tables/TablesDashboard'
import { useAppTheme } from './hooks/useAppTheme'
import { usePosRealtime } from './hooks/usePosRealtime'
import { PosStoreProvider, usePosStore } from './store/posStore'
import { enablePosLocalFallback } from './services/posApi'
import './pos.css'

if (PLATFORM_MODE) {
  enablePosLocalFallback()
}

function PosRouter() {
  const baseUrl = getApiBase()
  const { state, navigate } = usePosStore()
  usePosRealtime(baseUrl)

  return (
    <>
      <PosPendingEntry />
      {(() => {
        switch (state.screen) {
          case 'order':
            return <PosOrderView baseUrl={baseUrl} />
          case 'payment':
            return <PaymentView baseUrl={baseUrl} />
          case 'history':
            return <HistoryView baseUrl={baseUrl} />
          case 'shop-orders':
            return (
              <ShopOrdersView
                baseUrl={baseUrl}
                onBack={() => navigate('tables')}
              />
            )
          case 'tables':
          default:
            return <TablesDashboard baseUrl={baseUrl} />
        }
      })()}
    </>
  )
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
