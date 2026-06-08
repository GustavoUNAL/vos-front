import { displayCompanyName } from '../lib/displayLabels'

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
  return (
    <div
      className={`company-brand company-brand--${size}${className ? ` ${className}` : ''}`}
    >
      <span className="company-brand__name">{displayCompanyName(name)}</span>
    </div>
  )
}
