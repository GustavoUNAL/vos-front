import { useEffect, useState, type FormEvent } from 'react'
import { login, type AuthUser } from '../api'
import { BRAND_LOGIN_TITLE, BRAND_TAGLINE } from '../lib/brand'
import { getAccessRequestUrl, getLandingUrl } from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import { LandingSalesChat } from './landing/LandingSalesChat'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'

type Props = {
  baseUrl: string
  onLogin: (user: AuthUser) => void
  initialMessage?: string | null
}

export function LoginView({ baseUrl, onLogin, initialMessage }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { theme, toggleTheme } = usePublicTheme()

  useEffect(() => {
    document.title = BRAND_LOGIN_TITLE
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Ingresá email y contraseña.')
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
            <h2>Panel de tu empresa</h2>
            <p>
              Acceso con las credenciales que te proporcionamos. Cada tenant tiene ruta y datos
              aislados.
            </p>
          </div>
          <ul className="public-auth__bullets">
            <li>Inventario, ventas y compras</li>
            <li>POS y pedidos web</li>
            <li>Personal y finanzas</li>
            <li>Ruta #/e/tu-empresa/…</li>
          </ul>
        </aside>

        <div className="public-auth__form-wrap">
          <form className="public-auth__form vos-card" onSubmit={handleSubmit}>
            <header className="public-auth__head">
              <h1 className="public-auth__title">Iniciar sesión</h1>
              <p className="public-auth__subtitle">{BRAND_TAGLINE}</p>
            </header>

            {initialMessage ? (
              <div className="vos-alert vos-alert--info" role="status">
                {initialMessage}
              </div>
            ) : null}

            <Label>
              <span>Email</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                disabled={submitting}
              />
            </Label>

            <Label>
              <span>Contraseña</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={submitting}
              />
            </Label>

            {error ? (
              <div className="vos-alert vos-alert--error" role="alert">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" block disabled={submitting}>
              {submitting ? 'Ingresando…' : 'Entrar'}
            </Button>

            <p className="public-auth__footer-link">
              ¿Querés probar la plataforma? <a href={getAccessRequestUrl()}>Solicitar una prueba</a>
            </p>
          </form>
        </div>
      </div>
      <LandingSalesChat />
    </div>
  )
}
