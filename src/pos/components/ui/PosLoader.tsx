export function PosLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="pos-loader" role="status" aria-live="polite">
      <span className="pos-loader__ring" aria-hidden />
      <span className="pos-loader__label">{label}</span>
    </div>
  )
}
