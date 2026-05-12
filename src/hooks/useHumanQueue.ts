import { useState, useEffect, useCallback, useRef } from 'react'
import { commands } from '../ipc'
import { unwrap } from '../ipc'
import { useActiveProject, useActiveProjectId } from './useProject'

export interface HumanQueueItem {
  id: string
  title: string
  prompt: string
}

interface UseHumanQueueResult {
  items: HumanQueueItem[]
  respond: (id: string, text: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
}

function parseHumanList(stdout: string): HumanQueueItem[] {
  try {
    const parsed = JSON.parse(stdout)
    // bd human list --json returns null (not []) when the queue is empty
    if (Array.isArray(parsed)) return parsed as HumanQueueItem[]
    return []
  } catch {
    console.warn('[useHumanQueue] JSON parse error', stdout)
    return []
  }
}

function isBdNotFound(err: unknown): boolean {
  const msg = typeof err === 'string' ? err.toLowerCase() : ''
  return msg.includes('not found') || msg.includes('no such file') ||
    msg.includes('bd cli not found') || msg.includes('project_not_connected')
}

export function useHumanQueue(): UseHumanQueueResult {
  const project = useActiveProject()
  const projectId = useActiveProjectId()
  const [items, setItems] = useState<HumanQueueItem[]>([])
  const [bdUnavailable, setBdUnavailable] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!project || !projectId) return
    if (document.visibilityState !== 'visible') return
    if (bdUnavailable) return

    try {
      const stdout = await unwrap(commands.bdHumanList(projectId))
      const parsed = parseHumanList(stdout)
      setItems(parsed)
    } catch (err) {
      if (isBdNotFound(err)) {
        setBdUnavailable(true)
      } else {
        console.warn('[useHumanQueue] poll error:', err)
      }
    }
  }, [project, projectId, bdUnavailable])

  // Initial load + interval setup
  useEffect(() => {
    if (!project) return

    poll()

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        poll()
      }
    }, 60_000)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [project]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: intentionally omit `poll` from deps to avoid resetting interval on every render;
  // poll is stable enough via project/projectId/bdUnavailable memo boundary.

  const respond = useCallback(async (id: string, text: string) => {
    // Optimistic removal
    setItems(prev => prev.filter(item => item.id !== id))
    try {
      if (projectId) {
        await unwrap(commands.bdHumanRespond(projectId, id, text))
      }
    } catch (err) {
      console.warn('[useHumanQueue] respond error:', err)
    }
  }, [projectId])

  const dismiss = useCallback(async (id: string) => {
    // Optimistic removal
    setItems(prev => prev.filter(item => item.id !== id))
    try {
      if (projectId) {
        await unwrap(commands.bdHumanDismiss(projectId, id))
      }
    } catch (err) {
      console.warn('[useHumanQueue] dismiss error:', err)
    }
  }, [projectId])

  if (bdUnavailable) {
    return { items: [], respond, dismiss }
  }

  return { items, respond, dismiss }
}
