import { describe, expect, it } from 'vitest'
import type { WorkerFinding } from '../../bindings'
import { groupFindings } from './groupFindings'

function finding(overrides: Partial<WorkerFinding> & Pick<WorkerFinding, 'issue_id' | 'worker' | 'priority' | 'created_at'>): WorkerFinding {
  return {
    title: overrides.issue_id,
    status: 'open',
    notes_first_line: `Auto-filed by ruflo-${overrides.worker} worker on ${overrides.created_at}`,
    ...overrides,
  }
}

describe('groupFindings', () => {
  it('sorts worker groups by tag and rows by priority then newest first', () => {
    const groups = groupFindings([
      finding({ issue_id: 'B-3-old', worker: 'test-gap', priority: 3, created_at: '2026-05-16T10:00:00Z' }),
      finding({ issue_id: 'A-2', worker: 'security', priority: 2, created_at: '2026-05-17T09:00:00Z' }),
      finding({ issue_id: 'B-1', worker: 'test-gap', priority: 1, created_at: '2026-05-15T10:00:00Z' }),
      finding({ issue_id: 'B-3-new', worker: 'test-gap', priority: 3, created_at: '2026-05-17T10:00:00Z' }),
    ])

    expect(groups.map(group => group.worker)).toEqual(['security', 'test-gap'])
    expect(groups[1]?.findings.map(row => row.issue_id)).toEqual(['B-1', 'B-3-new', 'B-3-old'])
  })
})
