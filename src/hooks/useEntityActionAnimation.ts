import { useCallback, useRef, useState } from 'react'

export const ENTITY_ACTION_EXIT_MS = 320
export const ENTITY_ACTION_SAVED_MS = 680

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function useEntityActionAnimation() {
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set())
  const [panelAnim, setPanelAnim] = useState<'idle' | 'exit' | 'saved'>('idle')
  const savedTimersRef = useRef<Map<string, number>>(new Map())

  const rowClass = useCallback(
    (id: string, ...extra: Array<string | false | null | undefined>) => {
      const parts = extra.filter(Boolean) as string[]
      parts.push('entity-action-row')
      if (exitingIds.has(id)) parts.push('entity-action-row--exit')
      if (savedIds.has(id)) parts.push('entity-action-row--saved')
      return parts.join(' ')
    },
    [exitingIds, savedIds],
  )

  const panelClass = useCallback(
    (...extra: Array<string | false | null | undefined>) => {
      const parts = extra.filter(Boolean) as string[]
      if (panelAnim === 'exit') parts.push('entity-action-panel--exit')
      if (panelAnim === 'saved') parts.push('entity-action-panel--saved')
      return parts.join(' ')
    },
    [panelAnim],
  )

  const runRemove = useCallback(async (id: string, fn: () => Promise<void>) => {
    setExitingIds((prev) => new Set(prev).add(id))
    await waitMs(ENTITY_ACTION_EXIT_MS)
    try {
      await fn()
    } finally {
      setExitingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const runPanelRemove = useCallback(async (fn: () => Promise<void>) => {
    setPanelAnim('exit')
    await waitMs(ENTITY_ACTION_EXIT_MS)
    try {
      await fn()
    } finally {
      setPanelAnim('idle')
    }
  }, [])

  const flashSaved = useCallback((id?: string | null) => {
    if (id) {
      setSavedIds((prev) => new Set(prev).add(id))
      const prevTimer = savedTimersRef.current.get(id)
      if (prevTimer) window.clearTimeout(prevTimer)
      const timer = window.setTimeout(() => {
        setSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        savedTimersRef.current.delete(id)
      }, ENTITY_ACTION_SAVED_MS)
      savedTimersRef.current.set(id, timer)
    }
    setPanelAnim('saved')
    window.setTimeout(() => setPanelAnim('idle'), ENTITY_ACTION_SAVED_MS)
  }, [])

  return {
    rowClass,
    panelClass,
    runRemove,
    runPanelRemove,
    flashSaved,
    panelAnim,
  }
}
