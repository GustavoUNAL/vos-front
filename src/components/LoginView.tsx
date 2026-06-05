import { useState, type FormEvent } from 'react'
import { login, type AuthUser } from '../api'
import { BrandMark } from './BrandMark'
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="login-shell min-h-screen flex items-center justify-center p-6">
      <form
        className="vos-card"
        onSubmit={handleSubmit}
        aria-labelledby="login-title"
      >
        <header className="flex flex-col items-center gap-3 pb-1">
          <BrandMark size="lg" showTagline />
        </header>

        <p className="m-0 text-center text-sm text-[color-mix(in_srgb,var(--muted)_90%,var(--heading))]">
          Iniciá sesión para continuar.
        </p>

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
            placeholder="tu@email.com"
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
            placeholder="••••••••"
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
      </form>
    </div>
  )
}
