import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { submitAccessRequest } from '../api'
import { BRAND_NAME } from '../lib/brand'
import { getLoginUrl, getRegisterUrl } from '../lib/authRoutes'
import { AuthNotice, AuthShell } from './AuthShell'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Props = {
  baseUrl: string
}

type PlanInterest = 'TRIAL' | 'PRO' | 'BUSINESS'

function planFromHash(): PlanInterest {
  const hash = typeof window === 'undefined' ? '' : window.location.hash
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const plan = new URLSearchParams(q).get('plan')
  if (plan === 'pro') return 'PRO'
  if (plan === 'empresa') return 'BUSINESS'
  return 'TRIAL'
}

export function AccessRequestView({ baseUrl }: Props) {
  const plan = useMemo(() => planFromHash(), [])
  const planTitle =
    plan === 'PRO' ? 'Registrarme · Plan Pro' : plan === 'BUSINESS' ? 'Registrarme · Plan Empresa' : 'Registrarme'
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState('')

  useEffect(() => {
    document.title = `${planTitle} · ${BRAND_NAME}`
  }, [planTitle])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      setError('Complete empresa, nombre y email.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await submitAccessRequest(baseUrl, {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
        plan,
      })
      setSubmittedEmail(email.trim())
      setSuccess(res.message)
      setCompanyName('')
      setContactName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  const aside = (
    <>
      <p className="va-kicker">Solicitar acceso</p>
      <h2>{plan === 'TRIAL' ? 'Abra el espacio de su empresa.' : `Plan ${plan === 'PRO' ? 'Pro' : 'Empresa'}`}</h2>
      <p>
        {plan === 'TRIAL'
          ? `Cuéntenos quién es. Activamos la empresa en ${BRAND_NAME} sobre la misma plataforma: permisos, datos y aplicaciones.`
          : 'Deje sus datos. Revisamos la solicitud y le contactamos para activar el plan.'}
      </p>
      <ul className="va-points">
        <li>Cada empresa tiene sus datos aparte.</li>
        <li>Ventas, inventario, agenda y proyectos en el mismo registro.</li>
        <li>El asistente responde con lo que ya está guardado.</li>
      </ul>
    </>
  )

  return (
    <AuthShell
      aside={<aside className="va-aside">{aside}</aside>}
      navAction={
        <a className="va-btn va-btn--solid" href={getLoginUrl()}>
          Iniciar sesión
        </a>
      }
    >
          {success ? (
            <div className="public-auth__form va-card">
              <header className="public-auth__head">
                <h1 className="public-auth__title">Solicitud enviada</h1>
              </header>
              <AuthNotice>{success}</AuthNotice>
              <p className="public-auth__subtitle">
                Le escribiremos a <strong>{submittedEmail}</strong> con el acceso.
              </p>
              <a className="va-btn va-btn--solid" href={getLoginUrl()}>
                Iniciar sesión
              </a>
            </div>
          ) : (
            <form className="public-auth__form va-card" onSubmit={handleSubmit}>
              <header className="public-auth__head">
                <h1 className="public-auth__title">{planTitle}</h1>
                <p className="public-auth__subtitle">Empresa, nombre y correo. El resto puede quedar para después.</p>
              </header>

              <Label>
                <span>Nombre de la empresa</span>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Grupo Andino"
                />
              </Label>

              <Label>
                <span>Su nombre</span>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="María García"
                />
              </Label>

              <Label>
                <span>Email de contacto</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="tu@empresa.com"
                />
              </Label>

              <Label className="public-auth__field--optional">
                <span>WhatsApp (opcional)</span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  placeholder="+57 300 000 0000"
                />
              </Label>

              <Label className="public-auth__field--optional">
                <span>Mensaje (opcional)</span>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  placeholder="Cómo quiere usar la plataforma"
                />
              </Label>

              {error ? <AuthNotice tone="warn">{error}</AuthNotice> : null}

              <Button type="submit" size="lg" block disabled={submitting}>
                {submitting ? 'Enviando…' : 'Registrarme'}
              </Button>

              <p className="public-auth__footer-link">
                {plan === 'TRIAL' ? (
                  <>
                    <a href={getRegisterUrl()}>Crear cuenta con Google</a>
                    {' · '}
                  </>
                ) : null}
                <a href={getLoginUrl()}>Ya tengo acceso</a>
              </p>
            </form>
          )}
    </AuthShell>
  )
}
