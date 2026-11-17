import { landingIcon } from './landingIcons'

export function LandingArt({
  view,
  size = 'card',
}: {
  view: string
  size?: 'card' | 'step' | 'chip' | 'modal'
}) {
  const src = landingIcon(view)
  if (!src) return null
  return <img className={`lp-art lp-art--${size}`} src={src} alt="" />
}
