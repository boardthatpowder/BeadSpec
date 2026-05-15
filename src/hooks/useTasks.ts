import { useQuery } from '@tanstack/react-query'
import { commands, unwrap } from '../ipc'
import { useActiveProject, useWorkspaceContext } from './useProject'
import { useAppState } from '../contexts/HashStateContext'
import { applyFilters, deserializeGroupConfig } from '../lib/filterParser'
import type { GroupConfig } from '../lib/filterParser'
import type { Task } from '../bindings'

export interface TaskQueryParams {
  statusFilter?: string[] | null
  labelFilter?: string[] | null
  sortCol?: string | null
  sortDir?: string | null
}

/** Exported so tests can verify key construction without rendering. */
export function buildTaskQueryKey(projectId: string, params: TaskQueryParams) {
  return [
    'tasks',
    projectId,
    {
      statusFilter: params.statusFilter ?? null,
      labelFilter: params.labelFilter ?? null,
      sortCol: params.sortCol ?? null,
      sortDir: params.sortDir ?? null,
    },
  ] as const
}

export function useTasks() {
  const project = useActiveProject()
  const { state } = useAppState()
  const activeFilters: Record<string, string[] | string> = state.filters ?? {}
  const workspaceContext = useWorkspaceContext()

  // Extract server-side filter/sort params from hash state filters
  const statusFilter = Array.isArray(activeFilters.status) ? (activeFilters.status as string[]) : null
  const labelFilter = Array.isArray(activeFilters.label) ? (activeFilters.label as string[]) : null

  const queryParams: TaskQueryParams = {
    statusFilter,
    labelFilter,
    sortCol: null,
    sortDir: null,
  }

  const queryKey = project ? buildTaskQueryKey(project, queryParams) : ['tasks', null]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await unwrap(
        commands.listTasks(
          project!,
          null,
          queryParams.statusFilter ?? null,
          queryParams.labelFilter ?? null,
          queryParams.sortCol ?? null,
          queryParams.sortDir ?? null,
        ),
      )
      return response
    },
    enabled: !!project,
    staleTime: 30_000,
  })

  const allTasks: Task[] = data?.tasks ?? []
  const totalCount: number = data?.total_count ?? allTasks.length

  // Build workspace filter: scope is 'on' unless explicitly set to 'off' in hash
  const workspaceScope = state.workspaceScope === 'off' ? 'off' : 'on'
  const workspaceLabels = workspaceContext
    ? [workspaceContext.label_worktree, workspaceContext.label_repo]
    : []

  const filteredTasks = applyFilters(allTasks, activeFilters, {
    labels: workspaceLabels,
    enabled: workspaceScope === 'on' && workspaceLabels.length > 0,
  })

  return { allTasks, filteredTasks, isLoading, error, activeFilters, totalCount }
}

/**
 * Reads the groupBy field from hash state and returns the typed GroupConfig.
 * Gracefully degrades to null (flat list) for any unrecognized value.
 */
export function useGroupBy(): GroupConfig {
  const { state } = useAppState()
  return deserializeGroupConfig(state.groupBy)
}
