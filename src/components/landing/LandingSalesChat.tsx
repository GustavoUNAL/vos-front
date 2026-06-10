import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  askLandingAssistant,
  getApiBase,
  getLandingAdvisorUrl,
  type AssistantHistoryItem,
} from '../../api'
import { BRAND_NAME } from '../../lib/brand'
import { useMobileChatKeyboard } from '../../hooks/useMobileChatKeyboard'
import './LandingSalesChat.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  animate?: boolean
}

const WELCOME = `¡Hola! Soy el asistente de **${BRAND_NAME}**.

Somos un sistema operativo inteligente para tu negocio. Estamos en etapa de validación con usuarios reales y te explico cómo usar la plataforma con tu operación.

¿Por dónde empezamos?`

const SUGGESTIONS = [
  '¿Qué es VOS AI?',
  '¿Cómo empiezo con mi negocio?',
  '¿Para qué negocios sirve?',
  'Quiero VOS AI en mi negocio',
  'Hablar con un asesor',
] as const

function sanitizePartialMarkdown(text: string): string {
  const open = (text.match(/\*\*/g) ?? []).length
  if (open % 2 === 1) return text.replace(/\*\*([^*]*)$/, '$1')
  return text
}

function formatInline(text: string): ReactNode[] {
  const safe = sanitizePartialMarkdown(text)
  return safe.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={j}>{part}</span>
    ),
  )
}

function tokenizeForTyping(text: string): string[] {
  const tokens: string[] = []
  const re = /\S+\s*|\n/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0])
  }
  return tokens.length ? tokens : [text]
}

function typingDelay(token: string, prevChar: string | undefined): number {
  if (token === '\n') return 120
  const last = token.trim().slice(-1)
  if (last === '.' || last === '?' || last === '!' || last === ':') return 85
  if (prevChar === '\n') return 45
  if (token.length > 12) return 38
  return 22
}

