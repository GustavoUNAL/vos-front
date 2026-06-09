/**
 * Configuración de sistema (UI) — mantener en sync con
 * vos-api/src/config/system-settings.ts
 */

import type { AuthUser } from '../api'

export type SystemSettings = {
  inaugurationDate: string | null
}

export type AiSystemDefaults = {
  defaultModel: string
  temperature: number
  maxTokens: number
  locale: string
  currency: string
  businessContextHint: string
}

export const AI_SYSTEM_DEFAULTS: AiSystemDefaults = {
  defaultModel: 'gpt-4o-mini',
  temperature: 0.35,
  maxTokens: 2048,
  locale: 'es-CO',
  currency: 'COP',
  businessContextHint:
    'Negocio gastronómico en Colombia. Montos en pesos colombianos (COP).',
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  inaugurationDate: null,
}

export const COMPANY_SYSTEM_OVERRIDES: Record<string, Partial<SystemSettings>> = {
  'seed-arandano-cafe-bar': {
    inaugurationDate: '2025-12-26',
  },
  arandano: {
    inaugurationDate: '2025-12-26',
  },
}

export function resolveCompanySystemSettings(
  companyId?: string | null,
  companySlug?: string | null,
): SystemSettings {
  const byId = companyId?.trim()
    ? COMPANY_SYSTEM_OVERRIDES[companyId.trim()]
    : undefined
  const bySlug = companySlug?.trim()
    ? COMPANY_SYSTEM_OVERRIDES[companySlug.trim()]
    : undefined
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...byId,
    ...bySlug,
  }
}

export function systemSettingsForUser(user: AuthUser | null | undefined): SystemSettings {
  if (user?.systemSettings) return user.systemSettings
  if (!user?.companyId?.trim()) return DEFAULT_SYSTEM_SETTINGS
  return resolveCompanySystemSettings(user.companyId, user.companySlug)
}

export function inaugurationDateForUser(
  user: AuthUser | null | undefined,
): string | null {
  return systemSettingsForUser(user).inaugurationDate
}
