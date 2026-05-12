import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../ipc'
import { useActiveProject } from './useProject'
import type { TaskDetail } from '../bindings'

export interface TaskSummary {
  id: string
  title: string
  status: string
  priority: number
}

export interface LineageResult {
  /** Direct dependencies with status === 'closed' — these are what unblocked this task */
  unblockedBy: TaskSummary[]
  /** All direct dependents of this task — tasks this one will unblock */
  unblocks: TaskSummary[]
  isLoading: boolean
}

/**
 * Fetches dependency lineage for a single ready-task row.
 *
 * - Only fires when `options.enabled` is true (tied to IntersectionObserver).
 * - Returns `unblockedBy` = closed direct dependencies,
 *   `unblocks` = all direct dependents (fetched for title/status).
 * - Sets staleTime: 60_000 so repeated scrolling doesn't re-fetch within a session.
 *
 * NOTE: TaskDetail.dependencies and .dependents are string[] (IDs only).
 * We fetch TaskDetail for each dep/dependent ID to resolve title and status.
 * TanStack Query deduplicates concurrent fetches and caches results.
 */
export function useLineageForTask(
  taskId: string,
  options: { enabled: boolean }
): LineageResult {
  const project = useActiveProject()
  const enabled = options.enabled && !!project && !!taskId

  // Step 1: fetch this task's detail to get its dependency/dependent ID lists
  const { data: taskDetail, isLoading: loadingDetail } = useQuery<TaskDetail>({
    queryKey: ['task', project, taskId],
    queryFn: () => unwrap(commands.getTask(project!, taskId)),
    enabled,
    staleTime: 60_000,
  })

  const dependencyIds = taskDetail?.dependencies ?? []
  const dependentIds = taskDetail?.dependents ?? []

  // Step 2: fetch TaskDetail for each dependency to resolve title + status
  const { data: depDetails = [], isLoading: loadingDeps } = useQuery<TaskDetail[]>({
    queryKey: ['lineage-deps', project, taskId, dependencyIds.join(',')],
    queryFn: async () => {
      if (!dependencyIds.length) return []
      const results = await Promise.all(
        dependencyIds.map(id =>
          unwrap(commands.getTask(project!, id)).catch(() => null)
        )
      )
      return results.filter((r): r is TaskDetail => r !== null)
    },
    enabled: enabled && dependencyIds.length > 0,
    staleTime: 60_000,
  })

  // Step 3: fetch TaskDetail for each dependent to resolve title + status
  const { data: dependentDetails = [], isLoading: loadingDependents } = useQuery<TaskDetail[]>({
    queryKey: ['lineage-dependents', project, taskId, dependentIds.join(',')],
    queryFn: async () => {
      if (!dependentIds.length) return []
      const results = await Promise.all(
        dependentIds.map(id =>
          unwrap(commands.getTask(project!, id)).catch(() => null)
        )
      )
      return results.filter((r): r is TaskDetail => r !== null)
    },
    enabled: enabled && dependentIds.length > 0,
    staleTime: 60_000,
  })

  // Filter: unblockedBy = closed dependencies only
  const unblockedBy: TaskSummary[] = depDetails
    .filter(d => d.status === 'closed')
    .map(d => ({ id: d.id, title: d.title, status: d.status, priority: d.priority }))

  // unblocks = all dependents (regardless of status)
  const unblocks: TaskSummary[] = dependentDetails
    .map(d => ({ id: d.id, title: d.title, status: d.status, priority: d.priority }))

  const isLoading = loadingDetail || loadingDeps || loadingDependents

  return { unblockedBy, unblocks, isLoading }
}
