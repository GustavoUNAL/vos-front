import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { askBusinessAssistant, type AssistantHistoryItem } from '../api'
import { useMobileChatKeyboard } from '../hooks/useMobileChatKeyboard'
import './VosAssistantWidget.css'

const ASSISTANT_SESSION_START = '__SESSION_START__'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  animate?: boolean
}

type SuggestionItem = { icon: string; label: string; prompt: string }

const WELCOME_SUGGESTIONS: SuggestionItem[] = [
  {
    icon: '📊',
    label: 'Panorama hoy',
    prompt: '¿Cómo va el negocio hoy? Dame un resumen ejecutivo.',
  },
  {
    icon: '⚖️',
    label: 'Hoy vs ayer',
    prompt:
      '¿Cómo voy hoy frente a ayer en ventas y utilidad? ¿Qué cambió?',
  },
  {
    icon: '📈',
    label: 'Tendencia semana',
    prompt:
      '¿Cómo vamos esta semana? ¿La tendencia es positiva o debo preocuparme?',
  },
  {
    icon: '💰',
    label: 'Salud del mes',
    prompt:
      '¿Cuál es mi utilidad y resultado del mes? ¿Voy bien financieramente?',
  },
  {
    icon: '🎯',
    label: 'Plan de compras',
    prompt:
      '¿Qué debo comprar primero según inventario y ventas? Priorizame.',
  },
  {
    icon: '🚨',
    label: 'Alertas hoy',
    prompt:
      '¿Qué riesgos ves hoy en stock, pedidos web o tareas pendientes?',
  },
]

const FOLLOW_UP_SUGGESTIONS: SuggestionItem[] = [
  {
    icon: '🏆',
    label: 'Margen real',
    prompt:
      '¿Qué productos dejan más utilidad y cuáles solo volumen? ¿En cuál debo enfocarme?',
  },
  {
    icon: '👥',
    label: 'Recuperar clientes',
    prompt:
      '¿Qué clientes no han regresado y qué acción concreta me recomiendas para traerlos?',
  },
  {
    icon: '📉',
    label: 'Fugas de plata',
    prompt:
      '¿Dónde se me va la plata este mes entre compras, nómina y operación?',
  },
  {
    icon: '🧭',
    label: '3 prioridades',
    prompt:
      'Con mis datos actuales, ¿cuáles son las 3 acciones más importantes para hoy?',
  },
  {
    icon: '📦',
    label: 'Stock crítico',
    prompt:
      '¿Qué insumos se agotan pronto y cómo afecta eso mis ventas de los próximos días?',
  },
  {
    icon: '✨',
    label: 'Oportunidad',
    prompt:
      '¿Qué oportunidad de crecimiento ves en mi negocio con los números de ahora?',
  },
]

const FALLBACK_WELCOME =
  '¡Hola! Soy **VOS AI**, tu gerente digital.\n\nPuedo contarte ventas en vivo, inventario, compras, personal, pedidos web y tareas del día.\n\n¿Qué querés revisar?'

function RobotIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className="vos-assistant__robot-svg">
      <rect x="16" y="22" width="32" height="26" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26" cy="34" r="4" fill="currentColor" />
      <circle cx="38" cy="34" r="4" fill="currentColor" />
      <path d="M28 42h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 12v10M22 16h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}

function sanitizePartialMarkdown(text: string): string {
  const open = (text.match(/\*\*/g) ?? []).length
  if (open % 2 === 1) return text.replace(/\*\*([^*]*)$/, '$1')
  return text
}

