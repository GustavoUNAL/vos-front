import { BRAND_NAME } from '../../lib/brand'

export type LandingChatMetric = {
  label: string
  value: string
  hint?: string
}

export type LandingChatTurn = {
  who: string
  role: 'user' | 'ai'
  text?: string
  badge?: string
  metrics?: LandingChatMetric[]
  bullets?: string[]
  insight?: string
}

type Props = {
  turns: LandingChatTurn[]
  compact?: boolean
  className?: string
}

function RobotIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={`landing-chat__robot${className ? ` ${className}` : ''}`}
    >
      <rect x="16" y="22" width="32" height="26" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26" cy="34" r="4" fill="currentColor" />
      <circle cx="38" cy="34" r="4" fill="currentColor" />
      <path d="M28 42h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 12v10M22 16h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}

function RichLine({ html, block }: { html: string; block?: boolean }) {
  const Tag = block ? 'p' : 'span'
  return <Tag className="landing-chat__rich" dangerouslySetInnerHTML={{ __html: html }} />
}

function AiBubbleContent({ turn }: { turn: LandingChatTurn }) {
  return (
    <div className="landing-chat__ai-content">
      {turn.badge ? <span className="landing-chat__badge">{turn.badge}</span> : null}
      {turn.text ? <RichLine html={turn.text} block /> : null}
      {turn.metrics?.length ? (
        <div className="landing-chat__metrics">
          {turn.metrics.map((m) => (
            <div key={m.label} className="landing-chat__metric">
              <span className="landing-chat__metric-label">{m.label}</span>
              <span className="landing-chat__metric-value">{m.value}</span>
              {m.hint ? <span className="landing-chat__metric-hint">{m.hint}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {turn.bullets?.length ? (
        <ul className="landing-chat__list">
          {turn.bullets.map((line) => (
            <li key={line}>
              <RichLine html={line} />
            </li>
          ))}
        </ul>
      ) : null}
      {turn.insight ? (
        <div className="landing-chat__insight">
          <RichLine html={turn.insight} />
        </div>
      ) : null}
    </div>
  )
}

export function LandingChatMock({ turns, compact = false, className = '' }: Props) {
  return (
    <div
      className={`landing-chat${compact ? ' landing-chat--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Ejemplo de conversación con VOS AI"
    >
      <div className="landing-chat__head">
        <span className="landing-chat__status" aria-hidden />
        <span className="landing-chat__head-brand">
          <RobotIcon className="landing-chat__head-robot" />
          <span className="landing-chat__title">{BRAND_NAME}</span>
        </span>
        <span className="landing-chat__live">En línea</span>
      </div>
      <div className="landing-chat__body">
        {turns.map((turn, i) => (
          <div
            key={`${turn.role}-${i}`}
            className={`landing-chat__row landing-chat__row--${turn.role === 'user' ? 'user' : 'ai'}`}
          >
            {turn.role === 'ai' ? (
              <span className="landing-chat__avatar" aria-hidden>
                <RobotIcon />
              </span>
            ) : null}
            <div
              className={`landing-chat__bubble landing-chat__bubble--${turn.role === 'user' ? 'user' : 'ai'}`}
            >
              <span className="landing-chat__who">{turn.who}</span>
              {turn.role === 'ai' ? (
                <AiBubbleContent turn={turn} />
              ) : turn.text ? (
                <p>{turn.text}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
