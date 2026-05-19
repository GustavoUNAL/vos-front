import { formatCOP } from '../../lib/money'

export function PosMoney({
  value,
  className = '',
}: {
  value: number
  className?: string
}) {
  return (
    <span className={`pos-money ${className}`.trim()}>{formatCOP(value)}</span>
  )
}
