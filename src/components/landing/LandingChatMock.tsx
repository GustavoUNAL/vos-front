import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { BRAND_NAME } from '../../lib/brand'

export type LandingChatMetric = {
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'neutral'
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

const DEMO_LOOP_HOLD_MS = 6500
const DEMO_LOOP_FADE_MS = 480

type RevealPace = 'default' | 'relaxed'

type Props = {
  turns?: LandingChatTurn[]
  /** Hero: varias preguntas en bucle, tamaño fijo, solo visualización */
  demoLoop?: LandingChatTurn[][]
  compact?: boolean
  className?: string
  /** Estilo app VOS o conversación tipo WhatsApp */
  variant?: 'app' | 'whatsapp'
  /** Marco tipo teléfono (ideal en hero) */
  framed?: boolean
  caption?: string
  /** Carruseles: inicia la animación al montar sin esperar scroll */
  startImmediately?: boolean
  /** Hero: inicia solo cuando el mock está centrado en pantalla (tras leer el copy) */
  playWhenCentered?: boolean
  /** Sin interacción — demo tipo GIF */
  readOnly?: boolean
  /** Repite la misma conversación tras una pausa al terminar */
  conversationLoop?: boolean
}

const CENTERED_PLAY_ROOT_MARGIN = '-18% 0px -28% 0px'
const CENTERED_PLAY_THRESHOLD = 0.48

function observePlayWhenCentered(
  figure: HTMLElement,
  onActivate: () => void,
): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (reduced.matches) {
    figure.classList.add('is-visible')
    onActivate()
    return () => undefined
  }

  let done = false
  const activate = () => {
    if (done) return
    done = true
    figure.classList.add('is-visible')
    onActivate()
    cleanup()
  }

  const isCentered = (entry?: IntersectionObserverEntry) => {
    const rect = figure.getBoundingClientRect()
    if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) {
      return false
    }

    const vh = window.innerHeight
    const centerY = rect.top + rect.height / 2
    const nearViewportCenter = Math.abs(centerY - vh / 2) <= vh * 0.24

    const visibleTop = Math.max(rect.top, 0)
    const visibleBottom = Math.min(rect.bottom, vh)
    const visibleRatio = (visibleBottom - visibleTop) / rect.height
    const ratio = entry?.isIntersecting ? entry.intersectionRatio : visibleRatio

    return nearViewportCenter && ratio >= CENTERED_PLAY_THRESHOLD
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && isCentered(entry)) activate()
      }
    },
    {
      root: null,
      rootMargin: CENTERED_PLAY_ROOT_MARGIN,
      threshold: [0, 0.25, 0.48, 0.6, 0.75],
    },
  )

  const onScroll = () => {
    if (isCentered()) activate()
  }

  obs.observe(figure)
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll, { passive: true })

  let cleanup = () => {
    obs.disconnect()
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
  }

  onScroll()
  return cleanup
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function delayAfterTurn(turn: LandingChatTurn, pace: RevealPace = 'default'): number {
  if (turn.role === 'user') return pace === 'relaxed' ? 1500 : 520
  const parts =
    (turn.text ? 1 : 0) +
    (turn.badge ? 1 : 0) +
    (turn.metrics?.length ? 1 : 0) +
    (turn.bullets?.length ? 1 : 0) +
    (turn.insight ? 1 : 0)
  return pace === 'relaxed' ? 2000 + parts * 680 : 900 + parts * 380
}

function typingDelay(turn: LandingChatTurn, pace: RevealPace = 'default'): number {
  if (turn.role === 'user') return 0
  const len = (turn.text?.length ?? 0) + (turn.bullets?.join('').length ?? 0)
  return pace === 'relaxed'
    ? 1500 + Math.min(len, 120) * 18
    : 650 + Math.min(len, 120) * 12
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

function WhatsAppGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="landing-chat__avatar landing-chat__avatar--user" aria-hidden>
      {initial}
    </span>
  )
}

function RichLine({ html, block }: { html: string; block?: boolean }) {
  const Tag = block ? 'p' : 'span'
  return <Tag className="landing-chat__rich" dangerouslySetInnerHTML={{ __html: html }} />
}

function MetricTrend({ trend }: { trend?: LandingChatMetric['trend'] }) {
  if (!trend || trend === 'neutral') return null
  return (
    <span
      className={`landing-chat__metric-trend landing-chat__metric-trend--${trend}`}
      aria-hidden
    >
      {trend === 'up' ? '↑' : '↓'}
    </span>
  )
}

