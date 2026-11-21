import { useEffect, useState, type FormEvent } from 'react'
import { fetchMe, login, setAccessToken, type AuthUser } from '../api'
import { getRegisterUrl, navigateToGoogleSignup, storeGoogleSignupToken } from '../lib/authRoutes'
import { BRAND_LOGIN_TITLE } from '../lib/brand'
import { readRememberedFirstName } from '../lib/userIdentity'
import { AuthNotice, AuthShell } from './AuthShell'
import { GoogleSignInButton } from './GoogleSignInButton'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

type Props = {
  baseUrl: string
  onLogin: (user: AuthUser) => void
  initialMessage?: string | null
}

export function LoginView({ baseUrl, onLogin, initialMessage }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rememberedName = readRememberedFirstName()

  useEffect(() => {
    document.title = BRAND_LOGIN_TITLE
    try {
      window.sessionStorage.removeItem('vos_portal')
    } catch {
      /* ignore */
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Ingrese el correo y la contraseña.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await login(baseUrl, { email: trimmedEmail, password })
      onLogin(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSuccess(token: string) {
    setError(null)
    setSubmitting(true)
    try {
      setAccessToken(token)
      const user = await fetchMe(baseUrl)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      navAction={
        <a className="va-btn va-btn--solid" href={getRegisterUrl()}>
          Crear cuenta
        </a>
      }
    >
          <form className="public-auth__form va-card" onSubmit={handleSubmit}>
            <header className="public-auth__head">
              <h1 className="public-auth__title">
                {rememberedName ? `Hola de nuevo, ${rememberedName}` : 'Iniciar sesión'}
              </h1>
              <p className="public-auth__subtitle">Entre a su espacio en la plataforma.</p>
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
            {initialMessage ? <AuthNotice>{initialMessage}</AuthNotice> : null}
            {error && /google/i.test(error) ? <AuthNotice>{error}</AuthNotice> : null}
            <p className="public-auth__legal-note">
              La primera vez con Google pedimos el nombre de la empresa y la autorización de los datos.
            </p>

            <p className="public-auth__or">o con su correo</p>

            <Label>
              <span>Email</span>
              <Input
                type="email"
                inputMode="email"
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                disabled={submitting}
                placeholder="tu@empresa.com"
              />
            </Label>

            <Label>
              <span>Contraseña</span>
              <div className="public-auth__password">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="public-auth__password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </Label>

            {error && !/google/i.test(error) ? (
              <AuthNotice tone="warn">
                {error}
                {error.includes('no está configurado') ||
                error.includes('API no disponible') ||
                error.includes('no responde') ? null : (
                  <>
                    {' '}
                    Si aún no tiene cuenta, <a href={getRegisterUrl()}>créela aquí</a>.
                  </>
                )}
              </AuthNotice>
            ) : null}

            <Button type="submit" size="lg" block disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>

            <p className="public-auth__footer-link">
              ¿Todavía no tiene acceso? <a href={getRegisterUrl()}>Crear cuenta</a>
            </p>
          </form>
    </AuthShell>
  )
}
