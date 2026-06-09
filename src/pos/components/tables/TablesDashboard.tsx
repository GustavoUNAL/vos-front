import { useEffect, useMemo, useState } from 'react'
import { prefetchPosActiveCatalog } from '../../../lib/posCatalogLoader'
import { MOBILE_FILTER_BREAKPOINT } from '../../../components/MobileAwareFilterBar'
import { MobileModuleToolbar } from '../../../components/MobileModuleToolbar'
import { Button } from '../../../components/ui/button'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { PLATFORM_MODE } from '../../../appScope'
import type { CreateTablePayload, PosTable, UpdateTablePayload } from '../../types'
import { usePosTables } from '../../hooks/usePosTables'
import { usePosStore } from '../../store/posStore'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'
import { PosEmpty } from '../ui/PosEmpty'
import { TableCard } from './TableCard'
import { ViewBootSplash } from '../../../components/DataLoadingSplash'
import { TableCloseConfirmModal } from './TableCloseConfirmModal'
import { TableEditModal } from './TableEditModal'
import { useShopOrdersFeed } from '../../hooks/useShopOrdersFeed'
import { PosShopOrderToast } from '../shop/PosShopOrderToast'
import { PosPaymentSuccess } from '../payment/PosPaymentSuccess'

type Props = { baseUrl: string }

