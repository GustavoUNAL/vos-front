import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND_NAME } from '../../lib/brand'
import './LandingSalesChat.css'

const ADVISOR_PHONE = '573207909835'
const WHATSAPP_BASE = `https://wa.me/${ADVISOR_PHONE}`

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const WELCOME =
  `Hola, soy el asistente de ${BRAND_NAME}.\n\nTe explico en segundos qué hacemos y cómo puede ayudarte tu empresa. ¿Qué te gustaría saber?`

const SUGGESTIONS = [
  '¿Qué es VOS AI?',
  '¿Cómo funciona?',
  '¿Para qué tipo de empresas?',
  '¿Cuánto cuesta?',
  'Quiero hablar con un asesor',
] as const

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function advisorWhatsAppUrl(prefill: string): string {
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(prefill)}`
}

function replyForQuestion(question: string): string {
  const n = normalize(question)

  if (/asesor|humano|persona|llamar|contacto|whatsapp|hablar con/.test(n)) {
    return [
      'Con gusto te conectamos con un asesor.',
      '',
      'Escríbenos al **320 790 9835** por WhatsApp y te ayudamos a ver si VOS AI encaja con tu empresa.',
      '',
      'También puedes usar el botón verde de abajo para abrir el chat directo.',
    ].join('\n')
  }

  if (/que es|que hace|vos ai|vosai/.test(n)) {
    return [
      `**${BRAND_NAME}** es un gerente digital para empresas.`,
      '',
      'Centraliza ventas, inventario, compras y finanzas, y responde preguntas de negocio en lenguaje natural — como si le escribieras a un socio que conoce todos tus números.',
      '',
      'No es solo un POS: es inteligencia operativa disponible 24/7.',
    ].join('\n')
  }

  if (/como funciona|funciona|pasos|empezar/.test(n)) {
    return [
      '**Así funciona:**',
      '',
      '1. Registras ventas, compras e inventario (o migramos lo que ya tienes).',
      '2. La IA analiza tu operación en tiempo real.',
      '3. Preguntas por chat o WhatsApp: “¿Cuánto vendí?”, “¿Qué debo comprar?”, “¿Cuál fue la utilidad?”.',
      '',
      'Recibes respuestas con cifras reales de tu negocio, no estimaciones genéricas.',
    ].join('\n')
  }

  if (/empresa|negocio|industria|cafeteria|bar|restaurante|tienda|ferreteria|servicio/.test(n)) {
    return [
      'Está pensado para **empresas** que venden todos los días:',
      '',
      '• Cafeterías y bares',
      '• Restaurantes',
      '• Tiendas y retail',
      '• Ferreterías',
      '• Negocios de servicios',
      '',
      'Si manejas stock, personal y necesitas saber si estás ganando, VOS AI es para ti.',
    ].join('\n')
  }

  if (/precio|plan|cuanto cuesta|costo|tarifa|mensual/.test(n)) {
    return [
      'Tenemos planes desde **$49.000/mes** (operación esencial) hasta **$199.000/mes** (automatizaciones avanzadas).',
      '',
      'El plan Business ($99.000/mes) incluye más IA e integración WhatsApp.',
      '',
      'Para una cotización a la medida de tu empresa, un asesor puede orientarte por WhatsApp al **320 790 9835**.',
    ].join('\n')
  }

  if (/demo|probar|solicitar|acceso|registr/.test(n)) {
    return [
      'Puedes **solicitar una demo** desde el botón principal de la página.',
      '',
      'Si prefieres que te guiemos paso a paso, escribe al **320 790 9835** y agendamos una demostración con datos de tu negocio.',
    ].join('\n')
  }

  if (/hola|buenas|hey/.test(n)) {
    return `¡Hola! ¿En qué te puedo ayudar sobre ${BRAND_NAME}? Pregúntame qué es, cómo funciona, precios o pide hablar con un asesor.`
  }

  return [
    'No estoy seguro de haber entendido eso.',
    '',
    'Puedo explicarte qué es VOS AI, cómo funciona, para qué empresas sirve o los planes.',
    '',
    'Si necesitas algo más específico, un asesor te atiende en WhatsApp: **320 790 9835**.',
  ].join('\n')
}

function MessageBody({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="landing-sales-chat__gap" />
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{part}</span>
              ),
            )}
          </p>
        )
      })}
    </>
  )
}

export function LandingSalesChat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', text: WELCOME },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, busy])

  const send = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: q }])
    setBusy(true)
    await new Promise((r) => setTimeout(r, 380))
    const answer = replyForQuestion(q)
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: answer }])
    setBusy(false)
  }, [busy])

  const whatsappUrl = advisorWhatsAppUrl(
    'Hola, vengo de la web de VOS AI y me gustaría hablar con un asesor.',
  )

  return (
    <div className={`landing-sales-chat${open ? ' landing-sales-chat--open' : ''}`}>
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
            <div>
              <strong>¿Tienes dudas?</strong>
              <span>Te explicamos o te conectamos con un asesor</span>
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
                className={`landing-sales-chat__bubble landing-sales-chat__bubble--${m.role}`}
              >
                {m.role === 'assistant' ? <MessageBody text={m.text} /> : <p>{m.text}</p>}
              </div>
            ))}
            {busy ? (
              <div className="landing-sales-chat__bubble landing-sales-chat__bubble--assistant landing-sales-chat__typing">
                <span /><span /><span />
              </div>
            ) : null}
          </div>

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

          <form
            className="landing-sales-chat__form"
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
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Enviar
            </button>
          </form>

          <a
            className="landing-sales-chat__wa"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Hablar con asesor · 320 790 9835
          </a>
        </div>
      ) : null}

      <button
        type="button"
        className="landing-sales-chat__fab"
        aria-label={open ? 'Cerrar chat de ayuda' : 'Abrir chat: ¿Qué es VOS AI?'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="landing-sales-chat__fab-icon" aria-hidden>?</span>
        <span className="landing-sales-chat__fab-label">¿Dudas?</span>
      </button>
    </div>
  )
}
