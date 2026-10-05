import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { invalidateProjectData } from './projectInvalidation'

describe('project reconciliation', () => {
  it('refreshes issue-derived caches and preserves another project and unrelated state', async () => {
    const client = new QueryClient()
    const families = ['tasks', 'task', 'task-history', 'doltHistory', 'lineage-deps', 'lineage-dependents', 'dep-graph', 'epicSnapshot', 'epicChildren', 'openspec-beads-progress', 'openspec-dependencies', 'openspec-progress', 'openspec-changes', 'openspec-artifact', 'worker-findings', 'activity-feed', 'gitnexus-process-issues', 'search', 'breadcrumb-titles']
    for (const family of families) {
      client.setQueryData([family, '/one', 'issue'], 'cached')
      client.setQueryData([family, '/two', 'issue'], 'cached')
    }
    client.setQueryData(['ruflo-memory'], 'cached')
    await invalidateProjectData(client, '/one')
    for (const family of families) {
      expect(client.getQueryState([family, '/one', 'issue'])?.isInvalidated, family).toBe(true)
      expect(client.getQueryState([family, '/two', 'issue'])?.isInvalidated, family).toBe(false)
    }
    expect(client.getQueryState(['ruflo-memory'])?.isInvalidated).toBe(false)
  })
})