export function TablesDashboard({ baseUrl }: Props) {
  const { state, navigate, setCheckoutSuccess } = usePosStore()
  const {
    tables,
    loading,
    error,
    demoMode,
    offline,
    wsStatus,
    refresh,
    openAccount,
    enterAccount,
    closeTableWithoutPay,
    closeTableWithPay,
    toggleReserve,
    saveTable,
    addTable,
  } = usePosTables(baseUrl)
  const {
    pendingCount: pendingShopOrders,
    toast: shopOrderToast,
    dismissToast,
  } = useShopOrdersFeed(baseUrl)

  const [editTable, setEditTable] = useState<PosTable | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)
  const [closeConfirmTable, setCloseConfirmTable] = useState<PosTable | null>(null)
  const isDockMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)

  const nextNumber = useMemo(() => {
    if (tables.length === 0) return 1
    return Math.max(...tables.map((t) => t.number)) + 1
  }, [tables])

  const occupied = tables.filter(
    (t) => t.status === 'occupied' || t.status === 'closing',
  ).length

  useEffect(() => {
    prefetchPosActiveCatalog(baseUrl)
  }, [baseUrl])

  const handleSave = async (payload: UpdateTablePayload | CreateTablePayload) => {
    setModalBusy(true)
    try {
      if (editTable) {
        await saveTable(editTable.id, payload as UpdateTablePayload)
      } else {
        await addTable(payload as CreateTablePayload)
      }
    } finally {
      setModalBusy(false)
    }
  }

  return (
    <div className="pos-screen pos-screen--tables">
      {isDockMobile ? (
        <div className="pos-mobile-module-bar vos-toolbar">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="btn-catalog-dock-tool btn-catalog-dock-tool--refresh shrink-0"
            title="Actualizar mesas"
            aria-label="Actualizar mesas"
            onClick={() => void refresh(true)}
          >
            <span className="btn-catalog-dock-tool--refresh__glyph" aria-hidden />
          </Button>
          <MobileModuleToolbar
            onAdd={() => setCreateOpen(true)}
            addTitle="Nueva mesa"
            addAriaLabel="Nueva mesa"
            summary={
              <span
                className={`pos-pill pos-pill--ws pos-pill--ws-${wsStatus} pos-pill--toolbar`}
                title={`WebSocket: ${wsStatus}`}
              >
                {tables.length} mesa{tables.length === 1 ? '' : 's'}
                {occupied > 0 ? ` · ${occupied} ocup.` : ''}
              </span>
            }
          />
        </div>
      ) : (
        <header className="pos-topbar">
          <div>
            <h1 className="pos-topbar__title">Mesas</h1>
            <p className="pos-topbar__sub muted">
              {tables.length} mesa{tables.length === 1 ? '' : 's'}
              {occupied > 0 && ` · ${occupied} ocupada${occupied === 1 ? '' : 's'}`}
              {demoMode &&
                (PLATFORM_MODE
                  ? ' · Mesas en este dispositivo'
                  : ' · Modo local (API apagado)')}
              {offline && ' · Sin conexión'}
            </p>
          </div>
          <div className="pos-topbar__actions">
            <span
              className={`pos-pill pos-pill--ws pos-pill--ws-${wsStatus}`}
              title={`WebSocket: ${wsStatus}`}
            >
              {wsStatus === 'open'
                ? 'En vivo'
                : demoMode
                  ? 'Local'
                  : 'Polling'}
            </span>
            <button
              type="button"
              className="pos-btn pos-btn--ghost"
              onClick={() => setCreateOpen(true)}
            >
              + Mesa
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--ghost"
              onClick={() => void refresh(true)}
            >
              Actualizar
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--ghost"
              onClick={() => navigate('history')}
            >
              Ventas
            </button>
            {PLATFORM_MODE ? (
              <button
                type="button"
                className="pos-btn pos-btn--primary pos-btn--with-badge"
                onClick={() => navigate('shop-orders')}
              >
                Pedidos web
                {pendingShopOrders > 0 ? (
                  <span className="pos-btn__badge" aria-label={`${pendingShopOrders} pedidos nuevos`}>
                    {pendingShopOrders}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        </header>
      )}

      <PosErrorBanner message={error ?? ''} />

      {loading && tables.length === 0 ? (
        <PosLoader label="Cargando mesas…" />
      ) : tables.length === 0 ? (
        <PosEmpty
          title="No hay mesas configuradas"
          hint="Creá la primera mesa con el botón + Mesa"
          action={
            <button
              type="button"
              className="pos-btn pos-btn--primary"
              onClick={() => setCreateOpen(true)}
            >
              Nueva mesa
            </button>
          }
        />
      ) : (
        <>
          <div className="pos-tables-grid pos-tables-grid--salon">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              busy={loading || modalBusy}
              onOpen={() => void openAccount(table)}
              onEnter={() => void enterAccount(table)}
              onClose={() => setCloseConfirmTable(table)}
              onEdit={() => setEditTable(table)}
              onRename={async (name) => {
                await saveTable(table.id, { name })
              }}
              onReserve={() => void toggleReserve(table)}
            />
          ))}
        </div>
          <p className="pos-tables-hint muted small">
            Tocá el nombre para renombrar · <strong>+ Mesa</strong> si necesitás otra
          </p>
        </>
      )}

      <TableCloseConfirmModal
        open={closeConfirmTable != null}
        table={closeConfirmTable}
        busy={loading || modalBusy}
        onClose={() => setCloseConfirmTable(null)}
        onCloseWithoutPay={() => {
          if (!closeConfirmTable) return
          const table = closeConfirmTable
          setCloseConfirmTable(null)
          void closeTableWithoutPay(table)
        }}
        onGoToPay={() => {
          if (!closeConfirmTable) return
          const table = closeConfirmTable
          setCloseConfirmTable(null)
          void closeTableWithPay(table)
        }}
      />

      <TableEditModal
        open={createOpen || editTable != null}
        mode={editTable ? 'edit' : 'create'}
        table={editTable}
        nextNumber={nextNumber}
        busy={modalBusy}
        onClose={() => {
          setCreateOpen(false)
          setEditTable(null)
        }}
        onSave={handleSave}
      />

      <ViewBootSplash
        ready={!loading || tables.length > 0}
        label="Cargando POS…"
      />

      {shopOrderToast ? (
        <PosShopOrderToast
          message={shopOrderToast.message}
          orderCode={shopOrderToast.code}
          onOpen={() => {
            dismissToast()
            navigate('shop-orders')
          }}
          onDismiss={dismissToast}
        />
      ) : null}

      {state.checkoutSuccess ? (
        <PosPaymentSuccess
          saleId={state.checkoutSuccess.saleId}
          dailyCount={state.checkoutSuccess.dailyCount}
          onDone={() => {
            setCheckoutSuccess(null)
            void refresh(true)
          }}
        />
      ) : null}
    </div>
  )
}