function MessageBody({ text, lead }: { text: string; lead?: boolean }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bulletLines: string[] = []
  let numberedLines: string[] = []
  let leadUsed = !lead

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

  const flushNumbered = (key: string) => {
    if (!numberedLines.length) return
    blocks.push(
      <ol key={key} className="landing-sales-chat__list landing-sales-chat__list--ordered">
        {numberedLines.map((line, i) => (
          <li key={`${key}-${i}`}>{formatInline(line)}</li>
        ))}
      </ol>,
    )
    numberedLines = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets(`b-${i}`)
      flushNumbered(`n-${i}`)
      blocks.push(<div key={`g-${i}`} className="landing-sales-chat__gap" />)
      return
    }
    if (/^[•\-]\s/.test(trimmed)) {
      flushNumbered(`pre-b-${i}`)
      bulletLines.push(trimmed.replace(/^[•\-]\s*/, ''))
      return
    }
    if (/^\d+\.\s/.test(trimmed)) {
      flushBullets(`pre-n-${i}`)
      numberedLines.push(trimmed.replace(/^\d+\.\s*/, ''))
      return
    }
    if (/^[💡📌✅🎯🛒📈⚠️🏆]/.test(trimmed)) {
      flushBullets(`pre-c-${i}`)
      flushNumbered(`pre-c2-${i}`)
      blocks.push(
        <p key={`c-${i}`} className="landing-sales-chat__callout">
          {formatInline(trimmed)}
        </p>,
      )
      return
    }
    flushBullets(`pre-${i}`)
    flushNumbered(`pre2-${i}`)
    const isLead = lead && !leadUsed
    if (isLead) leadUsed = true
    blocks.push(
      <p key={`p-${i}`} className={isLead ? 'landing-sales-chat__lead' : undefined}>
        {formatInline(trimmed)}
      </p>,
    )
  })
  flushBullets('end')
  flushNumbered('end-num')
  return <>{blocks}</>
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function TypewriterMessage({
  text,
  onTick,
  onDone,
}: {
  text: string
  onTick?: () => void
  onDone?: () => void
}) {
  const reduced = prefersReducedMotion()
  const [displayed, setDisplayed] = useState(reduced ? text : '')
  const [done, setDone] = useState(reduced)
  const onTickRef = useRef(onTick)
  const onDoneRef = useRef(onDone)
  onTickRef.current = onTick
  onDoneRef.current = onDone

  useEffect(() => {
    if (reduced) {
      setDisplayed(text)
      setDone(true)
      onDoneRef.current?.()
      return
    }
    setDisplayed('')
    setDone(false)
    const tokens = tokenizeForTyping(text)
    let index = 0
    let built = ''
    let timer = 0

    const step = () => {
      if (index >= tokens.length) {
        setDisplayed(text)
        setDone(true)
        onDoneRef.current?.()
        return
      }
      built += tokens[index]
      index += 1
      setDisplayed(built)
      onTickRef.current?.()
      const token = tokens[index - 1]
      const prev = index > 1 ? tokens[index - 2] : undefined
      timer = window.setTimeout(step, typingDelay(token, prev?.slice(-1)))
    }

    timer = window.setTimeout(step, 280)
    return () => window.clearTimeout(timer)
  }, [text, reduced])

  return (
    <span className="landing-sales-chat__typewriter">
      <MessageBody text={displayed} lead />
      {!done ? (
        <span className="landing-sales-chat__cursor" aria-hidden>
          |
        </span>
      ) : null}
    </span>
  )
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

function TypingIndicator() {
  return (
    <div className="landing-sales-chat__bubble landing-sales-chat__bubble--assistant landing-sales-chat__typing">
      <span className="landing-sales-chat__typing-label">Escribiendo</span>
      <span className="landing-sales-chat__dot" />
      <span className="landing-sales-chat__dot" />
      <span className="landing-sales-chat__dot" />
    </div>
  )
}

export function LandingSalesChat() {
  const baseUrl = getApiBase()
  const advisorUrl = getLandingAdvisorUrl(
    'Hola, vengo de la web de VOS AI y me gustaría hablar con un asesor.',
  )

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAdvisorCta, setShowAdvisorCta] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const keyboardOpen = useMobileChatKeyboard(open, rootRef)
  const [inputFocused, setInputFocused] = useState(false)
  const hideSuggestions = inputFocused || keyboardOpen
  const composing = hideSuggestions

  const scrollToEnd = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const finishTyping = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, animate: false } : m)),
    )
  }, [])

  useEffect(() => {
    if (!open) return
    setMessages((prev) => {
      if (prev.length > 0) return prev
      return [{ id: 'welcome', role: 'assistant', text: WELCOME, animate: true }]
    })
  }, [open])

  useEffect(() => {
    if (!open) setInputFocused(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    scrollToEnd()
  }, [messages, open, busy, showAdvisorCta, scrollToEnd])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      setInput('')
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }])
      setBusy(true)
      try {
        const history: AssistantHistoryItem[] = messages
          .filter((m) => m.id !== 'welcome')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.text }))
        const { answer, advisorSuggested } = await askLandingAssistant(baseUrl, q, history)
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: answer, animate: true },
        ])
        if (advisorSuggested) setShowAdvisorCta(true)
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text:
              'No pude conectar con el asistente en este momento. Intenta de nuevo en unos segundos o escribe **Hablar con un asesor** si necesitas ayuda humana.',
            animate: true,
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
    composing ? 'landing-sales-chat--composing' : '',
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
                  {m.role === 'assistant' ? (
                    m.animate ? (
                      <TypewriterMessage
                        text={m.text}
                        onTick={scrollToEnd}
                        onDone={() => finishTyping(m.id)}
                      />
                    ) : (
                      <MessageBody text={m.text} lead />
                    )
                  ) : (
                    <p>{m.text}</p>
                  )}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="landing-sales-chat__row landing-sales-chat__row--assistant">
                <span className="landing-sales-chat__row-avatar" aria-hidden>
                  <RobotIcon />
                </span>
                <TypingIndicator />
              </div>
            ) : null}
            {showAdvisorCta && advisorUrl ? (
              <div className="landing-sales-chat__advisor-card">
                <p>Listo — un asesor puede seguir por WhatsApp.</p>
                <a
                  className="landing-sales-chat__advisor-btn"
                  href={advisorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continuar por WhatsApp
                </a>
              </div>
            ) : null}
          </div>

          {!hideSuggestions ? (
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

          <div className="landing-sales-chat__composer">
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
                onFocus={() => {
                  setInputFocused(true)
                  requestAnimationFrame(() => scrollToEnd())
                }}
                onBlur={() => {
                  setInputFocused(false)
                }}
                placeholder="Pregunta sobre VOS AI…"
                disabled={busy}
                enterKeyHint="send"
                autoComplete="off"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar">
                ↑
              </button>
            </form>
          </div>

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