function formatInline(text: string): ReactNode[] {
  const safe = sanitizePartialMarkdown(text)
  return safe.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function AssistantMessageBody({ text, lead }: { text: string; lead?: boolean }) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let bulletBuffer: string[] = []
  let leadUsed = !lead

  const flushBullets = (key: string) => {
    if (!bulletBuffer.length) return
    nodes.push(
      <ul key={key} className="vos-assistant__list">
        {bulletBuffer.map((line, i) => (
          <li key={`${key}-${i}`}>{formatInline(line)}</li>
        ))}
      </ul>,
    )
    bulletBuffer = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) {
      flushBullets(`gap-${i}`)
      nodes.push(<div key={`sp-${i}`} className="vos-assistant__gap" />)
      return
    }
    const isBullet = /^[•\-\*]\s/.test(trimmed)
    if (isBullet) {
      bulletBuffer.push(trimmed.replace(/^[•\-\*]\s*/, ''))
      return
    }
    flushBullets(`pre-${i}`)
    const isSection = /^[📊🛒💰🏆👥📦🧾👨‍🍳🛍️📈🤖📋]/.test(trimmed)
    const isLead = lead && !leadUsed
    if (isLead) leadUsed = true
    nodes.push(
      <p
        key={`p-${i}`}
        className={
          isSection
            ? 'vos-assistant__section-title'
            : isLead
              ? 'vos-assistant__lead'
              : undefined
        }
      >
        {formatInline(trimmed)}
      </p>,
    )
  })
  flushBullets('end')

  return <>{nodes}</>
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
    <span className="vos-assistant__typewriter">
      <AssistantMessageBody text={displayed} lead />
      {!done ? (
        <span className="vos-assistant__cursor" aria-hidden>
          |
        </span>
      ) : null}
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="vos-assistant__bubble vos-assistant__bubble--assistant vos-assistant__typing">
      <span className="vos-assistant__typing-label">Escribiendo</span>
      <span className="vos-assistant__dot" />
      <span className="vos-assistant__dot" />
      <span className="vos-assistant__dot" />
    </div>
  )
}

