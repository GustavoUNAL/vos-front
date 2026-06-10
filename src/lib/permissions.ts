import type { AuthUser } from '../api'

export function hasPermission(
  user: AuthUser | null | undefined,
  slug: string,
): boolean {
  if (!user) return false
  if (user.isPlatformAdmin && user.platformView) return true
  return user.permissions?.includes(slug) ?? false
}

export function canViewFinance(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'finance.view')
}

export function canDeleteSales(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'sales.delete')
}

export function canViewTasks(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'tasks.view')
}
