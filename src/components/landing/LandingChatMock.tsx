import { BRAND_NAME } from '../../lib/brand'

export type LandingChatTurn = {
  who: string
  text: string
  role: 'user' | 'ai'
}

type Props = {
  turns: LandingChatTurn[]
  compact?: boolean
  className?: string
}

export function LandingChatMock({ turns, compact = false, className = '' }: Props) {
  return (
    <div
      className={`landing-chat${compact ? ' landing-chat--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Ejemplo de conversación con VOS AI"
    >
      <div className="landing-chat__head">
        <span className="landing-chat__dot" />
        <span className="landing-chat__dot" />
        <span className="landing-chat__dot" />
        <span className="landing-chat__title">{BRAND_NAME}</span>
      </div>
      <div className="landing-chat__body">
        {turns.map((turn, i) => (
          <div
            key={`${turn.role}-${i}`}
            className={`landing-chat__bubble landing-chat__bubble--${turn.role === 'user' ? 'user' : 'ai'}`}
          >
            <span className="landing-chat__who">{turn.who}</span>
            {turn.text.split('\n').map((line, j) => (
              <p key={j} dangerouslySetInnerHTML={{ __html: line }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
