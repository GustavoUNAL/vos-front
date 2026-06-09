import { BRAND_NAME, BRAND_TAGLINE } from '../lib/brand'

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
        <span className="brand-mark__name" aria-label={BRAND_NAME}>
          <span className="brand-mark__vos">VOS </span>
          <span className="brand-mark__ai">AI</span>
        </span>
        {showTagline ? (
          <span className="brand-mark__tagline">{BRAND_TAGLINE}</span>
        ) : null}
      </div>
    </div>
  )
}

export { BRAND_NAME, BRAND_TAGLINE }
