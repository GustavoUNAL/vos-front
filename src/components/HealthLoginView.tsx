import { useEffect, useState, type FormEvent } from 'react'
import { fetchMe, login, setAccessToken, type AuthUser } from '../api'
import { getAccessRequestUrl, getLoginUrl } from '../lib/authRoutes'
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

export function HealthLoginView({ baseUrl, onLogin, initialMessage }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Iniciar sesión · VOS IA HEALTH'
    try {
      window.sessionStorage.setItem('vos_portal', 'health')
    } catch {
      /* ignore */
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Ingrese el correo y la contraseña del consultorio.')
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
      aside={
        <aside className="va-aside">
          <p className="va-kicker">VOS Health</p>
          <h2>El consultorio, sobre la misma plataforma.</h2>
          <p>Agenda, pacientes, historia clínica y odontograma. Los datos quedan en la empresa del consultorio.</p>
          <ul className="va-points">
            <li>Agenda y ficha de pacientes.</li>
            <li>Historia clínica y odontograma.</li>
            <li>El asistente consulta esos registros.</li>
          </ul>
          <p>
            ¿No es un consultorio? <a href={getLoginUrl()}>Iniciar sesión en VOS IA</a>
          </p>
        </aside>
      }
      navAction={
        <a className="va-btn va-btn--solid" href={getLoginUrl()}>
          Plataforma
        </a>
      }
    >
          <form className="public-auth__form va-card" onSubmit={handleSubmit}>
            <header className="public-auth__head">
              <h1 className="public-auth__title">Iniciar sesión</h1>
              <p className="public-auth__subtitle">Entre con el correo del consultorio.</p>
            </header>

            {initialMessage ? <AuthNotice>{initialMessage}</AuthNotice> : null}

            <GoogleSignInButton
              returnTo="health"
              label="Continuar con Google"
              disabled={submitting}
              onSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
            />

            <p className="public-auth__or">o con su correo</p>

            <Label>
              <span>Email profesional</span>
              <Input
                type="email"
                inputMode="email"
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                disabled={submitting}
                placeholder="dra@clinic.com"
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

            {error ? <AuthNotice tone={/google/i.test(error) ? 'info' : 'warn'}>{error}</AuthNotice> : null}

            <Button type="submit" size="lg" block disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>

            <p className="public-auth__footer-link">
              ¿Aún no tiene acceso? <a href={getAccessRequestUrl()}>Solicitar acceso</a>
            </p>
          </form>
    </AuthShell>
  )
}
