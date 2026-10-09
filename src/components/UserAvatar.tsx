import { useState } from 'react'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function UserAvatar({
  name,
  url,
  className,
}: {
  name: string
  url?: string | null
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return (
      <img
        className={className}
        src={url}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  return (
    <span className={className} aria-hidden>
      {initials(name)}
    </span>
  )
}
