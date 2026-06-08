/** Etiquetas visibles sin sufijos de entorno demo. */
export function displayCompanyName(name: string | null | undefined): string {
  if (!name?.trim()) return ''
  return name
    .replace(/\s*\(demo\)\s*/gi, ' ')
    .replace(/\s*[-–]\s*demo\s*/gi, ' ')
    .replace(/\bdemo\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function displayUserRole(role: string | null | undefined): string {
  if (!role?.trim()) return ''
  const normalized = role.replace(/\bdemo\b/gi, '').trim()
  const slug = normalized.toLowerCase()
  if (slug === 'owner' || slug === 'propietario') return 'Propietario'
  if (slug === 'member' || slug === 'miembro') return 'Miembro'
  if (slug === 'admin') return 'Administrador'
  return normalized
}
