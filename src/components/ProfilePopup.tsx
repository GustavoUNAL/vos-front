import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'
import {
  fetchStaffMembers,
  updateStaffMember,
  type AuthUser,
  type StaffMemberRow,
} from '../api'
import { displayCompanyName, displayUserRole } from '../lib/displayLabels'
import { userNeedsCompanyPicker } from '../lib/companySelect'
import { canManageAllStaff } from '../lib/permissions'
import { greetUser } from '../lib/userIdentity'
import { CompanySwitcher } from './CompanySwitcher'
import { StaffProfileCard, staffRoleLabel } from './StaffProfileCard'
import { UserAvatar } from './UserAvatar'

type Props = {
  user: AuthUser
  baseUrl?: string
  onClose: () => void
  onLogout: () => void
  onSwitchCompany?: (user: AuthUser) => void
}

type Draft = {
  name: string
  phone: string
  email: string
  idNumber: string
  notes: string
}

function memberToDraft(m: StaffMemberRow): Draft {
  return {
    name: m.name,
    phone: m.phone ?? '',
    email: m.email ?? '',
    idNumber: m.idNumber ?? '',
    notes: m.notes ?? '',
  }
}

export function ProfilePopup({
  user,
  baseUrl,
  onClose,
  onLogout,
  onSwitchCompany,
}: Props) {
  const [member, setMember] = useState<StaffMemberRow | null>(null)
  const [loading, setLoading] = useState(Boolean(baseUrl))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    name: user.name,
    phone: '',
    email: user.email,
    idNumber: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const company = displayCompanyName(user.companyName)
  const role = displayUserRole(user.role)
  const manageAll = canManageAllStaff(user)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!baseUrl) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchStaffMembers(baseUrl, { limit: 200, active: undefined })
        if (cancelled) return
        const own =
          res.data.find((m) => m.userId && m.userId === user.sub) ||
          res.data.find(
            (m) => m.email?.trim().toLowerCase() === user.email.trim().toLowerCase(),
          ) ||
          res.data.find(
            (m) => m.name.trim().toLowerCase() === user.name.trim().toLowerCase(),
          ) ||
          (manageAll ? null : res.data[0] ?? null)
        setMember(own)
        if (own) setDraft(memberToDraft(own))
      } catch {
        if (!cancelled) setMember(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baseUrl, manageAll, user.email, user.name, user.sub])

  const save = async () => {
    if (!baseUrl || !member) return
    if (!draft.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await updateStaffMember(baseUrl, member.id, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        idNumber: draft.idNumber.trim(),
        notes: draft.notes.trim(),
      })
      setMember(next)
      setDraft(memberToDraft(next))
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const subtitle = useMemo(
    () => [role, company].filter(Boolean).join(' · '),
    [company, role],
  )

  return createPortal(
    <div
      className="profile-popup-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <section
        className="profile-popup"
        role="dialog"
        aria-modal="true"
        id="header-systray-profile"
        aria-labelledby="profile-popup-title"
      >
        <header className="profile-popup__hero">
          <UserAvatar
            name={member?.name || user.name}
            url={user.avatarUrl}
            className="profile-popup__avatar"
          />
          <div className="profile-popup__hero-copy">
            <p className="profile-popup__kicker">{greetUser(user.name)}</p>
            <h2 id="profile-popup-title" className="profile-popup__title">
              {member?.name || user.name}
            </h2>
            {subtitle ? <p className="profile-popup__sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="modal-close profile-popup__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="profile-popup__body">
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="muted">Cargando perfil…</p>
          ) : editing && member ? (
            <div className="profile-popup__form">
              <label className="field-stack">
                <span>Nombre</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Correo</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Teléfono</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Documento</span>
                <input
                  value={draft.idNumber}
                  onChange={(e) => setDraft({ ...draft, idNumber: e.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Notas</span>
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
            </div>
          ) : member ? (
            <StaffProfileCard
              member={member}
              roleLabel={staffRoleLabel(user)}
              compact
            />
          ) : (
            <p className="muted">
              Su usuario aún no está vinculado a una ficha de personal. Solicite a gerencia
              que lo registre.
            </p>
          )}

          {!editing && baseUrl && onSwitchCompany && userNeedsCompanyPicker(user) ? (
            <CompanySwitcher
              baseUrl={baseUrl}
              user={user}
              onSwitch={onSwitchCompany}
              variant="menu"
            />
          ) : null}
        </div>

        <footer className="profile-popup__foot">
          {member && !editing ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setDraft(memberToDraft(member))
                setEditing(true)
                setError(null)
              }}
            >
              Editar perfil
            </button>
          ) : null}
          {editing ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => {
                  setEditing(false)
                  setError(null)
                  if (member) setDraft(memberToDraft(member))
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button type="button" className="profile-popup__logout" onClick={onLogout}>
              <LogOut strokeWidth={2} aria-hidden />
              Salir de la cuenta
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  )
}
