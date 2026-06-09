import { useCallback, useEffect, useRef, useState } from 'react'
import { askBusinessAssistant } from '../api'
import './VosAssistantWidget.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const SUGGESTIONS = [
  '¿Cómo va el negocio hoy?',
  '¿Qué debo comprar?',
  '¿Cuál fue la utilidad del mes?',
  '¿Qué producto deja más dinero?',
  '¿Qué clientes no han regresado?',
]

function RobotIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className="vos-assistant__robot-svg">
      <rect x="16" y="22" width="32" height="26" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26" cy="34" r="4" fill="currentColor" />
      <circle cx="38" cy="34" r="4" fill="currentColor" />
      <path
        d="M28 42h8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 12v10M22 16h20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="10" r="3" fill="currentColor" />
    </svg>
  )
}

export function VosAssistantWidget({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola, soy VOS AI. Preguntame sobre ventas, inventario, utilidad o clientes.',
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, busy])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || busy) return
      setInput('')
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'user', text: q },
      ])
      setBusy(true)
      try {
        const { answer } = await askBusinessAssistant(baseUrl, q)
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
    [baseUrl, busy],
  )

  return (
    <div className={`vos-assistant${open ? ' vos-assistant--open' : ''}`}>
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
              <RobotIcon />
              <div>
                <strong>VOS AI</strong>
                <span>Datos en vivo de tu negocio</span>
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
                className={`vos-assistant__bubble vos-assistant__bubble--${m.role}`}
              >
                {m.text.split('\n').map((line, i) => (
                  <p key={`${m.id}-${i}`}>{line || '\u00a0'}</p>
                ))}
              </div>
            ))}
            {busy ? (
              <div className="vos-assistant__bubble vos-assistant__bubble--assistant vos-assistant__typing">
                Pensando…
              </div>
            ) : null}
          </div>

          <div className="vos-assistant__suggestions">
            {SUGGESTIONS.map((s) => (
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

          <form
            className="vos-assistant__form"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu pregunta…"
              disabled={busy}
              aria-label="Pregunta al asistente"
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Enviar
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="vos-assistant__fab"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente VOS AI'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vos-assistant__fab-inner">
          <RobotIcon />
        </span>
      </button>
    </div>
  )
}