function AiBubbleContent({ turn, animate }: { turn: LandingChatTurn; animate: boolean }) {
  return (
    <div className={`landing-chat__ai-content${animate ? ' landing-chat__ai-content--stagger' : ''}`}>
      {turn.badge ? <span className="landing-chat__badge">{turn.badge}</span> : null}
      {turn.text ? <RichLine html={turn.text} block /> : null}
      {turn.metrics?.length ? (
        <div className="landing-chat__metrics">
          {turn.metrics.map((m) => (
            <div key={m.label} className="landing-chat__metric">
              <span className="landing-chat__metric-label">{m.label}</span>
              <span className="landing-chat__metric-value-row">
                <span className="landing-chat__metric-value">{m.value}</span>
                <MetricTrend trend={m.trend} />
              </span>
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

function TypingBubble() {
  return (
    <div className="landing-chat__bubble landing-chat__bubble--ai landing-chat__bubble--typing">
      <span className="landing-chat__typing-label">Escribiendo</span>
      <span className="landing-chat__dot" />
      <span className="landing-chat__dot" />
      <span className="landing-chat__dot" />
    </div>
  )
}

function useConversationReveal(
  turns: LandingChatTurn[],
  enabled: boolean,
  onComplete?: () => void,
  pace: RevealPace = 'default',
  replayKey = 0,
) {
  const reduced = prefersReducedMotion()
  const [revealed, setRevealed] = useState(reduced ? turns.length : 0)
  const [typing, setTyping] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (!enabled || reduced) {
      setRevealed(turns.length)
      setTyping(false)
      return
    }

    completedRef.current = false
    setRevealed(0)
    setTyping(false)

    let cancelled = false
    let timer = 0
    let index = 0

    const revealNext = () => {
      if (cancelled || index >= turns.length) {
        setTyping(false)
        return
      }

      const turn = turns[index]
      if (turn.role === 'ai' && index > 0) {
        setTyping(true)
        timer = window.setTimeout(() => {
          if (cancelled) return
          setTyping(false)
          setRevealed(index + 1)
          index += 1
          timer = window.setTimeout(revealNext, delayAfterTurn(turn, pace))
        }, typingDelay(turn, pace))
        return
      }

      setRevealed(index + 1)
      index += 1
      timer = window.setTimeout(revealNext, delayAfterTurn(turn, pace))
    }

    timer = window.setTimeout(revealNext, pace === 'relaxed' ? 950 : 480)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [enabled, pace, reduced, replayKey, turns])

  useEffect(() => {
    if (!enabled || reduced || !onComplete || turns.length === 0) return
    if (revealed >= turns.length && !typing) {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    completedRef.current = false
  }, [enabled, reduced, onComplete, revealed, turns.length, typing])

  return { revealed, typing, reduced }
}

const MOBILE_LANDING_MQ = '(max-width: 720px)'

export function LandingChatMock({
  turns = [],
  demoLoop,
  compact = false,
  className = '',
  variant = 'app',
  framed = false,
  caption,
  startImmediately = false,
  playWhenCentered = false,
  readOnly = false,
  conversationLoop = false,
}: Props) {
  const figureRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const holdTimerRef = useRef(0)
  const [inView, setInView] = useState(false)
  const [played, setPlayed] = useState(false)
  const [demoIndex, setDemoIndex] = useState(0)
  const [demoFading, setDemoFading] = useState(false)
  const [conversationReplay, setConversationReplay] = useState(0)
  const listId = useId()
  const isWhatsApp = variant === 'whatsapp'
  const isDemoLoop = Boolean(demoLoop?.length)
  const activeTurns = isDemoLoop ? (demoLoop?.[demoIndex] ?? []) : turns

  const advanceDemoLoop = useCallback(() => {
    if (!demoLoop?.length) return
    setDemoFading(true)
    holdTimerRef.current = window.setTimeout(() => {
      setDemoIndex((i) => (i + 1) % demoLoop.length)
      setDemoFading(false)
    }, DEMO_LOOP_FADE_MS)
  }, [demoLoop])

  useEffect(
    () => () => {
      window.clearTimeout(holdTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const figure = figureRef.current
    const el = rootRef.current
    if (!figure || !el) return

    const mobile = window.matchMedia(MOBILE_LANDING_MQ)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const start = () => {
      if (played) return
      setInView(true)
      setPlayed(true)
    }

    if (startImmediately) {
      start()
      return undefined
    }

    if (playWhenCentered) {
      return observePlayWhenCentered(figure, start)
    }

    if (!mobile.matches || reduced.matches) {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start()
        },
        { threshold: 0.28, rootMargin: '0px 0px -8% 0px' },
      )
      obs.observe(el)
      return () => obs.disconnect()
    }

    const tryStart = () => {
      if (figure.classList.contains('is-visible')) start()
    }

    tryStart()
    const mo = new MutationObserver(tryStart)
    mo.observe(figure, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [played, startImmediately, playWhenCentered])

  const handleDemoComplete = useCallback(() => {
    if (!isDemoLoop) return
    holdTimerRef.current = window.setTimeout(advanceDemoLoop, DEMO_LOOP_HOLD_MS)
  }, [advanceDemoLoop, isDemoLoop])

  const handleConversationLoopComplete = useCallback(() => {
    if (!conversationLoop) return
    holdTimerRef.current = window.setTimeout(() => {
      const el = bodyRef.current
      if (el) el.scrollTo({ top: 0, behavior: 'auto' })
      setConversationReplay((r) => r + 1)
    }, DEMO_LOOP_HOLD_MS)
  }, [conversationLoop])

  const relaxedPace = isDemoLoop || conversationLoop

  const { revealed, typing, reduced } = useConversationReveal(
    activeTurns,
    inView,
    isDemoLoop
      ? handleDemoComplete
      : conversationLoop
        ? handleConversationLoopComplete
        : undefined,
    relaxedPace ? 'relaxed' : 'default',
    isDemoLoop ? demoIndex : conversationReplay,
  )

  useEffect(() => {
    if (isDemoLoop) return
    const el = bodyRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [isDemoLoop, revealed, typing, reduced])

  const visibleTurns = activeTurns.slice(0, revealed)

  const shellClass = [
    'landing-chat',
    compact ? 'landing-chat--compact' : '',
    inView ? 'landing-chat--live' : '',
    isWhatsApp ? 'landing-chat--whatsapp' : '',
    framed ? 'landing-chat--framed-inner' : '',
    isDemoLoop ? 'landing-chat--demo-loop' : '',
    conversationLoop ? 'landing-chat--conversation-loop' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const chat: ReactNode = (
    <div
      ref={rootRef}
      className={shellClass}
      aria-hidden={readOnly ? true : undefined}
      aria-label={
        readOnly
          ? undefined
          : isWhatsApp
            ? 'Ejemplo de conversación por WhatsApp con VOS AI'
            : 'Ejemplo de conversación con VOS AI'
      }
    >
      <div className={`landing-chat__head${isWhatsApp ? ' landing-chat__head--wa' : ''}`}>
        {isWhatsApp ? (
          <>
            <span className="landing-chat__wa-back" aria-hidden>‹</span>
            <span className="landing-chat__head-brand landing-chat__head-brand--wa">
              <span className="landing-chat__wa-avatar" aria-hidden>
                <RobotIcon className="landing-chat__head-robot" />
              </span>
              <span className="landing-chat__wa-meta">
                <span className="landing-chat__title">{BRAND_NAME}</span>
                <span className="landing-chat__live">{typing ? 'escribiendo…' : 'en línea'}</span>
              </span>
            </span>
            <WhatsAppGlyph className="landing-chat__wa-glyph" />
          </>
        ) : (
          <>
            <span className="landing-chat__status" aria-hidden />
            <span className="landing-chat__head-brand">
              <RobotIcon className="landing-chat__head-robot" />
              <span className="landing-chat__title">{BRAND_NAME}</span>
            </span>
            <span className="landing-chat__live">{typing ? 'Escribiendo…' : 'En línea'}</span>
          </>
        )}
      </div>
      <div
        ref={bodyRef}
        className={`landing-chat__body${isDemoLoop ? ' landing-chat__body--loop' : ''}${demoFading ? ' landing-chat__body--loop-fade' : ''}`}
        id={listId}
        aria-live={readOnly ? 'off' : 'polite'}
        aria-relevant="additions"
      >
        {visibleTurns.map((turn, i) => {
          const isLatest = i === visibleTurns.length - 1 && !typing
          return (
            <div
              key={`${demoIndex}-${turn.role}-${turn.who}-${i}`}
              className={`landing-chat__row landing-chat__row--${turn.role === 'user' ? 'user' : 'ai'} landing-chat__row--enter`}
              style={{ animationDelay: reduced ? '0ms' : `${Math.min(i * 40, 120)}ms` }}
            >
              {turn.role === 'ai' ? (
                <span className="landing-chat__avatar" aria-hidden>
                  <RobotIcon />
                </span>
              ) : (
                <UserAvatar name={turn.who} />
              )}
              <div
                className={`landing-chat__bubble landing-chat__bubble--${turn.role === 'user' ? 'user' : 'ai'}`}
              >
                {!isWhatsApp ? <span className="landing-chat__who">{turn.who}</span> : null}
                {turn.role === 'ai' ? (
                  <AiBubbleContent turn={turn} animate={isLatest && !reduced} />
                ) : turn.text ? (
                  <p>{turn.text}</p>
                ) : null}
                {isWhatsApp ? (
                  <span className="landing-chat__bubble-time" aria-hidden>
                    {turn.role === 'ai' ? '10:24' : '10:23'}
                    {turn.role === 'user' ? <span className="landing-chat__bubble-checks">✓✓</span> : null}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}

        {typing ? (
          <div className="landing-chat__row landing-chat__row--ai landing-chat__row--enter">
            <span className="landing-chat__avatar" aria-hidden>
              <RobotIcon />
            </span>
            <TypingBubble />
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <figure
      ref={figureRef}
      role={readOnly ? 'img' : undefined}
      aria-label={
        readOnly
          ? 'Demo animado: preguntas sobre ventas, compras y utilidad con VOS AI'
          : undefined
      }
      className={`landing-chat-figure landing-chat-reveal${framed ? ' landing-chat-figure--framed' : ''}${playWhenCentered ? ' landing-chat-reveal--centered-play' : ''}${readOnly ? ' landing-chat-figure--readonly' : ''}`}
    >
      {framed ? (
        <div className="landing-chat-device" aria-hidden>
          <div className="landing-chat-device__notch" />
          {chat}
          <div className="landing-chat-device__home" />
        </div>
      ) : (
        chat
      )}
      {caption ? (
        <figcaption className="landing-chat-figure__caption muted small">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
