import type { QueryClient } from '@tanstack/react-query'

const ISSUE_QUERY_FAMILIES = new Set([
  'tasks', 'task', 'task-history', 'doltHistory', 'search', 'breadcrumb-titles',
  'lineage-deps', 'lineage-dependents', 'dep-graph', 'epicSnapshot', 'epicChildren',
  'openspec-beads-progress', 'openspec-dependencies', 'openspec-progress', 'openspec-changes', 'openspec-artifact', 'openspec-doc',
  'worker-findings', 'activity-feed', 'gitnexus-process-issues',
])

/** Reconcile every projection of issue state without refreshing another workspace. */
export function invalidateProjectData(client: QueryClient, project: string) {
  return client.invalidateQueries({
    predicate: query => query.queryKey[1] === project && ISSUE_QUERY_FAMILIES.has(String(query.queryKey[0])),
  })
}
