import { type ClassValue } from 'clsx'
import { cn } from '../../lib/utils'

export type MobileViewModule =
  | 'home'
  | 'products'
  | 'sales'
  | 'purchases'
  | 'tasks'
  | 'pos'

/** Clases del sistema móvil unificado (.mobile-view + modificador por módulo). */
export function mobileViewClass(
  module: MobileViewModule,
  ...extra: ClassValue[]
): string {
  return cn('mobile-view', `mobile-view--${module}`, ...extra)
}
