import { useEffect, useState } from 'react'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
const CHART = { w: 360, h: 132, padX: 6, padY: 14 }
const HOLD_MS = 4800

type MixItem = { label: string; pct: number; color: string }
type Kpi = { label: string; value: string }
type StockItem = { name: string; qty: string; pct: number; low?: boolean }

type DashView = {
  id: string
  kicker: string
  total: string
  delta: string
  deltaTone: 'up' | 'warn'
  color: string
  series: number[]
  kind: 'line' | 'bars' | 'stock'
  kpis: Kpi[]
  mix: MixItem[]
  stock?: StockItem[]
  chartLabel: string
}

const VIEWS: DashView[] = [
  {
    id: 'sales',
    kicker: 'Ventas · esta semana',
    total: '$2.140.000',
    delta: '+18%',
    deltaTone: 'up',
    color: '#58a6ff',
    series: [42, 58, 51, 74, 68, 90, 100],
    kind: 'line',
    kpis: [
      { label: 'Hoy', value: '$482.400' },
      { label: 'Ventas', value: '18' },
      { label: 'Ticket', value: '$26.800' },
    ],
    mix: [
      { label: 'Caja', pct: 62, color: '#22c55e' },
      { label: 'Web', pct: 28, color: '#58a6ff' },
      { label: 'Nequi', pct: 10, color: '#a371f7' },
    ],
    chartLabel: 'Ventas diarias de lunes a domingo',
  },
  {
    id: 'booking',
    kicker: 'Citas · esta semana',
    total: '42 reservas',
    delta: '2 huecos',
    deltaTone: 'warn',
    color: '#2dd4bf',
    series: [5, 6, 4, 8, 7, 9, 6],
    kind: 'bars',
    kpis: [
      { label: 'Hoy', value: '6' },
      { label: 'Web', value: '14' },
      { label: 'Próxima', value: '16:00' },
    ],
    mix: [
      { label: 'Agenda', pct: 67, color: '#2dd4bf' },
      { label: 'Web', pct: 33, color: '#58a6ff' },
    ],
    chartLabel: 'Citas por día de lunes a domingo',
  },
  {
    id: 'stock',
    kicker: 'Inventario · ahora',
    total: '24 ítems',
    delta: '3 bajos',
    deltaTone: 'warn',
    color: '#0ea5e9',
    series: [],
    kind: 'stock',
    kpis: [
      { label: 'OK', value: '18' },
      { label: 'Bajos', value: '3' },
      { label: 'Agotados', value: '0' },
    ],
    mix: [
      { label: 'Insumos', pct: 58, color: '#0ea5e9' },
      { label: 'Producto', pct: 42, color: '#6366f1' },
    ],
    stock: [
      { name: 'Café blend', qty: '8 kg', pct: 72 },
      { name: 'Leche', qty: '12 L', pct: 54 },
      { name: 'Vasos 12 oz', qty: '40 u', pct: 22, low: true },
      { name: 'Azúcar', qty: '6 kg', pct: 61 },
    ],
    chartLabel: 'Existencias actuales',
  },
]

function coords(values: number[]) {
  const { w, h, padX, padY } = CHART
  const max = Math.max(...values, 1)
  const step = (w - padX * 2) / Math.max(values.length - 1, 1)
  return values.map((v, i) => ({
    x: padX + i * step,
    y: h - padY - (v / max) * (h - padY * 2),
  }))
}

