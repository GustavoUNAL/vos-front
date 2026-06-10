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

function companyHasTasksModule(user: AuthUser | null | undefined): boolean {
  if (!user?.companyId) return false
  const company = user.companies?.find((c) => c.id === user.companyId)
  return company?.modules?.includes('tasks') ?? false
}

export function canViewTasks(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (hasPermission(user, 'tasks.view')) return true
  if (
    companyHasTasksModule(user) &&
    (user.role === 'owner' || user.role === 'manager')
  ) {
    return true
  }
  return false
}

export function canManageTasks(
  user: AuthUser | null | undefined,
  action: 'create' | 'update' | 'delete',
): boolean {
  if (hasPermission(user, `tasks.${action}`)) return true
  if (
    companyHasTasksModule(user) &&
    (user?.role === 'owner' || user?.role === 'manager')
  ) {
    return true
  }
  return false
}
