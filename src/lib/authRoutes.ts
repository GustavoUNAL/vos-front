/** Rutas públicas de la app operativa (no tienda). */
import {
  PLATFORM_MODE,
  SALES_FLOOR_DEFAULT_VIEW,
  SALES_FLOOR_ONLY,
} from '../appScope'
import { buildCompanyViewHash, getCompanySlugFromUser } from './companyRoutes'
import type { AuthUser } from '../api'

export const LANDING_HASH = '#/'
export const LOGIN_HASH = '#/login'
export const ACCESS_REQUEST_HASH = '#/solicitar-acceso'
export const PRIVACY_HASH = '#/privacidad'
export const TERMS_HASH = '#/terminos'
export const PLATFORM_HASH = '#/platform'
/** @deprecated usar ACCESS_REQUEST_HASH */
export const REGISTER_HASH = ACCESS_REQUEST_HASH

export function getPublicHashPath(): string {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  return raw.split('/').filter(Boolean)[0] ?? ''
}

export function isLandingHash(): boolean {
  const first = getPublicHashPath()
  return first === '' || first === 'landing'
}

export function isLoginHash(): boolean {
  return getPublicHashPath() === 'login'
}

export function isAccessRequestHash(): boolean {
  const p = getPublicHashPath()
  return p === 'solicitar-acceso' || p === 'registro'
}

export function isPrivacyHash(): boolean {
  return getPublicHashPath() === 'privacidad'
}

export function isTermsHash(): boolean {
  return getPublicHashPath() === 'terminos'
}

export function isLegalHash(): boolean {
  return isPrivacyHash() || isTermsHash()
}

export function isPlatformHash(): boolean {
  return getPublicHashPath() === 'platform'
}

/** @deprecated */
export function isRegisterHash(): boolean {
  return isAccessRequestHash()
}

export function navigateToLanding(replace = true): void {
  setHash(LANDING_HASH, replace)
}

export function navigateToLogin(replace = true): void {
  setHash(LOGIN_HASH, replace)
}

export function navigateToAccessRequest(replace = true): void {
  setHash(ACCESS_REQUEST_HASH, replace)
}

export function navigateToPrivacy(replace = true): void {
  setHash(PRIVACY_HASH, replace)
}

export function navigateToTerms(replace = true): void {
  setHash(TERMS_HASH, replace)
}

export function navigateToPlatform(replace = true): void {
  setHash(PLATFORM_HASH, replace)
}

export function navigateToRegister(replace = true): void {
  navigateToAccessRequest(replace)
}

export function navigateAfterLogin(user: AuthUser): void {
  if (user.isPlatformAdmin && user.platformView) {
    navigateToPlatform(true)
    return
  }
  const slug = getCompanySlugFromUser(user)
  const view = SALES_FLOOR_ONLY
    ? SALES_FLOOR_DEFAULT_VIEW
    : PLATFORM_MODE
      ? 'home'
      : 'menu'
  window.location.hash = buildCompanyViewHash(slug, view)
}

function setHash(target: string, replace: boolean): void {
  if (replace) {
    window.history.replaceState({}, '', target)
  } else {
    window.location.hash = target
  }
}

function appBaseUrl(appBase?: string): string {
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  const base =
    appBase?.trim() ||
    fromEnv ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '')
  return base.replace(/\/$/, '')
}

export function getLoginUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${LOGIN_HASH}`
}

export function getAccessRequestUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${ACCESS_REQUEST_HASH}`
}

export function getRegisterUrl(appBase?: string): string {
  return getAccessRequestUrl(appBase)
}

export function getLandingUrl(appBase?: string): string {
  const fromEnv = (import.meta.env.VITE_LANDING_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv
  return `${appBaseUrl(appBase)}${LANDING_HASH}`
}

export function getPrivacyUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${PRIVACY_HASH}`
}

export function getTermsUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${TERMS_HASH}`
}