function SuggestionChips({
  items,
  visible,
  wave,
  strategic,
  disabled,
  onPick,
}: {
  items: SuggestionItem[]
  visible: boolean
  wave: number
  strategic: boolean
  disabled: boolean
  onPick: (text: string) => void
}) {
  return (
    <div
      className={[
        'vos-assistant__suggestions',
        visible ? ' vos-assistant__suggestions--visible' : '',
      ]
        .filter(Boolean)
        .join('')}
      aria-hidden={!visible}
    >
      <div className="vos-assistant__suggestions-body">
        <p className="vos-assistant__suggestions-hint">
          {visible ? (strategic ? 'Estrategia' : 'Empezá por aquí') : ''}
        </p>
        <div className="vos-assistant__suggestions-track">
          <div key={wave} className="vos-assistant__suggestion-chips">
            {items.map((item, index) => (
              <button
                key={`${wave}-${item.prompt}`}
                type="button"
                className="vos-assistant__chip"
                style={{ '--chip-i': index } as CSSProperties}
                disabled={disabled || !visible}
                tabIndex={visible ? 0 : -1}
                title={item.prompt}
                onClick={() => onPick(item.prompt)}
              >
                <span className="vos-assistant__chip-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="vos-assistant__chip-text">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type VosAssistantWidgetProps = {
  baseUrl: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideFab?: boolean
}

export function VosAssistantWidget({
  baseUrl,
  open: openProp,
  onOpenChange,
  hideFab = false,
}: VosAssistantWidgetProps) {
  const [openInternal, setOpenInternal] = useState(false)
  const open = openProp ?? openInternal
  const setOpen = onOpenChange ?? setOpenInternal
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [greetingBusy, setGreetingBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const greetingStartedRef = useRef(false)
  const keyboardOpen = useMobileChatKeyboard(open, rootRef)
  const [inputFocused, setInputFocused] = useState(false)
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [suggestionWave, setSuggestionWave] = useState(0)
  const isAnimating = messages.some((m) => m.animate)
  const conversationStarted = messages.some((m) => m.role === 'user')
  const suggestionItems = conversationStarted ? FOLLOW_UP_SUGGESTIONS : WELCOME_SUGGESTIONS
  const suppressSuggestions =
    keyboardOpen || isAnimating || greetingBusy || busy || input.trim().length > 0
  const composing = keyboardOpen || (inputFocused && input.trim().length > 0)

  const scrollToEnd = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const finishTyping = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, animate: false } : m)),
    )
  }, [])

  const loadGreeting = useCallback(async () => {
    setGreetingBusy(true)
    try {
      const { answer } = await askBusinessAssistant(baseUrl, ASSISTANT_SESSION_START, [])
      setMessages([
        { id: 'welcome', role: 'assistant', text: answer, animate: true },
      ])
    } catch {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: FALLBACK_WELCOME,
          animate: true,
        },
      ])
    } finally {
      setGreetingBusy(false)
    }
  }, [baseUrl])

  useEffect(() => {
    if (!open) {
      greetingStartedRef.current = false
      return
    }
    if (messages.length > 0 || greetingStartedRef.current) return
    greetingStartedRef.current = true
    void loadGreeting()
  }, [open, messages.length, loadGreeting])

  useEffect(() => {
    if (!open) {
      setInputFocused(false)
      setSuggestionsVisible(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || suppressSuggestions) {
      setSuggestionsVisible(false)
      return
    }
    const delay = conversationStarted ? 420 : 520
    const timer = window.setTimeout(() => {
      setSuggestionWave((w) => w + 1)
      setSuggestionsVisible(true)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [open, suppressSuggestions, conversationStarted, messages.length])

  useEffect(() => {
    if (!open) return
    scrollToEnd()
  }, [messages, open, busy, greetingBusy, scrollToEnd])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy || greetingBusy) return
      setInput('')
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: q }
      setMessages((prev) => [...prev, userMsg])
      setBusy(true)
      try {
        const history: AssistantHistoryItem[] = messages
          .filter((m) => m.id !== 'welcome' && !m.animate)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.text }))
        const { answer } = await askBusinessAssistant(baseUrl, q, history)
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: answer,
            animate: true,
          },
        ])
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text:
              e instanceof Error
                ? e.message
                : 'No pude responder. Revisá que la API esté activa.',
            animate: true,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [baseUrl, busy, greetingBusy, messages],
  )

  return (
    <div
      ref={rootRef}
      className={[
        'vos-assistant',
        open ? ' vos-assistant--open' : '',
        hideFab ? ' vos-assistant--dock-only' : '',
        keyboardOpen ? ' vos-assistant--kb' : '',
        composing ? ' vos-assistant--composing' : '',
      ]
        .filter(Boolean)
        .join('')}
    >
      {open ? (
        <button
          type="button"
          className="vos-assistant__backdrop"
          aria-label="Cerrar asistente"
          onClick={() => setOpen(false)}
        />
      ) : null}
      {open ? (
        <div className="vos-assistant__panel" role="dialog" aria-label="Asistente VOS AI">
          <header className="vos-assistant__head">
            <div className="vos-assistant__head-title">
              <div className="vos-assistant__avatar" aria-hidden>
                <RobotIcon />
              </div>
              <div>
                <strong>VOS AI</strong>
                <span>Gerente digital · datos en vivo</span>
              </div>
            </div>
            <button
              type="button"
              className="vos-assistant__close"
              aria-label="Cerrar asistente"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="vos-assistant__messages" ref={listRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`vos-assistant__row vos-assistant__row--${m.role}`}
              >
                {m.role === 'assistant' ? (
                  <div className="vos-assistant__mini-avatar" aria-hidden>
                    <RobotIcon />
                  </div>
                ) : null}
                <div
                  className={`vos-assistant__bubble vos-assistant__bubble--${m.role}`}
                >
                  {m.role === 'assistant' ? (
                    m.animate ? (
                      <TypewriterMessage
                        text={m.text}
                        onTick={scrollToEnd}
                        onDone={() => finishTyping(m.id)}
                      />
                    ) : (
                      <AssistantMessageBody text={m.text} lead />
                    )
                  ) : (
                    <p>{m.text}</p>
                  )}
                </div>
              </div>
            ))}
            {greetingBusy || busy ? (
              <div className="vos-assistant__row vos-assistant__row--assistant">
                <div className="vos-assistant__mini-avatar" aria-hidden>
                  <RobotIcon />
                </div>
                <TypingIndicator />
              </div>
            ) : null}
          </div>

          <SuggestionChips
            items={suggestionItems}
            visible={suggestionsVisible}
            wave={suggestionWave}
            strategic={conversationStarted}
            disabled={busy || greetingBusy}
            onPick={(text) => void send(text)}
          />

          <div className="vos-assistant__composer">
            <form
              className="vos-assistant__form"
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
                placeholder="Saludá, preguntá ventas, stock, compras…"
                disabled={busy || greetingBusy}
                enterKeyHint="send"
                autoComplete="off"
                aria-label="Pregunta al asistente"
              />
              <button type="submit" disabled={busy || greetingBusy || !input.trim()}>
                Enviar
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {!hideFab ? (
        <button
          type="button"
          className="vos-assistant__fab"
          aria-label={open ? 'Cerrar asistente' : 'Abrir asistente VOS AI'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="vos-assistant__fab-inner">
            <RobotIcon />
          </span>
        </button>
      ) : null}
    </div>
  )
}
