import { BRAND_TAGLINE } from '../lib/brand'
import { BrandMark } from './BrandMark'

type Props = {
  chips: string[]
}

export function PublicAuthMobileIntro({ chips }: Props) {
  return (
    <div className="public-auth__mobile-intro">
      <BrandMark size="sm" showTagline />
      <p className="public-auth__mobile-tagline">{BRAND_TAGLINE}</p>
      <div className="public-auth__chips" role="list">
        {chips.map((label) => (
          <span key={label} className="public-auth__chip" role="listitem">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
