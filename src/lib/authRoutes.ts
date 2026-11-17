/** Rutas públicas de la app operativa (no tienda). */
import {
  PLATFORM_MODE,
  SALES_FLOOR_DEFAULT_VIEW,
  SALES_FLOOR_ONLY,
} from '../appScope'
import { buildCompanyViewHash, getCompanySlugFromUser } from './companyRoutes'
import { userNeedsBusinessSetup } from './businessSetup'
import type { AuthUser } from '../api'

export const LANDING_HASH = '#/'
export const LOGIN_HASH = '#/login'
export const HEALTH_LOGIN_HASH = '#/health/login'
export const ACCESS_REQUEST_HASH = '#/solicitar-acceso'
export const REGISTER_HASH = '#/registro'
export const PRIVACY_HASH = '#/privacidad'
export const TERMS_HASH = '#/terminos'
export const PLATFORM_HASH = '#/platform'
export const SELECT_COMPANY_HASH = '#/elegir-empresa'
export const BUSINESS_SETUP_HASH = '#/configurar-negocio'
export const GOOGLE_POPUP_HASH = '#/auth/google/popup'
export const GOOGLE_SIGNUP_HASH = '#/registro-google'
export const GOOGLE_AUTH_MESSAGE = 'vos-google-auth'
export const GOOGLE_AUTH_STORAGE_KEY = 'vos_google_auth_result'
export const GOOGLE_SIGNUP_STORAGE_KEY = 'vos_google_signup_token'

export function getPublicHashPath(): string {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const pathOnly = raw.split('?')[0] ?? ''
  return pathOnly.split('/').filter(Boolean)[0] ?? ''
}

export function isLandingHash(): boolean {
  const first = getPublicHashPath()
  return first === '' || first === 'landing'
}

export function isLoginHash(): boolean {
  return getPublicHashPath() === 'login'
}

