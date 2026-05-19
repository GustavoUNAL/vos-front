export function formatElapsedSince(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—'
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return '—'
  const diffMs = Date.now() - start
  if (diffMs < 0) return '0 min'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  if (hrs < 24) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
