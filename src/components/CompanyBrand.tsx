type CompanyBrandProps = {
  name: string
  size?: 'sm' | 'md'
  className?: string
}

export function CompanyBrand({
  name,
  size = 'md',
  className = '',
}: CompanyBrandProps) {
  const logoPx = size === 'md' ? 44 : 36

  return (
    <div
      className={`company-brand company-brand--${size}${className ? ` ${className}` : ''}`}
    >
      <img
        className="company-brand__logo"
        src="/logo.png"
        width={logoPx}
        height={logoPx}
        alt=""
        decoding="async"
      />
      <span className="company-brand__name">{name}</span>
    </div>
  )
}
