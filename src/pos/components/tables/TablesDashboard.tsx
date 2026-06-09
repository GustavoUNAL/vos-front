import { useMemo, useState } from 'react'
import { PLATFORM_MODE } from '../../../appScope'
import type { CreateTablePayload, PosTable, UpdateTablePayload } from '../../types'
import { usePosTables } from '../../hooks/usePosTables'
import { usePosStore } from '../../store/posStore'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'
import { PosEmpty } from '../ui/PosEmpty'
import { TableCard } from './TableCard'
import { TableEditModal } from './TableEditModal'

type Props = { baseUrl: string }

export function TablesDashboard({ baseUrl }: Props) {
  const { navigate } = usePosStore()
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
    closeTable,
    toggleReserve,
    saveTable,
    addTable,
  } = usePosTables(baseUrl)

  const [editTable, setEditTable] = useState<PosTable | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [modalBusy, setModalBusy] = useState(false)

  const nextNumber = useMemo(() => {
    if (tables.length === 0) return 1
    return Math.max(...tables.map((t) => t.number)) + 1
  }, [tables])

  const occupied = tables.filter(
    (t) => t.status === 'occupied' || t.status === 'closing',
  ).length
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
          <button type="button" className="pos-btn pos-btn--ghost" onClick={() => refresh()}>
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
              className="pos-btn pos-btn--primary"
              onClick={() => navigate('shop-orders')}
            >
              Pedidos web
            </button>
          ) : null}
        </div>
      </header>

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
              onClose={() => void closeTable(table)}
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
    </div>
  )
}
