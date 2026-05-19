export function PosErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <div className="pos-banner pos-banner--error" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="pos-banner__dismiss" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  )
}
