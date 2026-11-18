import { useEffect, useRef } from 'react'
import { getApiBase, loginWithGoogleIdToken } from '../api'

const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
  '9205255049-3gtmvp6m0k9hr8repro9gd0d9ad23qsi.apps.googleusercontent.com'

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    context?: string
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const previous = document.querySelector<HTMLScriptElement>('script[data-vos-gsi]')
    if (previous) {
      previous.addEventListener('load', () => resolve(), { once: true })
      previous.addEventListener(
        'error',
        () => reject(new Error('No se pudo cargar Google')),
        { once: true },
      )
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.vosGsi = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google'))
    document.head.appendChild(script)
  })
}

type Props = {
  returnTo?: 'login' | 'health'
  label?: string
  disabled?: boolean
  onSuccess: (token: string) => void | Promise<void>
  onSignup?: (signupToken: string) => void | Promise<void>
  onError?: (message: string) => void
}

export function GoogleSignInButton({
  returnTo = 'login',
  label = 'Continuar con Google',
  disabled,
  onSuccess,
  onSignup,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const handlers = useRef({ onSuccess, onSignup, onError })
  handlers.current = { onSuccess, onSignup, onError }

  useEffect(() => {
    const host = hostRef.current
    if (!host || disabled) return
    let cancelled = false
    let lastWidth = 0

    async function finish(idToken: string) {
      const { onSuccess: succeed, onSignup: signup, onError: fail } = handlers.current
      try {
        const result = await loginWithGoogleIdToken(getApiBase(), idToken)
        if (result.kind === 'signup') {
          await signup?.(result.signupToken)
          if (!signup) {
            fail?.('Su cuenta de Google es nueva. Complete el registro para continuar.')
          }
          return
        }
        await succeed(result.accessToken)
      } catch (error) {
        fail?.(error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.')
      }
    }

    function paint() {
      const google = window.google?.accounts.id
      if (!google || !host || cancelled) return
      const width = Math.min(400, Math.max(240, Math.floor(host.clientWidth || 320)))
      if (Math.abs(width - lastWidth) < 8 && host.childElementCount > 0) return
      lastWidth = width
      const dark = document.documentElement.dataset.theme === 'dark'
      host.replaceChildren()
      google.renderButton(host, {
        type: 'standard',
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width,
        logo_alignment: 'center',
      })
    }

    void loadGoogleIdentity()
      .then(() => {
        if (cancelled || !window.google?.accounts.id) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) void finish(response.credential)
            else handlers.current.onError?.('No se pudo iniciar sesión con Google.')
          },
          context: returnTo === 'health' ? 'use' : 'signin',
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        paint()
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          handlers.current.onError?.(
            error instanceof Error ? error.message : 'No se pudo cargar Google',
          )
        }
      })

    const observer = new ResizeObserver(() => {
      if (cancelled || lastWidth === 0) return
      paint()
    })
    observer.observe(host)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [disabled, returnTo])

  return (
    <div
      ref={hostRef}
      className={`public-auth__google-host${disabled ? ' is-disabled' : ''}`}
      aria-label={label}
    />
  )
}
