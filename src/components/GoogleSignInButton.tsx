import { useEffect, useRef } from 'react'

type Props = {
  label?: string
  onCredential: (idToken: string) => void
  disabled?: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (res: { credential?: string }) => void
          }) => void
          renderButton: (
            el: HTMLElement,
            opts: Record<string, string | number | boolean>,
          ) => void
        }
      }
    }
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client'

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar Google Sign-In'))
    document.head.appendChild(s)
  })
}

export function GoogleSignInButton({
  label = 'Continuar con Google',
  onCredential,
  disabled,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()

  useEffect(() => {
    if (!clientId || !hostRef.current || disabled) return
    let cancelled = false

    loadGsiScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return
        hostRef.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            if (res.credential) onCredential(res.credential)
          },
        })
        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        })
      })
      .catch(() => {
        /* fallback button below */
      })

    return () => {
      cancelled = true
    }
  }, [clientId, disabled, onCredential])

  if (!clientId) {
    return (
      <button type="button" className="public-auth__google-fallback" disabled>
        {label} (configurar VITE_GOOGLE_CLIENT_ID)
      </button>
    )
  }

  return (
    <div className="public-auth__google">
      <div ref={hostRef} className="public-auth__google-host" aria-label={label} />
    </div>
  )
}
