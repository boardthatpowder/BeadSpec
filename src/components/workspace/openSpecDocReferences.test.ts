import { describe, expect, it } from 'vitest'
import type { ChangeInfo } from '../../bindings'
import { buildOpenSpecDocReferences } from './openSpecDocReferences'

function changeInfo(overrides: Partial<ChangeInfo> = {}): ChangeInfo {
  return {
    name: 'related-doc-nav',
    slug: 'related-doc-nav',
    is_archived: false,
    has_proposal: true,
    has_design: false,
    has_tasks: true,
    last_modified: null,
    specs: ['openspec-panel', 'task-workspace'],
    ...overrides,
  }
}

describe('buildOpenSpecDocReferences', () => {
  it('lists fixed artifacts and delta specs for the same change', () => {
    const references = buildOpenSpecDocReferences(
      changeInfo(),
      'specs/openspec-panel/spec.md',
    )

    expect(references).toEqual([
      {
        label: 'proposal.md',
        artifact: 'proposal.md',
        present: true,
        current: false,
      },
      {
        label: 'design.md',
        artifact: 'design.md',
        present: false,
        current: false,
      },
      {
        label: 'tasks.md',
        artifact: 'tasks.md',
        present: true,
        current: false,
      },
      {
        label: 'spec: openspec-panel',
        artifact: 'specs/openspec-panel/spec.md',
        present: true,
        current: true,
      },
      {
        label: 'spec: task-workspace',
        artifact: 'specs/task-workspace/spec.md',
        present: true,
        current: false,
      },
    ])
  })
})
