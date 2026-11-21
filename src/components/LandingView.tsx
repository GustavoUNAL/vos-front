import { VosHome } from './landing/VosHome'
import '../public-shell.css'
import './landing/vos-home.css'

type Props = {
  onLoginClick?: () => void
  onAccessRequestClick?: () => void
  onHealthLoginClick?: () => void
}

export function LandingView({ onLoginClick, onAccessRequestClick }: Props) {
  return (
    <div className="public-shell landing-v2 vos-home">
      <VosHome onLoginClick={onLoginClick} onStartClick={onAccessRequestClick} />
    </div>
  )
}
