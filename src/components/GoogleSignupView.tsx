import { useEffect, useState, type FormEvent } from 'react'
import { completeGoogleSignup, type AuthUser } from '../api'
import { BRAND_NAME } from '../lib/brand'
import {
  decodeGoogleSignupToken,
  getLoginUrl,
  navigateToRegister,
  readGoogleSignupToken,
  storeGoogleSignupToken,
} from '../lib/authRoutes'
import { AuthNotice, AuthShell } from './AuthShell'
import { PublicLegalConsent } from './PublicLegalConsent'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Props = {
  baseUrl: string
  onCreated: (user: AuthUser) => void
}

export function GoogleSignupView({ baseUrl, onCreated }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = readGoogleSignupToken()
  const profile = token ? decodeGoogleSignupToken(token) : null

  useEffect(() => {
    document.title = `Crear cuenta · ${BRAND_NAME}`
    const stored = readGoogleSignupToken()
    if (!stored || !decodeGoogleSignupToken(stored)) {
      navigateToRegister(true)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token || submitting) return
    if (!companyName.trim()) {
      setError('Ingrese el nombre de su empresa.')
      return
    }
    if (!acceptTerms || !acceptPrivacy) {
      setError('Para continuar, acepte los términos y el tratamiento de datos.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await completeGoogleSignup(baseUrl, {
        signupToken: token,
        companyName: companyName.trim(),
        acceptTerms,
        acceptPrivacy,
      })
      storeGoogleSignupToken(null)
      onCreated(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!profile) return null

  return (
    <AuthShell
      aside={
        <aside className="va-aside">
          <p className="va-kicker">Registro con Google</p>
          <h2>Su cuenta es nueva en {BRAND_NAME}.</h2>
          <p>
            Antes de abrir el espacio confirmamos la empresa y el tratamiento de sus datos.
          </p>
          <ul className="va-points">
            <li>Los datos de cada empresa quedan aparte.</li>
            <li>El tratamiento sigue la Ley 1581 de 2012.</li>
            <li>Puede pedir corrección o eliminación.</li>
          </ul>
        </aside>
      }
      navAction={
        <a className="va-btn va-btn--solid" href={getLoginUrl()}>
          Iniciar sesión
        </a>
      }
    >
          <form className="public-auth__form va-card google-signup__form" onSubmit={handleSubmit}>
            <header className="public-auth__head">
              <p className="google-signup__kicker">Registro con Google</p>
              <h1 className="public-auth__title">Crear su espacio</h1>
              <p className="public-auth__subtitle">
                Revise los acuerdos y indique el nombre de su empresa para activar el panel.
              </p>
            </header>

            <div className="google-signup__identity" aria-label="Cuenta de Google">
              <span className="google-signup__avatar" aria-hidden>
                {profile.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{profile.name}</strong>
                <span>{profile.email}</span>
              </div>
            </div>

            <Label>
              <span>Nombre de la empresa</span>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
                required
                autoFocus
                disabled={submitting}
                placeholder="Nombre de la empresa"
              />
            </Label>

            <PublicLegalConsent
              identity="google"
              acceptTerms={acceptTerms}
              acceptPrivacy={acceptPrivacy}
              disabled={submitting}
              onAcceptTerms={setAcceptTerms}
              onAcceptPrivacy={setAcceptPrivacy}
            />

            {error ? <AuthNotice tone="warn">{error}</AuthNotice> : null}

            <Button type="submit" size="lg" block disabled={submitting}>
              {submitting ? 'Creando cuenta…' : 'Crear mi cuenta'}
            </Button>

            <p className="public-auth__footer-link">
              ¿Ya tiene acceso? <a href={getLoginUrl()}>Iniciar sesión</a>
            </p>
          </form>
    </AuthShell>
  )
}
