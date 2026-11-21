import { useEffect, useState } from 'react'
import { refreshAccessToken, setAccessToken } from '../api'
import {
  consumeGoogleAuthHash,
  notifyGoogleAuthOpener,
} from '../lib/authRoutes'
import { BrandMark } from './BrandMark'
import '../public-shell.css'
import './vos-auth.css'

export function GoogleAuthPopupView() {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const result = consumeGoogleAuthHash()
    void (async () => {
      if (result.session) {
        const token = await refreshAccessToken()
        if (token) setAccessToken(token)
        notifyGoogleAuthOpener({
          token,
          signupToken: null,
          error: token ? null : 'oauth_failed',
        })
        return
      }
      if (result.token) setAccessToken(result.token)
      notifyGoogleAuthOpener(result)
    })()
    const closeTimer = window.setTimeout(() => {
      window.close()
      setStuck(true)
    }, 250)
    const stuckTimer = window.setTimeout(() => setStuck(true), 1200)
    return () => {
      window.clearTimeout(closeTimer)
      window.clearTimeout(stuckTimer)
    }
  }, [])

  return (
    <div className="public-shell vos-auth google-auth-popup">
      <div className="google-auth-popup__card">
        <BrandMark size="sm" />
        <p className="google-auth-popup__text">
          {stuck ? 'Ya puede cerrar esta ventana.' : 'Listo. Cerrando…'}
        </p>
      </div>
    </div>
  )
}