export function isHealthLoginHash(): boolean {
  const raw = (window.location.hash ?? '').replace(/^#/, '').split('?')[0] ?? ''
  const parts = raw.split('/').filter(Boolean)
  return parts[0] === 'health' && (parts[1] === 'login' || parts.length === 1)
}

export function isAccessRequestHash(): boolean {
  return getPublicHashPath() === 'solicitar-acceso'
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

export function isSelectCompanyHash(): boolean {
  return getPublicHashPath() === 'elegir-empresa'
}

export function isBusinessSetupHash(): boolean {
  return getPublicHashPath() === 'configurar-negocio'
}

export function isGooglePopupHash(): boolean {
  const raw = (window.location.hash ?? '').replace(/^#/, '').split('?')[0] ?? ''
  const parts = raw.split('/').filter(Boolean)
  return parts[0] === 'auth' && parts[1] === 'google'
}

export function isGoogleSignupHash(): boolean {
  return getPublicHashPath() === 'registro-google'
}

export function isRegisterHash(): boolean {
  return getPublicHashPath() === 'registro'
}

export function navigateToLanding(replace = true): void {
  setHash(LANDING_HASH, replace)
}

export function navigateToLogin(replace = true): void {
  setHash(LOGIN_HASH, replace)
}

export function navigateToHealthLogin(replace = true): void {
  setHash(HEALTH_LOGIN_HASH, replace)
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

export function navigateToSelectCompany(replace = true): void {
  setHash(SELECT_COMPANY_HASH, replace)
}

export function navigateToBusinessSetup(replace = true): void {
  setHash(BUSINESS_SETUP_HASH, replace)
}

export function navigateToGoogleSignup(replace = true): void {
  setHash(GOOGLE_SIGNUP_HASH, replace)
}

export function navigateToRegister(replace = true): void {
  setHash(REGISTER_HASH, replace)
}

export function navigateAfterLogin(user: AuthUser): void {
  if (user.isPlatformAdmin && (user.platformView || !user.companyId?.trim())) {
    navigateToPlatform(true)
    return
  }
  if (userNeedsBusinessSetup(user)) {
    navigateToBusinessSetup(true)
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
  const current = window.location.hash ?? ''
  if (replace) {
    window.history.replaceState({}, '', target)
    if (current !== target) {
      window.dispatchEvent(new Event('hashchange'))
    }
  } else if (current !== target) {
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

export function getHealthLoginUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${HEALTH_LOGIN_HASH}`
}

export function getAccessRequestUrl(
  appBase?: string,
  plan?: 'free' | 'pro' | 'empresa',
): string {
  const base = `${appBaseUrl(appBase)}${ACCESS_REQUEST_HASH}`
  if (plan === 'pro' || plan === 'empresa') return `${base}?plan=${plan}`
  return base
}

export function getRegisterUrl(appBase?: string): string {
  return `${appBaseUrl(appBase)}${REGISTER_HASH}`
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

const GOOGLE_AUTH_MESSAGES: Record<string, string> = {
  no_account:
    'No hay una cuenta VOS IA con este email de Google. Registrate o solicitá acceso.',
  inactive: 'Esta cuenta está inactiva.',
  no_company: 'Tu usuario no tiene empresas activas.',
  access_denied: 'Cancelaste el acceso con Google.',
  not_configured: 'Inicio con Google no está configurado en el servidor.',
  invalid_state: 'La sesión con Google expiró. Vuelva a intentar.',
  oauth_failed: 'No se pudo iniciar sesión con Google.',
}

export function googleAuthErrorMessage(code: string | null | undefined): string | null {
  const key = (code ?? '').trim()
  if (!key) return null
  return GOOGLE_AUTH_MESSAGES[key] ?? GOOGLE_AUTH_MESSAGES.oauth_failed
}

export function consumeGoogleAuthHash(): {
  token: string | null
  signupToken: string | null
  error: string | null
  session: boolean
} {
  if (typeof window === 'undefined') {
    return { token: null, signupToken: null, error: null, session: false }
  }
  const hash = window.location.hash ?? ''
  const q = hash.indexOf('?')
  if (q < 0) return { token: null, signupToken: null, error: null, session: false }
  const path = hash.slice(0, q) || LOGIN_HASH
  const params = new URLSearchParams(hash.slice(q + 1))
  const token = params.get('google_token')
  const signupToken = params.get('google_signup')
  const error = params.get('google_error')
  const session = params.get('google_session') === '1'
  if (!token && !signupToken && !error && !session) {
    return { token: null, signupToken: null, error: null, session: false }
  }
  window.history.replaceState({}, '', path)
  return { token, signupToken, error, session }
}

export type GoogleSignupProfile = {
  email: string
  name: string
}

export function decodeGoogleSignupToken(token: string): GoogleSignupProfile | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded =
      part.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (part.length % 4)) % 4)
    const json = atob(padded)
    const data = JSON.parse(json) as { t?: string; email?: string; name?: string }
    if (data.t !== 'gs' || !data.email?.trim() || !data.name?.trim()) return null
    return { email: data.email.trim().toLowerCase(), name: data.name.trim() }
  } catch {
    return null
  }
}

export function storeGoogleSignupToken(token: string | null): void {
  try {
    if (!token?.trim()) window.sessionStorage.removeItem(GOOGLE_SIGNUP_STORAGE_KEY)
    else window.sessionStorage.setItem(GOOGLE_SIGNUP_STORAGE_KEY, token.trim())
  } catch {
    /* ignore */
  }
}

export function readGoogleSignupToken(): string | null {
  try {
    return window.sessionStorage.getItem(GOOGLE_SIGNUP_STORAGE_KEY)
  } catch {
    return null
  }
}

export type GoogleAuthPopupResult = {
  type: typeof GOOGLE_AUTH_MESSAGE
  token: string | null
  signupToken: string | null
  error: string | null
}

export function notifyGoogleAuthOpener(result: {
  token: string | null
  signupToken?: string | null
  error: string | null
}): void {
  const payload: GoogleAuthPopupResult = {
    type: GOOGLE_AUTH_MESSAGE,
    token: result.token,
    signupToken: result.signupToken ?? null,
    error: result.error,
  }
  const origin = window.location.origin
  try {
    window.opener?.postMessage(payload, origin)
  } catch {
    /* ignore */
  }
  try {
    const ch = new BroadcastChannel(GOOGLE_AUTH_MESSAGE)
    ch.postMessage(payload)
    ch.close()
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(
      GOOGLE_AUTH_STORAGE_KEY,
      JSON.stringify({ ...payload, at: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}
