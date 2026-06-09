import { useEffect, useState, type FormEvent } from 'react'
import { submitAccessRequest } from '../api'
import { BRAND_NAME, BRAND_TAGLINE } from '../lib/brand'
import { getLandingUrl, getLoginUrl } from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'

type Props = {
  baseUrl: string
}

export function AccessRequestView({ baseUrl }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const { theme, toggleTheme } = usePublicTheme()

  useEffect(() => {
    document.title = `Solicitar una prueba · ${BRAND_NAME}`
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      setError('Completá empresa, nombre y email.')
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

  return (
    <div className="public-shell public-auth">
      <div className="public-shell__grid-bg" aria-hidden />
      <a className="public-btn public-btn--ghost public-auth__back" href={getLandingUrl()}>
        ← Volver
      </a>
      <PublicThemeSwitch
        theme={theme}
        onToggle={toggleTheme}
        compact
        className="public-auth__theme"
      />

      <div className="public-auth__layout">
        <aside className="public-auth__visual">
          <BrandMark size="md" showTagline />
          <div>
            <h2>Solicitar una prueba</h2>
            <p>
              Contanos sobre tu empresa. Revisamos cada solicitud y te enviamos credenciales
              personalizadas para tu tenant.
            </p>
          </div>
          <ul className="public-auth__bullets">
            <li>Sin registro automático — onboarding guiado</li>
            <li>Empresa aislada con URL propia</li>
            <li>POS, tienda y panel incluidos</li>
            <li>Soporte al activar tu cuenta</li>
          </ul>
        </aside>

        <div className="public-auth__form-wrap">
          {success ? (
            <div className="public-auth__form vos-card">
              <header className="public-auth__head">
                <h1 className="public-auth__title">¡Solicitud enviada!</h1>
              </header>
              <div className="vos-alert vos-alert--info" role="status">
                {success}
              </div>
              <p className="public-auth__subtitle">
                Te escribiremos a <strong>{submittedEmail}</strong> con usuario y contraseña.
              </p>
              <a className="public-btn public-btn--ghost" href={getLandingUrl()}>
                Volver al inicio
              </a>
            </div>
          ) : (
            <form className="public-auth__form vos-card" onSubmit={handleSubmit}>
              <header className="public-auth__head">
                <h1 className="public-auth__title">Solicitar una prueba</h1>
                <p className="public-auth__subtitle">{BRAND_TAGLINE}</p>
              </header>

              <Label>
                <span>Nombre de tu empresa</span>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Mi Restaurante SAS"
                />
              </Label>

              <Label>
                <span>Tu nombre</span>
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

              <Label>
                <span>Teléfono / WhatsApp (opcional)</span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  placeholder="+57 300 000 0000"
                />
              </Label>

              <Label>
                <span>¿Qué necesitás? (opcional)</span>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  placeholder="POS, tienda online, inventario…"
                />
              </Label>

              {error ? (
                <div className="vos-alert vos-alert--error" role="alert">
                  {error}
                </div>
              ) : null}

              <Button type="submit" size="lg" block disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar solicitud'}
              </Button>

              <p className="public-auth__footer-link">
                ¿Ya tenés cuenta? <a href={getLoginUrl()}>Iniciar sesión</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
