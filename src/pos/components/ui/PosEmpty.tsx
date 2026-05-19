export function PosEmpty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="pos-empty">
      <p className="pos-empty__title">{title}</p>
      {hint && <p className="pos-empty__hint muted">{hint}</p>}
      {action && <div className="pos-empty__action">{action}</div>}
    </div>
  )
}
