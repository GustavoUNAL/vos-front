import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createServiceProject,
  deleteServiceProject,
  fetchServiceProjects,
  updateServiceProject,
  type ServiceProject,
  type ServiceProjectStatus,
} from '../api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { ViewBootSplash } from './DataLoadingSplash'
import { mobileViewClass } from './mobile/mobileView'
import './ProjectsHistoryView.css'

type Props = { baseUrl: string }

const STATUS_LABEL: Record<ServiceProjectStatus, string> = {
  IN_PROGRESS: 'En ejecución',
  COMPLETED: 'Cobrado',
  CANCELLED: 'Cancelado',
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

const emptyForm = {
  name: '',
  address: '',
  description: '',
  chargedAmount: '',
  status: 'IN_PROGRESS' as ServiceProjectStatus,
  notes: '',
}

export function ProjectsHistoryView({ baseUrl }: Props) {
  const [projects, setProjects] = useState<ServiceProject[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    chargedTotal: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ServiceProjectStatus>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load(status?: ServiceProjectStatus) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchServiceProjects(baseUrl, status)
      setProjects(res.projects)
      setSummary(res.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(filter === 'all' ? undefined : filter)
  }, [baseUrl, filter])

  const visible = useMemo(() => {
    if (filter === 'all') return projects
    return projects.filter((p) => p.status === filter)
  }, [projects, filter])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function startEdit(project: ServiceProject) {
    setEditingId(project.id)
    setForm({
      name: project.name,
      address: project.address,
      description: project.description,
      chargedAmount: String(project.chargedAmount),
      status: project.status,
      notes: project.notes ?? '',
    })
    setFormOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const chargedAmount = Number(String(form.chargedAmount).replace(/[^\d.]/g, ''))
    if (!form.name.trim() || !form.address.trim() || !Number.isFinite(chargedAmount)) {
      setError('Complete nombre, dirección y el valor cobrado.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      chargedAmount,
      status: form.status,
      notes: form.notes.trim() || undefined,
    }
    try {
      if (editingId) {
        await updateServiceProject(baseUrl, editingId, payload)
      } else {
        await createServiceProject(baseUrl, payload)
      }
      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await load(filter === 'all' ? undefined : filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este proyecto del historial?')) return
    try {
      await deleteServiceProject(baseUrl, id)
      await load(filter === 'all' ? undefined : filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  if (loading && projects.length === 0) {
    return <ViewBootSplash ready={false} label="Cargando historial de proyectos…" />
  }

  return (
    <div className={mobileViewClass('projects', 'page-pane projects-history')}>
      <header className="projects-history__head">
        <div>
          <h1>Proyectos</h1>
          <p className="muted">Obras y servicios de El electricista.</p>
        </div>
        <Button type="button" onClick={startCreate}>
          Nuevo proyecto
        </Button>
      </header>

      <div className="projects-history__kpis">
        <div className="projects-history__kpi">
          <strong>{summary.total}</strong>
          <span>Proyectos</span>
        </div>
        <div className="projects-history__kpi">
          <strong>{summary.inProgress}</strong>
          <span>En ejecución</span>
        </div>
        <div className="projects-history__kpi">
          <strong>{summary.completed}</strong>
          <span>Cobrados</span>
        </div>
        <div className="projects-history__kpi">
          <strong>{formatCOP(summary.chargedTotal)}</strong>
          <span>Total cobrado</span>
        </div>
      </div>

      <div className="projects-history__filters">
        {(['all', 'IN_PROGRESS', 'COMPLETED'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`projects-history__chip${filter === key ? ' is-active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'Todos' : STATUS_LABEL[key]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="vos-alert vos-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <form className="projects-history__form" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
          <Label>
            <span>Trabajo</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Instalación de ducha"
              required
            />
          </Label>
          <Label>
            <span>Dirección / sitio</span>
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Calle 12D #6-18, Barrio El Pilar"
              required
            />
          </Label>
          <Label>
            <span>Descripción</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalle del trabajo"
            />
          </Label>
          <div className="projects-history__form-row">
            <Label>
              <span>Valor cobrado (COP)</span>
              <Input
                type="number"
                min={0}
                step="1000"
                value={form.chargedAmount}
                onChange={(e) => setForm((f) => ({ ...f, chargedAmount: e.target.value }))}
                required
              />
            </Label>
            <Label>
              <span>Estado</span>
              <select
                className="projects-history__select"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as ServiceProjectStatus }))
                }
              >
                <option value="IN_PROGRESS">En ejecución</option>
                <option value="COMPLETED">Cobrado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </Label>
          </div>
          <Label>
            <span>Notas</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Label>
          <div className="projects-history__form-actions">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {visible.length === 0 ? (
        <p className="muted">No hay proyectos en este filtro.</p>
      ) : (
        <ul className="projects-history__list">
          {visible.map((project) => (
            <li key={project.id} className="projects-history__card">
              <div className="projects-history__card-top">
                <h3>{project.name}</h3>
                <span
                  className={`projects-history__badge projects-history__badge--${project.status.toLowerCase()}`}
                >
                  {STATUS_LABEL[project.status]}
                </span>
              </div>
              <p className="projects-history__address">{project.address}</p>
              {project.description ? (
                <p className="muted">{project.description}</p>
              ) : null}
              <p className="projects-history__amount">{formatCOP(project.chargedAmount)}</p>
              {project.notes ? <p className="muted">{project.notes}</p> : null}
              <div className="projects-history__card-actions">
                <button type="button" className="projects-history__link" onClick={() => startEdit(project)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="projects-history__link projects-history__link--danger"
                  onClick={() => void handleDelete(project.id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
