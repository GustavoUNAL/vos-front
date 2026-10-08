import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchFinancialAnalytics,
  fetchMonthUtilities,
  upsertMonthUtilities,
  type AnalyticsGranularity,
  type FinancialAnalyticsOverview,
} from '../api'
import { formatCOP } from '../lib/money'
import { ViewBootSplash } from './DataLoadingSplash'
import { useFirstName } from '../hooks/useSessionUser'
import { namedCopy } from '../lib/userIdentity'
import { mobileViewClass } from './mobile/mobileView'

function bogotaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date())
}

function monthRange(ref = bogotaToday()): { from: string; to: string } {
  const [y, m] = ref.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

function shiftMonth(ref: string, delta: number): string {
  const [y, m] = ref.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function mondayOf(ref: string): string {
  const [y, m, d] = ref.split('-').map(Number)
  const noon = new Date(`${ref}T12:00:00-05:00`)
  const dow = noon.getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return new Date(Date.UTC(y, m - 1, d + mondayOffset)).toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function toMonthInput(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function parseMoneyInput(raw: string): number {
  const n = Number(String(raw).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

const GRANULARITY_LABEL: Record<AnalyticsGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
}

type RangePreset = 'today' | 'week' | 'lastWeek' | 'month' | 'prevMonth' | 'all' | 'custom'

function weekRangeAround(ref: string): { from: string; to: string } {
  const monday = mondayOf(ref)
  return { from: monday, to: addDays(monday, 6) }
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
  })
  const a = new Date(`${from}T12:00:00-05:00`)
  const b = new Date(`${to}T12:00:00-05:00`)
  if (from === to) return fmt.format(a)
  return `${fmt.format(a)} – ${fmt.format(b)}`
}

export function FinanceAnalyticsView({ baseUrl }: { baseUrl: string }) {
  const first = useFirstName()
  const today = bogotaToday()
  const initialWeek = weekRangeAround(today)
  const [dateFrom, setDateFrom] = useState(initialWeek.from)
  const [dateTo, setDateTo] = useState(initialWeek.to)
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('day')
  const [activePreset, setActivePreset] = useState<RangePreset>('week')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancialAnalyticsOverview | null>(null)
  const [dataBounds, setDataBounds] = useState<{
    dateFrom: string
    dateTo: string
  } | null>(null)

  const [utilMonth, setUtilMonth] = useState(() => toMonthInput(today))
  const [agua, setAgua] = useState('')
  const [energia, setEnergia] = useState('')
  const [internet, setInternet] = useState('')
  const [utilSaving, setUtilSaving] = useState(false)
  const [utilMsg, setUtilMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchFinancialAnalytics(baseUrl, {
        dateFrom,
        dateTo,
        granularity,
      })
      setData(res)
      if (res.dataBounds) setDataBounds(res.dataBounds)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar análisis')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, dateFrom, dateTo, granularity])

  useEffect(() => {
    void load()
  }, [load])

  const loadUtilities = useCallback(async () => {
    try {
      const snap = await fetchMonthUtilities(baseUrl, utilMonth)
      setAgua(snap.aguaCOP ? String(snap.aguaCOP) : '')
      setEnergia(snap.energiaCOP ? String(snap.energiaCOP) : '')
      setInternet(snap.internetCOP ? String(snap.internetCOP) : '')
    } catch {
      /* empty form if none */
    }
  }, [baseUrl, utilMonth])

  useEffect(() => {
    void loadUtilities()
  }, [loadUtilities])

  const chartMax = useMemo(() => {
    if (!data?.combined.length) return 1
    return Math.max(
      1,
      ...data.combined.map((r) =>
        Math.max(
          r.salesCOP,
          r.purchasesCOP,
          r.staffPayCOP,
          r.utilitiesCOP ?? 0,
          Math.abs(r.netCOP),
        ),
      ),
    )
  }, [data])

  const summary = data?.summary
  const utilitiesTotal = summary?.utilitiesCOP ?? 0
  const outflows =
    summary?.outflowsCOP ??
    (summary?.purchasesCOP ?? 0) + (summary?.staffPayCOP ?? 0) + utilitiesTotal
  const inflows = summary?.inflowsCOP ?? summary?.salesCOP ?? 0

  const setPreset = (kind: RangePreset) => {
    setActivePreset(kind)
    if (kind === 'today') {
      setDateFrom(today)
      setDateTo(today)
      setGranularity('day')
      return
    }
    if (kind === 'week') {
      const range = weekRangeAround(today)
      setDateFrom(range.from)
      setDateTo(range.to)
      setGranularity('day')
      return
    }
    if (kind === 'lastWeek') {
      const monday = addDays(mondayOf(today), -7)
      setDateFrom(monday)
      setDateTo(addDays(monday, 6))
      setGranularity('day')
      return
    }
    if (kind === 'prevMonth') {
      const range = monthRange(shiftMonth(today, -1))
      setDateFrom(range.from)
      setDateTo(range.to)
      setGranularity('week')
      return
    }
    if (kind === 'all') {
      if (dataBounds) {
        setDateFrom(dataBounds.dateFrom)
        setDateTo(dataBounds.dateTo)
      } else if (data?.dataBounds) {
        setDateFrom(data.dataBounds.dateFrom)
        setDateTo(data.dataBounds.dateTo)
      } else {
        setDateFrom('2025-01-01')
        setDateTo(today)
      }
      setGranularity('month')
      return
    }
    if (kind === 'month') {
      const range = monthRange(today)
      setDateFrom(range.from)
      setDateTo(range.to)
      setGranularity('week')
    }
  }

  const saveUtilities = async () => {
    setUtilSaving(true)
    setUtilMsg(null)
    try {
      await upsertMonthUtilities(baseUrl, {
        expenseMonth: utilMonth,
        aguaCOP: parseMoneyInput(agua),
        energiaCOP: parseMoneyInput(energia),
        internetCOP: parseMoneyInput(internet),
      })
      setUtilMsg('Servicios guardados')
      await load()
    } catch (e) {
      setUtilMsg(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setUtilSaving(false)
    }
  }

  return (
    <div className={mobileViewClass('finance', 'finance-analytics page-pane')}>
      <header className="finance-analytics__head">
        <div>
          <h1 className="finance-analytics__title">Análisis financiero</h1>
          <p className="muted finance-analytics__lead">
            {namedCopy(
              first,
              '{name}, aquí puede ver entradas, salidas y la utilidad estimada por día, semana o mes.',
              'Entradas, salidas y utilidad estimada por día, semana o mes.',
            )}
          </p>
        </div>
        <div className="view-toggle finance-analytics__granularity" role="group" aria-label="Agrupación">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={granularity === g ? 'active' : ''}
              onClick={() => {
                setGranularity(g)
                setActivePreset('custom')
              }}
            >
              {GRANULARITY_LABEL[g]}
            </button>
          ))}
        </div>
      </header>

      <div className="finance-analytics__presets" role="group" aria-label="Rangos rápidos">
        {(
          [
            ['week', 'Esta semana'],
            ['lastWeek', 'Semana pasada'],
            ['today', 'Hoy'],
            ['month', 'Este mes'],
            ['prevMonth', 'Mes pasado'],
            ['all', 'Todo el historial'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn-secondary btn-compact${activePreset === id ? ' is-active' : ''}`}
            onClick={() => setPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="finance-analytics__filters">
        <label className="field-stack">
          <span>Desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setActivePreset('custom')
            }}
          />
        </label>
        <label className="field-stack">
          <span>Hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setActivePreset('custom')
            }}
          />
        </label>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          Actualizar
        </button>
      </div>

      <section className="finance-analytics__range-banner" aria-label="Resumen del rango">
        <div>
          <p className="finance-analytics__range-kicker">
            {activePreset === 'week'
              ? 'Esta semana'
              : activePreset === 'lastWeek'
                ? 'Semana pasada'
                : activePreset === 'today'
                  ? 'Hoy'
                  : 'Rango seleccionado'}
          </p>
          <strong>{formatRangeLabel(dateFrom, dateTo)}</strong>
        </div>
        <dl className="finance-analytics__range-stats">
          <div>
            <dt>Ventas</dt>
            <dd>{loading ? '…' : formatCOP(summary?.salesCOP ?? 0)}</dd>
            <small>
              {loading ? '' : `${data?.sales.totals.count ?? 0} ops`}
            </small>
          </div>
          <div>
            <dt>Compras</dt>
            <dd>{loading ? '…' : formatCOP(summary?.purchasesCOP ?? 0)}</dd>
            <small>
              {loading ? '' : `${data?.purchases.totals.count ?? 0} lotes`}
            </small>
          </div>
          <div>
            <dt>Utilidad</dt>
            <dd className={(summary?.netCOP ?? 0) < 0 ? 'is-neg' : undefined}>
              {loading ? '…' : formatCOP(summary?.netCOP ?? 0)}
            </dd>
            <small>Ventas − salidas</small>
          </div>
        </dl>
      </section>

      {error ? (
        <p className="banner-warn" role="alert">
          {error}
        </p>
      ) : null}

      <section className="finance-analytics__flow" aria-label="Entradas y salidas">
        <article className="finance-analytics__flow-card finance-analytics__flow-card--in">
          <span className="finance-analytics__kpi-label">Entradas (ventas)</span>
          <strong>{loading ? '…' : formatCOP(inflows)}</strong>
          <ul className="finance-analytics__flow-list">
            <li>
              Nequi <em>{formatCOP(summary?.nequiCOP ?? 0)}</em>
            </li>
            <li>
              Caja <em>{formatCOP(summary?.cashCOP ?? 0)}</em>
            </li>
            <li>
              Otros <em>{formatCOP(summary?.otherPayCOP ?? 0)}</em>
            </li>
          </ul>
        </article>
        <article className="finance-analytics__flow-card finance-analytics__flow-card--out">
          <span className="finance-analytics__kpi-label">Salidas</span>
          <strong>{loading ? '…' : formatCOP(outflows)}</strong>
          <ul className="finance-analytics__flow-list">
            <li>
              Compras <em>{formatCOP(summary?.purchasesCOP ?? 0)}</em>
            </li>
            <li>
              Nómina <em>{formatCOP(summary?.staffPayCOP ?? 0)}</em>
            </li>
            <li>
              Servicios <em>{formatCOP(utilitiesTotal)}</em>
            </li>
          </ul>
        </article>
        <article
          className={`finance-analytics__flow-card finance-analytics__flow-card--net${(summary?.netCOP ?? 0) < 0 ? ' finance-analytics__flow-card--negative' : ''}`}
        >
          <span className="finance-analytics__kpi-label">Utilidad estimada</span>
          <strong>{loading ? '…' : formatCOP(summary?.netCOP ?? 0)}</strong>
          <p className="muted small">Entradas − compras − nómina − servicios</p>
        </article>
      </section>

      <section className="finance-analytics__kpi-grid" aria-label="Detalle del resumen">
        <article className="finance-analytics__kpi finance-analytics__kpi--sales">
          <span className="finance-analytics__kpi-label">Ventas</span>
          <strong>{loading ? '…' : formatCOP(summary?.salesCOP ?? 0)}</strong>
          <span className="muted small">
            {loading ? '' : `${data?.sales.totals.count ?? 0} ops`}
          </span>
        </article>
        <article className="finance-analytics__kpi finance-analytics__kpi--purchases">
          <span className="finance-analytics__kpi-label">Compras</span>
          <strong>{loading ? '…' : formatCOP(summary?.purchasesCOP ?? 0)}</strong>
        </article>
        <article className="finance-analytics__kpi finance-analytics__kpi--staff">
          <span className="finance-analytics__kpi-label">Nómina</span>
          <strong>{loading ? '…' : formatCOP(summary?.staffPayCOP ?? 0)}</strong>
          <span className="muted small">
            {loading ? '' : `${data?.staff.totals.shiftCount ?? 0} turnos`}
          </span>
        </article>
        <article className="finance-analytics__kpi finance-analytics__kpi--utilities">
          <span className="finance-analytics__kpi-label">Servicios</span>
          <strong>{loading ? '…' : formatCOP(utilitiesTotal)}</strong>
          <span className="muted small">
            Agua {formatCOP(summary?.aguaCOP ?? 0)} · Energía{' '}
            {formatCOP(summary?.energiaCOP ?? 0)} · Internet{' '}
            {formatCOP(summary?.internetCOP ?? 0)}
          </span>
        </article>
      </section>

      <section className="finance-analytics__panel" aria-label="Costo, nómina y hora">
        <div className="finance-analytics__panel-head">
          <h2>Costo de lo vendido</h2>
        </div>
        <ul className="finance-analytics__flow-list">
          <li>
            Costo de recetas y productos{' '}
            <em>{formatCOP(summary?.cogsCOP ?? 0)}</em>
          </li>
          <li>
            Costo sobre ventas{' '}
            <em>
              {summary?.foodCostPct == null ? '—' : `${summary.foodCostPct}%`}
            </em>
          </li>
          <li>
            Nómina sobre ventas{' '}
            <em>{summary?.laborPct == null ? '—' : `${summary.laborPct}%`}</em>
          </li>
          <li>
            Después de costo, nómina y servicios{' '}
            <em>{formatCOP(summary?.contributionCOP ?? 0)}</em>
          </li>
        </ul>
        {(data?.hourly ?? []).some((row) => row.count > 0) ? (
          <div className="ops-hour-list" aria-label="Ventas por hora">
            {(data?.hourly ?? [])
              .filter((row) => row.count > 0 || (row.hour >= 8 && row.hour <= 23))
              .filter((row) => row.hour >= 8 && row.hour <= 23)
              .map((row) => {
                const max = Math.max(
                  1,
                  ...(data?.hourly ?? []).map((item) => item.salesCOP),
                )
                return (
                  <div key={row.hour} className="ops-hour-list__row">
                    <span className="mono">{String(row.hour).padStart(2, '0')}</span>
                    <span className="ops-hour-list__bar">
                      <span style={{ width: `${(row.salesCOP / max) * 100}%` }} />
                    </span>
                    <span className="mono">{row.count > 0 ? formatCOP(row.salesCOP) : ''}</span>
                  </div>
                )
              })}
          </div>
        ) : null}
        {(data?.byPerson?.length ?? 0) > 0 ? (
          <div className="data-table-wrap">
          <table className="data-table finance-analytics__table">
            <thead>
              <tr>
                <th>Quién atendió</th>
                <th>Tickets</th>
                <th>Ventas</th>
                <th>Descuentos</th>
              </tr>
            </thead>
            <tbody>
              {data?.byPerson?.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="num mono">{row.count}</td>
                  <td className="num mono">{formatCOP(row.salesCOP)}</td>
                  <td className="num mono">{formatCOP(row.discountCOP)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : null}
      </section>

      <section className="finance-analytics__panel finance-analytics__utilities" aria-label="Registrar servicios">
        <div className="finance-analytics__panel-head">
          <h2>Servicios del mes</h2>
          <p className="muted small">Agua, energía e internet entran al cálculo de utilidad.</p>
        </div>
        <div className="finance-analytics__util-form">
          <label className="field-stack">
            <span>Mes</span>
            <input
              type="month"
              value={utilMonth}
              onChange={(e) => setUtilMonth(e.target.value)}
            />
          </label>
          <label className="field-stack">
            <span>Agua</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={agua}
              onChange={(e) => setAgua(e.target.value)}
            />
          </label>
          <label className="field-stack">
            <span>Energía</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={energia}
              onChange={(e) => setEnergia(e.target.value)}
            />
          </label>
          <label className="field-stack">
            <span>Internet</span>
            <input
              inputMode="numeric"
              placeholder="0"
              value={internet}
              onChange={(e) => setInternet(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={utilSaving}
            onClick={() => void saveUtilities()}
          >
            {utilSaving ? 'Guardando…' : 'Guardar servicios'}
          </button>
        </div>
        {utilMsg ? (
          <p className="muted small finance-analytics__util-msg" role="status">
            {utilMsg}
          </p>
        ) : null}
      </section>

      {!loading && data && data.combined.length > 0 ? (
        <section className="finance-analytics__panel" aria-label="Gráfico por periodo">
          <div className="finance-analytics__panel-head">
            <h2>Por {GRANULARITY_LABEL[granularity].toLowerCase()}</h2>
            <div className="finance-analytics__legend">
              <span className="finance-analytics__legend-item finance-analytics__legend-item--sales">
                Ventas
              </span>
              <span className="finance-analytics__legend-item finance-analytics__legend-item--purchases">
                Compras
              </span>
              <span className="finance-analytics__legend-item finance-analytics__legend-item--staff">
                Nómina
              </span>
              <span className="finance-analytics__legend-item finance-analytics__legend-item--utilities">
                Servicios
              </span>
            </div>
          </div>
          <div className="finance-analytics__chart">
            {data.combined.map((row) => (
              <div key={row.period} className="finance-analytics__chart-row">
                <span className="finance-analytics__chart-label">{row.label}</span>
                <div className="finance-analytics__chart-bars">
                  <span
                    className="finance-analytics__bar finance-analytics__bar--sales"
                    style={{ width: `${(row.salesCOP / chartMax) * 100}%` }}
                    title={`Ventas: ${formatCOP(row.salesCOP)}`}
                  />
                  <span
                    className="finance-analytics__bar finance-analytics__bar--purchases"
                    style={{ width: `${(row.purchasesCOP / chartMax) * 100}%` }}
                    title={`Compras: ${formatCOP(row.purchasesCOP)}`}
                  />
                  <span
                    className="finance-analytics__bar finance-analytics__bar--staff"
                    style={{ width: `${(row.staffPayCOP / chartMax) * 100}%` }}
                    title={`Nómina: ${formatCOP(row.staffPayCOP)}`}
                  />
                  <span
                    className="finance-analytics__bar finance-analytics__bar--utilities"
                    style={{ width: `${((row.utilitiesCOP ?? 0) / chartMax) * 100}%` }}
                    title={`Servicios: ${formatCOP(row.utilitiesCOP ?? 0)}`}
                  />
                </div>
                <span
                  className={`finance-analytics__chart-net mono${row.netCOP < 0 ? ' finance-analytics__chart-net--negative' : ''}`}
                >
                  {formatCOP(row.netCOP)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="finance-analytics__panel">
        <div className="finance-analytics__panel-head">
          <h2>Detalle por periodo</h2>
        </div>
        <div className="data-table-wrap finance-analytics__table-wrap">
          <table className="data-table finance-analytics__table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th className="num">Entradas</th>
                <th className="num">Compras</th>
                <th className="num">Nómina</th>
                <th className="num">Servicios</th>
                <th className="num">Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Cargando…
                  </td>
                </tr>
              ) : !data?.combined.length ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin movimientos en el rango seleccionado.
                  </td>
                </tr>
              ) : (
                data.combined.map((row) => (
                  <tr key={row.period}>
                    <td>{row.label}</td>
                    <td className="num mono">
                      {formatCOP(row.salesCOP)}
                      <span className="muted small">
                        {' '}
                        · N {formatCOP(row.nequiCOP)} · C {formatCOP(row.cashCOP)}
                      </span>
                    </td>
                    <td className="num mono">{formatCOP(row.purchasesCOP)}</td>
                    <td className="num mono">{formatCOP(row.staffPayCOP)}</td>
                    <td className="num mono">{formatCOP(row.utilitiesCOP ?? 0)}</td>
                    <td
                      className={`num mono${row.netCOP < 0 ? ' finance-analytics__net--negative' : ''}`}
                    >
                      {formatCOP(row.netCOP)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ul className="finance-analytics__mobile-cards" aria-label="Detalle móvil">
          {!loading &&
            data?.combined.map((row) => (
              <li key={`m-${row.period}`} className="finance-analytics__mobile-card">
                <strong>{row.label}</strong>
                <div className="finance-analytics__mobile-grid">
                  <span>
                    Entradas <em className="mono">{formatCOP(row.salesCOP)}</em>
                  </span>
                  <span>
                    Compras <em className="mono">{formatCOP(row.purchasesCOP)}</em>
                  </span>
                  <span>
                    Nómina <em className="mono">{formatCOP(row.staffPayCOP)}</em>
                  </span>
                  <span>
                    Servicios <em className="mono">{formatCOP(row.utilitiesCOP ?? 0)}</em>
                  </span>
                  <span>
                    Nequi <em className="mono">{formatCOP(row.nequiCOP)}</em>
                  </span>
                  <span>
                    Caja <em className="mono">{formatCOP(row.cashCOP)}</em>
                  </span>
                  <span
                    className={`finance-analytics__mobile-net${row.netCOP < 0 ? ' finance-analytics__net--negative' : ''}`}
                  >
                    Utilidad <em className="mono">{formatCOP(row.netCOP)}</em>
                  </span>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <ViewBootSplash ready={!loading} label="Cargando análisis financiero…" />
    </div>
  )
}
