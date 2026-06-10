import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { askBusinessAssistant, type AssistantHistoryItem } from '../api'
import { useMobileChatKeyboard } from '../hooks/useMobileChatKeyboard'
import './VosAssistantWidget.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTION_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'Ventas',
    items: [
      '¿Cómo va el negocio hoy?',
      '¿Cómo vamos esta semana?',
      '¿Cuál fue la utilidad del mes?',
    ],
  },
  {
    label: 'Operación',
    items: [
      '¿Qué debo comprar?',
      '¿Cómo está el inventario?',
      '¿Hay pedidos en la tienda?',
    ],
  },
  {
    label: 'Estrategia',
    items: [
      '¿Qué producto deja más dinero?',
      '¿Qué clientes no han regresado?',
      '¿Cuánto llevamos en compras y nómina?',
    ],
  },
]

const WELCOME =
  'Hola, soy VOS AI — tu gerente digital.\n\nPuedo contarte ventas en vivo, inventario, compras, personal, pedidos web y qué clientes no han vuelto. Elegí una sugerencia o escribí en tus palabras.'

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

function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function AssistantMessageBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let bulletBuffer: string[] = []

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
    const isSection = /^[📊🛒💰🏆👥📦🧾👨‍🍳🛍️📈🤖]/.test(trimmed)
    nodes.push(
      <p
        key={`p-${i}`}
        className={isSection ? 'vos-assistant__section-title' : undefined}
      >
        {formatInline(trimmed)}
      </p>,
    )
  })
  flushBullets('end')

  return <>{nodes}</>
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME },
  ])
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

  useEffect(() => {
    if (!open) setInputFocused(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    scrollToEnd()
  }, [messages, open, busy, scrollToEnd])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      setInput('')
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: q }
      setMessages((prev) => [...prev, userMsg])
      setBusy(true)
      try {
        const history: AssistantHistoryItem[] = messages
          .filter((m) => m.id !== 'welcome')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.text }))
        const { answer } = await askBusinessAssistant(baseUrl, q, history)
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: answer },
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
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [baseUrl, busy, messages],
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
                    <AssistantMessageBody text={m.text} />
                  ) : (
                    <p>{m.text}</p>
                  )}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="vos-assistant__row vos-assistant__row--assistant">
                <div className="vos-assistant__mini-avatar" aria-hidden>
                  <RobotIcon />
                </div>
                <div className="vos-assistant__bubble vos-assistant__bubble--assistant vos-assistant__typing">
                  <span className="vos-assistant__dot" />
                  <span className="vos-assistant__dot" />
                  <span className="vos-assistant__dot" />
                </div>
              </div>
            ) : null}
          </div>

          {!hideSuggestions ? (
            <div className="vos-assistant__suggestions">
              {SUGGESTION_GROUPS.map((group) => (
                <div key={group.label} className="vos-assistant__suggestion-group">
                  <span className="vos-assistant__suggestion-label">{group.label}</span>
                  <div className="vos-assistant__suggestion-chips">
                    {group.items.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="vos-assistant__chip"
                        disabled={busy}
                        onClick={() => void send(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

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
                placeholder="Preguntá sobre ventas, stock, compras…"
                disabled={busy}
                enterKeyHint="send"
                autoComplete="off"
                aria-label="Pregunta al asistente"
              />
              <button type="submit" disabled={busy || !input.trim()}>
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
