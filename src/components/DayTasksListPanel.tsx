import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import {
  createTask,
  deleteTask,
  fetchTasksByDate,
  updateTask,
  type AuthUser,
  type CompanyTask,
  type TasksDayResponse,
} from '../api'
import { canManageTasks } from '../lib/permissions'

type Props = {
  baseUrl: string
  date: string
  user: AuthUser | null
  refreshKey?: number
  onMutate?: () => void
}

export function DayTasksListPanel({
  baseUrl,
  date,
  user,
  refreshKey = 0,
  onMutate,
}: Props) {
  const [data, setData] = useState<TasksDayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canCreate = canManageTasks(user, 'create')
  const canUpdate = canManageTasks(user, 'update')
  const canDelete = canManageTasks(user, 'delete')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTasksByDate(baseUrl, date)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar tareas')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, date])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const summary = data?.summary ?? { total: 0, completed: 0, pending: 0 }
  const tasks = data?.tasks ?? []
  const progress =
    summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

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
      onMutate?.()
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
      const created = await createTask(baseUrl, { taskDate: date, title })
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
              taskDate: date,
              tasks: [created],
              summary: { total: 1, completed: 0, pending: 1 },
            },
      )
      onMutate?.()
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
      onMutate?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="day-tasks-panel" aria-labelledby="day-tasks-panel-title">
      <header className="day-tasks-panel__head">
        <p id="day-tasks-panel-title" className="day-tasks-panel__hint muted small">
          {loading && tasks.length === 0
            ? 'Cargando…'
            : `${summary.total} tarea${summary.total !== 1 ? 's' : ''} del equipo`}
        </p>
      </header>

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

      {loading && tasks.length === 0 ? (
        <p className="muted">Cargando tareas…</p>
      ) : tasks.length === 0 ? (
        <p className="tasks-view__empty muted" role="status">
          Sin tareas para este día.
          {canCreate ? ' Agregá la primera abajo.' : ''}
        </p>
      ) : (
        <ul className="tasks-view__list day-tasks-panel__list">
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
                {task.createdByName || task.assignedToName ? (
                  <span className="muted small tasks-view__meta">
                    {[task.assignedToName, task.createdByName && !task.assignedToName ? `por ${task.createdByName}` : null]
                      .filter(Boolean)
                      .join(' · ')}
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
          className="tasks-view__composer day-tasks-panel__composer"
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <input
            type="text"
            className="tasks-view__input"
            placeholder="Nueva tarea para el equipo…"
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
    </section>
  )
}
