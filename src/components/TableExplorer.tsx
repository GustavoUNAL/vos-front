import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTableRows,
  fetchTables,
  type ExplorerColumnDef,
  type TableInfo,
  type TableRowsResponse,
} from '../api'
import { ViewBootSplash } from './DataLoadingSplash'
import { SectionSummaryBar } from './SectionSummaryBar'

const PAGE_SIZE = 75

function paginationDots(current: number, total: number): number[] {
  if (total <= 1) return []
  const out: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let p = start; p <= end; p++) out.push(p)
  if (!out.includes(1)) out.unshift(1)
  if (!out.includes(total)) out.push(total)
  return out
}

function cellPreview(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function TableExplorer({ baseUrl }: { baseUrl: string }) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [tablesLoading, setTablesLoading] = useState(false)

  const [selected, setSelected] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<TableRowsResponse | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [rowsLoading, setRowsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setTablesLoading(true)
      setTablesError(null)
    })
    fetchTables(baseUrl)
      .then((list) => {
        if (!cancelled) setTables(list)
      })
      .catch((e: Error) => {
        if (!cancelled) setTablesError(e.message)
      })
      .finally(() => {
        if (!cancelled) setTablesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  useEffect(() => {
    let cancelled = false
    if (!selected) {
      Promise.resolve().then(() => {
        if (!cancelled) setData(null)
      })
      return () => {
        cancelled = true
      }
    }
    Promise.resolve().then(() => {
      if (cancelled) return
      setRowsLoading(true)
      setRowsError(null)
    })
    fetchTableRows(baseUrl, selected, PAGE_SIZE, page * PAGE_SIZE)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e: Error) => {
        if (!cancelled) setRowsError(e.message)
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, selected, page])

  const columns = useMemo(() => data?.columns ?? [], [data])

  const columnDefByKey = useMemo(() => {
    const defs = data?.columnDefs
    if (!defs?.length) return null
    const m = new Map<string, ExplorerColumnDef>()
    for (const d of defs) {
      m.set(d.key, d)
    }
    return m
  }, [data?.columnDefs])

  const selectedMeta = useMemo(
    () => (selected ? tables.find((t) => t.slug === selected) : undefined),
    [selected, tables],
  )

  const totalPages =
    data && data.total > 0 ? Math.ceil(data.total / PAGE_SIZE) : 0
  const pageDots = paginationDots(page + 1, totalPages)

  const pickTable = useCallback((slug: string) => {
    setSelected(slug)
    setPage(0)
  }, [])

  const explorerSummaryItems = useMemo(() => {
    if (!selected) {
      return [
        {
          label: 'Tablas',
          value: tables.length,
          title: 'Tablas expuestas por el explorador',
        },
      ]
    }
    return [
      {
        label: 'Filas',
        value: data?.total ?? '—',
        title: 'Total de filas en la tabla',
      },
      {
        label: 'En página',
        value: data?.rows.length ?? 0,
      },
      {
        label: 'Columnas',
        value: columns.length,
      },
      {
        label: 'Página',
        value:
          totalPages > 0 ? `${page + 1} / ${totalPages}` : String(page + 1),
      },
    ]
  }, [columns.length, data, page, selected, tables.length, totalPages])

  return (
    <div className="explorer-split">
      <aside className="explorer-sidebar">
        <h2 className="explorer-sidebar-title">Tablas SQL</h2>
        {tablesLoading && <p className="muted">Cargando…</p>}
        {tablesError && (
          <p className="error" role="alert">
            {tablesError}
          </p>
        )}
        <nav className="explorer-nav">
          <ul>
            {tables.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  className={t.slug === selected ? 'active' : ''}
                  onClick={() => pickTable(t.slug)}
                  title={t.description ?? t.sqlName}
                >
                  <span className="explorer-nav__label">
                    {t.title ?? t.slug}
                  </span>
                  {t.title && t.title !== t.slug && (
                    <span className="explorer-nav__slug muted">{t.slug}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="explorer-main">
        <div className="page-intro">
          <h2 className="page-title">DB</h2>
          <p className="muted page-subtitle">
            Vista de solo lectura de tablas expuestas por la API.
          </p>
        </div>

        {!selected && (
          <>
            <div className="empty-hint">
              <p>Elige una tabla en la columna izquierda (solo lectura).</p>
              <p className="muted">
                <code>GET /explorer/tables</code>,{' '}
                <code>GET /explorer/tables/:slug</code>
              </p>
            </div>
            <SectionSummaryBar section="explorer" items={explorerSummaryItems} />
          </>
        )}

        {selected && (
          <>
            <div className="toolbar explorer-toolbar">
              <div className="explorer-toolbar__titles">
                <h2 className="explorer-toolbar__name">
                  {selectedMeta?.title ?? selected}
                </h2>
                {selectedMeta?.description && (
                  <p className="explorer-toolbar__desc muted">
                    {selectedMeta.description}
                  </p>
                )}
                <p className="explorer-toolbar__slug mono muted">
                  <code>{selected}</code>
                </p>
              </div>
              {data && (
                <span className="muted">
                  {data.total} fila{data.total !== 1 ? 's' : ''} · página{' '}
                  {page + 1}
                  {totalPages > 0 ? ` / ${totalPages}` : ''}
                </span>
              )}
              {pageDots.length > 1 && (
                <div className="pager-dots" aria-hidden>
                  {pageDots.map((p) => (
                    <span
                      key={p}
                      className={`pager-dot${p === page + 1 ? ' is-active' : ''}`}
                    />
                  ))}
                </div>
              )}
              <div className="pager">
                <button
                  type="button"
                  disabled={page <= 0 || rowsLoading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={
                    rowsLoading || !data || (page + 1) * PAGE_SIZE >= data.total
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>

            <SectionSummaryBar section="explorer" items={explorerSummaryItems} />

            {rowsError && (
              <p className="error" role="alert">
                {rowsError}
              </p>
            )}
            {rowsLoading && <p className="muted">Cargando filas…</p>}

            {data && columns.length > 0 && (
              <div className="table-wrap explorer-table-wrap">
                <table className="explorer-data-table">
                  <thead>
                    <tr>
                      {columns.map((c) => {
                        const def = columnDefByKey?.get(c)
                        const header = def?.label ?? c
                        const tip = def?.description?.trim()
                        return (
                          <th key={c} title={tip || undefined} scope="col">
                            {header}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={row.id != null ? String(row.id) : i}>
                        {columns.map((c) => {
                          const def = columnDefByKey?.get(c)
                          const raw = row[c]
                          const preview = cellPreview(raw)
                          const cellTip =
                            def?.description != null && def.description !== ''
                              ? `${def.label}: ${def.description}\n\n${preview}`
                              : preview
                          return (
                            <td key={c} title={cellTip}>
                              {preview}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.rows.length === 0 && (
              <p className="muted">Esta tabla no tiene filas.</p>
            )}
          </>
        )}
      </div>

      <ViewBootSplash ready={!tablesLoading} label="Cargando explorador…" />
    </div>
  )
}
