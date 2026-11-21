import type { ReactNode } from 'react'
import { getLandingUrl } from '../lib/authRoutes'
import { BRAND_NAME } from '../lib/brand'
import { BrandMark } from './BrandMark'
import '../public-shell.css'
import './vos-auth.css'

type Props = {
  children: ReactNode
  aside?: ReactNode
  navAction?: ReactNode
}

export function AuthNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warn'
}) {
  return (
    <p className={tone === 'warn' ? 'va-note va-note--warn' : 'va-note'} role={tone === 'warn' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function AuthShell({ children, aside, navAction }: Props) {
  return (
    <div className="public-shell vos-auth">
      <header className="va-nav">
        <div className="va-nav__bar">
          <a className="va-nav__brand" href={getLandingUrl()} aria-label={`${BRAND_NAME} inicio`}>
            <BrandMark size="sm" />
          </a>
          <nav className="va-nav__actions" aria-label="Acceso">
            <a className="va-btn va-btn--ghost" href={getLandingUrl()}>
              Inicio
            </a>
            {navAction}
          </nav>
        </div>
      </header>
      <main className={aside ? 'va-main va-split' : 'va-main va-main--center'}>{aside}{children}</main>
    </div>
  )
}
