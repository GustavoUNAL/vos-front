import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  askLandingAssistant,
  getApiBase,
  getLandingAdvisorUrl,
  type AssistantHistoryItem,
} from '../../api'
import { BRAND_NAME } from '../../lib/brand'
import { useVisualViewport } from '../../hooks/useVisualViewport'
import './LandingSalesChat.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const WELCOME = `Hola, soy el asistente de ${BRAND_NAME}.\n\nTe explico en segundos qué hacemos y cómo puede ayudarte tu empresa. ¿Qué te gustaría saber?`

const SUGGESTIONS = [
  '¿Qué es VOS AI?',
  '¿Cómo funciona?',
  '¿Para qué empresas sirve?',
  '¿Cuánto cuesta?',
  'Quiero hablar con un asesor',
] as const

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={j}>{part}</span>
    ),
  )
}

function MessageBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bulletLines: string[] = []

  const flushBullets = (key: string) => {
    if (!bulletLines.length) return
    blocks.push(
      <ul key={key} className="landing-sales-chat__list">
        {bulletLines.map((line, i) => (
          <li key={`${key}-${i}`}>{formatInline(line)}</li>
        ))}
      </ul>,
    )
    bulletLines = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets(`b-${i}`)
      blocks.push(<div key={`g-${i}`} className="landing-sales-chat__gap" />)
      return
    }
    if (/^[•\-]\s/.test(trimmed)) {
      bulletLines.push(trimmed.replace(/^[•\-]\s*/, ''))
      return
    }
    flushBullets(`pre-${i}`)
    blocks.push(<p key={`p-${i}`}>{formatInline(trimmed)}</p>)
  })
  flushBullets('end')
  return <>{blocks}</>
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className="landing-sales-chat__robot">
      <rect x="16" y="22" width="32" height="26" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26" cy="34" r="4" fill="currentColor" />
      <circle cx="38" cy="34" r="4" fill="currentColor" />
      <path d="M28 42h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 12v10M22 16h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}

export function LandingSalesChat() {
  const baseUrl = getApiBase()
  const advisorUrl = getLandingAdvisorUrl(
    'Hola, vengo de la web de VOS AI y me gustaría hablar con un asesor.',
  )

  const [open, setOpen] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAdvisorCta, setShowAdvisorCta] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME },
  ])

  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useVisualViewport(open, rootRef)

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const check = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 80)
    }
    check()
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, busy, showAdvisorCta])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      setInput('')
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }])
      setBusy(true)
      setShowAdvisorCta(false)
      try {
        const history: AssistantHistoryItem[] = messages
          .filter((m) => m.id !== 'welcome')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.text }))
        const { answer, advisorSuggested } = await askLandingAssistant(baseUrl, q, history)
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: answer },
        ])
        if (advisorSuggested) setShowAdvisorCta(true)
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text:
              'No pude conectar con el asistente en este momento. Probá de nuevo en unos segundos o usá **Hablar con un asesor** si necesitás ayuda humana.',
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [baseUrl, busy, messages],
  )

  const rootClass = [
    'landing-sales-chat',
    open ? 'landing-sales-chat--open' : '',
    keyboardOpen ? 'landing-sales-chat--kb' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={rootClass}>
      {open ? (
        <button
          type="button"
          className="landing-sales-chat__backdrop"
          aria-label="Cerrar chat"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div className="landing-sales-chat__panel" role="dialog" aria-label="Asistente comercial VOS AI">
          <header className="landing-sales-chat__head">
            <div className="landing-sales-chat__head-brand">
              <span className="landing-sales-chat__head-icon" aria-hidden>
                <RobotIcon />
              </span>
              <div>
                <strong>
                  {BRAND_NAME}
                  <span className="landing-sales-chat__live" aria-label="En línea" />
                </strong>
                <span>Asistente comercial · impulsado por IA</span>
              </div>
            </div>
            <button
              type="button"
              className="landing-sales-chat__close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="landing-sales-chat__messages" ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`landing-sales-chat__row landing-sales-chat__row--${m.role}`}
              >
                {m.role === 'assistant' ? (
                  <span className="landing-sales-chat__row-avatar" aria-hidden>
                    <RobotIcon />
                  </span>
                ) : null}
                <div
                  className={`landing-sales-chat__bubble landing-sales-chat__bubble--${m.role}`}
                >
                  {m.role === 'assistant' ? <MessageBody text={m.text} /> : <p>{m.text}</p>}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="landing-sales-chat__row landing-sales-chat__row--assistant">
                <span className="landing-sales-chat__row-avatar" aria-hidden>
                  <RobotIcon />
                </span>
                <div className="landing-sales-chat__bubble landing-sales-chat__bubble--assistant landing-sales-chat__typing">
                  <span className="landing-sales-chat__typing-bar" />
                  Analizando…
                </div>
              </div>
            ) : null}
            {showAdvisorCta && advisorUrl ? (
              <div className="landing-sales-chat__advisor-card">
                <p>¿Preferís que te guíe un asesor?</p>
                <a
                  className="landing-sales-chat__advisor-btn"
                  href={advisorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hablar con un asesor
                </a>
              </div>
            ) : null}
          </div>

          {!keyboardOpen ? (
            <div className="landing-sales-chat__suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="landing-sales-chat__chip"
                  disabled={busy}
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className="landing-sales-chat__form"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Preguntá sobre VOS AI…"
              disabled={busy}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar">
              ↑
            </button>
          </form>

          {advisorUrl ? (
            <a
              className="landing-sales-chat__wa"
              href={advisorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hablar con un asesor por WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className="landing-sales-chat__fab"
        aria-label={open ? 'Cerrar chat de ayuda' : `Abrir chat ${BRAND_NAME}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="landing-sales-chat__fab-icon" aria-hidden>
          <RobotIcon />
        </span>
        <span className="landing-sales-chat__fab-label">{BRAND_NAME}</span>
      </button>
    </div>
  )
}