function smoothPath(pts: { x: number; y: number }[]) {
  const first = pts[0]
  if (!first) return ''
  let d = `M${first.x.toFixed(1)} ${first.y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    if (!p0 || !p1) continue
    const mx = (p0.x + p1.x) / 2
    d += ` C${mx.toFixed(1)} ${p0.y.toFixed(1)}, ${mx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`
  }
  return d
}

function areaPath(pts: { x: number; y: number }[]) {
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return ''
  const base = CHART.h - CHART.padY
  return `${smoothPath(pts)} L${last.x.toFixed(1)} ${base} L${first.x.toFixed(1)} ${base} Z`
}

function ChartGrid() {
  const { w, h, padX, padY } = CHART
  const top = padY
  const plot = h - padY * 2
  return (
    <g className="lp-dash__grid" aria-hidden>
      {[0.28, 0.56, 0.84].map((t) => {
        const y = top + plot * t
        return (
          <line key={t} x1={padX} x2={w - padX} y1={y} y2={y} />
        )
      })}
    </g>
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function LineChart({ values, color, label }: { values: number[]; color: string; label: string }) {
  const pts = coords(values)
  const last = pts[pts.length - 1]
  if (!last) return null
  const curve = smoothPath(pts)
  return (
    <svg className="lp-dash__chart" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="lp-dash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="72%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="lp-dash-glow" x="-15%" y="-40%" width="130%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ChartGrid />
      <path className="lp-dash__area" d={areaPath(pts)} fill="url(#lp-dash-fill)" />
      <path className="lp-dash__line lp-dash__line--glow" d={curve} fill="none" stroke={color} strokeWidth="5" />
      <path className="lp-dash__line" d={curve} fill="none" stroke={color} strokeWidth="2.2" filter="url(#lp-dash-glow)" />
      {pts.slice(0, -1).map((p) => (
        <circle key={`${p.x}-${p.y}`} className="lp-dash__node" cx={p.x} cy={p.y} r="2.4" fill={color} />
      ))}
      <circle className="lp-dash__pulse" cx={last.x} cy={last.y} r="8" fill="none" stroke={color} strokeWidth="1.4" />
      <circle cx={last.x} cy={last.y} r="3.4" fill="#f0f6fc" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function BarChart({ values, color, label }: { values: number[]; color: string; label: string }) {
  const { w, h, padX, padY } = CHART
  const max = Math.max(...values, 1)
  const inner = w - padX * 2
  const gap = 7
  const bw = (inner - gap * (values.length - 1)) / values.length
  return (
    <svg className="lp-dash__chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="lp-dash-bar" gradientUnits="userSpaceOnUse" x1="0" y1={padY} x2="0" y2={h - padY}>
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.42" />
        </linearGradient>
      </defs>
      <ChartGrid />
      {values.map((v, i) => {
        const bh = Math.max((v / max) * (h - padY * 2), 6)
        const x = padX + i * (bw + gap)
        const y = h - padY - bh
        const peak = v === max
        return (
          <g key={DAYS[i]}>
            <rect
              className={`lp-dash__col${peak ? ' lp-dash__col--peak' : ''}`}
              x={x}
              y={y}
              width={bw}
              height={bh}
              rx="5"
              fill="url(#lp-dash-bar)"
              style={{ animationDelay: `${i * 55}ms` }}
            />
            <rect className="lp-dash__cap" x={x + 1.5} y={y} width={bw - 3} height="2.2" rx="1" fill="#e7f6ff" opacity={peak ? 0.95 : 0.38} />
          </g>
        )
      })}
    </svg>
  )
}

export function LandingProductPreview() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const view = VIEWS[index] ?? VIEWS[0]

  useEffect(() => {
    if (paused || prefersReducedMotion()) return
    const id = window.setTimeout(() => setIndex((n) => (n + 1) % VIEWS.length), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [index, paused])

  return (
    <figure
      className="lp-preview lp-dash"
      aria-label={view.chartLabel}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setPaused(true)
      }}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="lp-dash__frame" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="lp-dash__scan" aria-hidden />
      <div key={view.id} className="lp-dash__swap">
        <header className="lp-dash__head">
          <div>
            <p className="lp-dash__kicker">
              <span className="lp-dash__live" />
              {view.kicker}
            </p>
            <p className="lp-dash__total">{view.total}</p>
          </div>
          <p className={`lp-dash__delta lp-dash__delta--${view.deltaTone}`}>{view.delta}</p>
        </header>

        {view.kind === 'line' ? (
          <LineChart values={view.series} color={view.color} label={view.chartLabel} />
        ) : null}
        {view.kind === 'bars' ? (
          <BarChart values={view.series} color={view.color} label={view.chartLabel} />
        ) : null}
        {view.kind === 'stock' && view.stock ? (
          <ul className="lp-dash__stock" aria-label={view.chartLabel}>
            {view.stock.map((item) => (
              <li key={item.name}>
                <div className="lp-dash__stock-row">
                  <span>{item.name}</span>
                  <strong>{item.qty}</strong>
                </div>
                <span className="lp-dash__stock-bar">
                  <span
                    className={item.low ? 'is-low' : undefined}
                    style={{ width: `${item.pct}%`, background: item.low ? '#d29922' : view.color }}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="lp-dash__days" aria-hidden>
            {DAYS.map((day) => (
              <li key={day}>{day}</li>
            ))}
          </ul>
        )}

        <dl className="lp-dash__kpis">
          {view.kpis.map((kpi) => (
            <div key={kpi.label}>
              <dt>{kpi.label}</dt>
              <dd>{kpi.value}</dd>
            </div>
          ))}
        </dl>

        <div className="lp-dash__mix">
          <span className="lp-dash__mix-bar">
            {view.mix.map((item) => (
              <span key={item.label} style={{ width: `${item.pct}%`, background: item.color }} />
            ))}
          </span>
          <ul>
            {view.mix.map((item) => (
              <li key={item.label}>
                <em style={{ background: item.color }} /> {item.label} {item.pct}%
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lp-dash__dots" role="tablist" aria-label="Vistas del panel">
        {VIEWS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={item.kicker}
            className={i === index ? 'is-on' : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </figure>
  )
}
