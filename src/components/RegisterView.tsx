import { useEffect, useState } from 'react'
import { fetchMe, setAccessToken, type AuthUser } from '../api'
import { BRAND_NAME } from '../lib/brand'
import { getLoginUrl, navigateToGoogleSignup, storeGoogleSignupToken } from '../lib/authRoutes'
import { AuthNotice, AuthShell } from './AuthShell'
import { GoogleSignInButton } from './GoogleSignInButton'

type Props = {
  baseUrl: string
  onCreated: (user: AuthUser) => void
}

export function RegisterView({ baseUrl, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = `Crear cuenta · ${BRAND_NAME}`
  }, [])

  async function handleGoogleSuccess(token: string) {
    setError(null)
    setSubmitting(true)
    try {
      setAccessToken(token)
      const user = await fetchMe(baseUrl)
      onCreated(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      navAction={
        <a className="va-btn va-btn--solid" href={getLoginUrl()}>
          Iniciar sesión
        </a>
      }
    >
          <div className="public-auth__form va-card">
            <header className="public-auth__head">
              <h1 className="public-auth__title">Crear su cuenta</h1>
              <p className="public-auth__subtitle">
                Use Google para abrir el espacio de su empresa. Si ya tiene acceso, inicie sesión.
              </p>
            </header>

            <GoogleSignInButton
              returnTo="login"
              disabled={submitting}
              onSuccess={handleGoogleSuccess}
              onSignup={(signupToken) => {
                storeGoogleSignupToken(signupToken)
                navigateToGoogleSignup(true)
              }}
              onError={(msg) => setError(msg)}
            />
            {error ? <AuthNotice>{error}</AuthNotice> : null}
            <p className="public-auth__legal-note">
              La primera vez pedimos el nombre de la empresa y la autorización de los datos.
            </p>
            <p className="public-auth__footer-link">
              ¿Ya tiene acceso? <a href={getLoginUrl()}>Iniciar sesión</a>
            </p>
          </div>
    </AuthShell>
  )
}
