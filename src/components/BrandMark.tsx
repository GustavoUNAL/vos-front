type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

export function BrandMark({
  size = 'md',
  showTagline = false,
  className = '',
}: BrandMarkProps) {
  return (
    <div className={`brand-mark brand-mark--${size}${className ? ` ${className}` : ''}`}>
      <div className="brand-mark__text">
        <span className="brand-mark__name" aria-label="vos punto ai">
          <span className="brand-mark__vos">vos</span>
          <span className="brand-mark__dot">.</span>
          <span className="brand-mark__ai">ai</span>
        </span>
        {showTagline && (
          <span className="brand-mark__tagline">
            Sistema operativo empresarial
          </span>
        )}
      </div>
    </div>
  )
}
