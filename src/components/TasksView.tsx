import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  createTask,
  deleteTask,
  fetchTasksByDate,
  updateTask,
  type CompanyTask,
  type TasksDayResponse,
} from '../api'
import { hasPermission } from '../lib/permissions'
import type { AuthUser } from '../api'
import { mobileViewClass } from './mobile/mobileView'
import { ViewBootSplash } from './DataLoadingSplash'

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0)
  return localDateKey(dt)
}

function formatDayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  const label = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type Props = {
  baseUrl: string
  user: AuthUser | null
}

export function TasksView({ baseUrl, user }: Props) {
  const todayKey = useMemo(() => localDateKey(), [])
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [data, setData] = useState<TasksDayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canCreate = hasPermission(user, 'tasks.create')
  const canUpdate = hasPermission(user, 'tasks.update')
  const canDelete = hasPermission(user, 'tasks.delete')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTasksByDate(baseUrl, selectedDate)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tareas')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, selectedDate])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (task: CompanyTask) => {
    if (!canUpdate) return
    setBusyId(task.id)
    try {
      const updated = await updateTask(baseUrl, task.id, {
        completed: !task.completed,
      })
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === task.id ? updated : t)),
              summary: {
                ...prev.summary,
                completed: prev.summary.completed + (updated.completed ? 1 : -1),
                pending: prev.summary.pending + (updated.completed ? -1 : 1),
              },
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async () => {
    const title = newTitle.trim()
    if (!title || !canCreate) return
    setCreating(true)
    setError(null)
    try {
      const created = await createTask(baseUrl, {
        taskDate: selectedDate,
        title,
      })
      setNewTitle('')
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: [...prev.tasks, created],
              summary: {
                total: prev.summary.total + 1,
                completed: prev.summary.completed,
                pending: prev.summary.pending + 1,
              },
            }
          : {
              taskDate: selectedDate,
              tasks: [created],
              summary: { total: 1, completed: 0, pending: 1 },
            },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la tarea')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (task: CompanyTask) => {
    if (!canDelete) return
    if (!window.confirm(`¿Eliminar "${task.title}"?`)) return
    setBusyId(task.id)
    try {
      await deleteTask(baseUrl, task.id)
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.filter((t) => t.id !== task.id),
              summary: {
                total: prev.summary.total - 1,
                completed: prev.summary.completed - (task.completed ? 1 : 0),
                pending: prev.summary.pending - (task.completed ? 0 : 1),
              },
            }
          : prev,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  const tasks = data?.tasks ?? []
  const summary = data?.summary ?? { total: 0, completed: 0, pending: 0 }
  const progress =
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

  return (
    <div className={mobileViewClass('tasks', 'tasks-view page-pane')}>
      <header className="tasks-view__head">
        <div>
          <h1 className="page-title">Tareas del día</h1>
          <p className="muted small tasks-view__lead">
            Actividades compartidas del equipo por fecha
          </p>
        </div>
        <div className="tasks-view__date-nav" role="group" aria-label="Día">
          <button
            type="button"
            className="btn-secondary btn-compact tasks-view__nav-btn"
            aria-label="Día anterior"
            onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
          >
            <ChevronLeft aria-hidden strokeWidth={2} />
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact tasks-view__today"
            onClick={() => setSelectedDate(todayKey)}
          >
            Hoy
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact tasks-view__nav-btn"
            aria-label="Día siguiente"
            onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
          >
            <ChevronRight aria-hidden strokeWidth={2} />
          </button>
        </div>
      </header>

      <p className="tasks-view__date-title">{formatDayTitle(selectedDate)}</p>

      <div className="tasks-view__progress" aria-label="Progreso del día">
        <div className="tasks-view__progress-bar">
          <span
            className="tasks-view__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="muted small tasks-view__progress-label">
          {summary.completed} de {summary.total} completadas
          {summary.pending > 0 ? ` · ${summary.pending} pendientes` : ''}
        </p>
      </div>

      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="muted">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        <p className="tasks-view__empty muted" role="status">
          Sin tareas para este día.
          {canCreate ? ' Agregá la primera abajo.' : ''}
        </p>
      ) : (
        <ul className="tasks-view__list">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`tasks-view__item${task.completed ? ' tasks-view__item--done' : ''}`}
            >
              <button
                type="button"
                className="tasks-view__check"
                disabled={!canUpdate || busyId === task.id}
                aria-label={
                  task.completed ? 'Marcar pendiente' : 'Marcar completada'
                }
                onClick={() => void handleToggle(task)}
              >
                {task.completed ? (
                  <Check aria-hidden strokeWidth={2.5} />
                ) : (
                  <span className="tasks-view__check-ring" aria-hidden />
                )}
              </button>
              <div className="tasks-view__body">
                <span className="tasks-view__title">{task.title}</span>
                {task.assignedToName ? (
                  <span className="muted small tasks-view__meta">
                    {task.assignedToName}
                  </span>
                ) : null}
              </div>
              {canDelete ? (
                <button
                  type="button"
                  className="tasks-view__delete btn-secondary btn-compact"
                  disabled={busyId === task.id}
                  aria-label={`Eliminar ${task.title}`}
                  onClick={() => void handleDelete(task)}
                >
                  <Trash2 aria-hidden strokeWidth={2} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <form
          className="tasks-view__composer"
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <input
            type="text"
            className="tasks-view__input"
            placeholder="Nueva tarea para este día…"
            value={newTitle}
            maxLength={500}
            disabled={creating}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary btn-compact tasks-view__add"
            disabled={creating || !newTitle.trim()}
          >
            <Plus aria-hidden strokeWidth={2} />
            Agregar
          </button>
        </form>
      ) : null}

      <ViewBootSplash ready={!loading} label="Cargando tareas…" />
    </div>
  )
}
