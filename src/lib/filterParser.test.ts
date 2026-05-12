import { describe, it, expect } from 'vitest'
import {
  groupTasks,
  serializeGroupConfig,
  deserializeGroupConfig,
  applyFilters,
  type GroupConfig,
} from './filterParser'
import type { Task } from '../bindings'

function makeTask(overrides: Partial<Task> & { id: string; title: string; status: string; priority: number }): Task {
  return {
    labels: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    description: null,
    ...overrides,
  } as unknown as Task
}

const OPEN_TASK = makeTask({ id: 't1', title: 'Open task', status: 'open', priority: 1 })
const CLOSED_TASK = makeTask({ id: 't2', title: 'Closed task', status: 'closed', priority: 2 })
const IN_PROGRESS_TASK = makeTask({ id: 't3', title: 'In progress', status: 'in_progress', priority: 3 })
const BLOCKED_TASK = makeTask({ id: 't4', title: 'Blocked', status: 'blocked', priority: 4 })

describe('groupTasks — null config (flat pass-through)', () => {
  it('returns a single __all__ section with all tasks', () => {
    const tasks = [OPEN_TASK, CLOSED_TASK]
    const result = groupTasks(tasks, null)
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('__all__')
    expect(result[0].label).toBe('')
    expect(result[0].tasks).toEqual(tasks)
  })

  it('returns single section for empty array', () => {
    const result = groupTasks([], null)
    expect(result).toHaveLength(1)
    expect(result[0].tasks).toHaveLength(0)
  })
})

describe('groupTasks — field: status', () => {
  it('returns exactly 4 sections in canonical order', () => {
    const tasks = [OPEN_TASK, CLOSED_TASK, IN_PROGRESS_TASK, BLOCKED_TASK]
    const result = groupTasks(tasks, { type: 'field', field: 'status' })
    expect(result.map(s => s.key)).toEqual(['open', 'in_progress', 'blocked', 'closed'])
  })

  it('includes empty sections', () => {
    const tasks = [OPEN_TASK]
    const result = groupTasks(tasks, { type: 'field', field: 'status' })
    expect(result).toHaveLength(4)
    const closed = result.find(s => s.key === 'closed')!
    expect(closed.tasks).toHaveLength(0)
  })

  it('puts each task in the correct section', () => {
    const tasks = [OPEN_TASK, CLOSED_TASK, IN_PROGRESS_TASK, BLOCKED_TASK]
    const result = groupTasks(tasks, { type: 'field', field: 'status' })
    expect(result.find(s => s.key === 'open')!.tasks).toEqual([OPEN_TASK])
    expect(result.find(s => s.key === 'closed')!.tasks).toEqual([CLOSED_TASK])
    expect(result.find(s => s.key === 'in_progress')!.tasks).toEqual([IN_PROGRESS_TASK])
    expect(result.find(s => s.key === 'blocked')!.tasks).toEqual([BLOCKED_TASK])
  })
})

describe('groupTasks — field: priority', () => {
  it('returns sections P1–P4 in ascending order', () => {
    const tasks = [
      makeTask({ id: 'p3', title: 'P3', status: 'open', priority: 3 }),
      makeTask({ id: 'p1', title: 'P1', status: 'open', priority: 1 }),
      makeTask({ id: 'p2', title: 'P2', status: 'open', priority: 2 }),
    ]
    const result = groupTasks(tasks, { type: 'field', field: 'priority' })
    expect(result.map(s => s.key)).toEqual(['1', '2', '3', '4'])
  })

  it('uses correct section labels', () => {
    const result = groupTasks([], { type: 'field', field: 'priority' })
    expect(result[0].label).toBe('P1 Critical')
    expect(result[1].label).toBe('P2 High')
    expect(result[2].label).toBe('P3 Medium')
    expect(result[3].label).toBe('P4 Low')
  })

  it('includes empty sections', () => {
    const tasks = [makeTask({ id: 'p2', title: 'P2', status: 'open', priority: 2 })]
    const result = groupTasks(tasks, { type: 'field', field: 'priority' })
    expect(result).toHaveLength(4)
    const p1 = result.find(s => s.key === '1')!
    expect(p1.tasks).toHaveLength(0)
  })
})

describe('groupTasks — label-prefix', () => {
  it('groups by suffix, alphabetical order, (none) last', () => {
    const foo1 = makeTask({ id: 'f1', title: 'Foo 1', status: 'open', priority: 1, labels: ['openspec:foo'] })
    const foo2 = makeTask({ id: 'f2', title: 'Foo 2', status: 'open', priority: 1, labels: ['openspec:foo'] })
    const bar = makeTask({ id: 'b1', title: 'Bar', status: 'open', priority: 1, labels: ['openspec:bar'] })
    const none = makeTask({ id: 'n1', title: 'None', status: 'open', priority: 1, labels: [] })

    const result = groupTasks([foo1, foo2, bar, none], { type: 'label-prefix', prefix: 'openspec' })
    expect(result.map(s => s.key)).toEqual(['bar', 'foo', '(none)'])
    expect(result.find(s => s.key === 'foo')!.tasks).toHaveLength(2)
    expect(result.find(s => s.key === 'bar')!.tasks).toHaveLength(1)
    expect(result.find(s => s.key === '(none)')!.tasks).toHaveLength(1)
  })

  it('places task with multiple matching labels in multiple sections', () => {
    const multi = makeTask({
      id: 'm1', title: 'Multi', status: 'open', priority: 1,
      labels: ['openspec:foo', 'openspec:bar'],
    })
    const result = groupTasks([multi], { type: 'label-prefix', prefix: 'openspec' })
    expect(result.find(s => s.key === 'foo')!.tasks).toContain(multi)
    expect(result.find(s => s.key === 'bar')!.tasks).toContain(multi)
  })

  it('puts task with no matching label in (none) bucket', () => {
    const task = makeTask({ id: 'x', title: 'X', status: 'open', priority: 1, labels: ['other:thing'] })
    const result = groupTasks([task], { type: 'label-prefix', prefix: 'openspec' })
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('(none)')
    expect(result[0].tasks).toContain(task)
  })

  it('excludes (none) section when all tasks match a prefix', () => {
    const task = makeTask({ id: 't', title: 'T', status: 'open', priority: 1, labels: ['openspec:x'] })
    const result = groupTasks([task], { type: 'label-prefix', prefix: 'openspec' })
    expect(result.find(s => s.key === '(none)')).toBeUndefined()
  })
})

describe('serializeGroupConfig', () => {
  it('serializes null to null', () => {
    expect(serializeGroupConfig(null)).toBe(null)
  })

  it('serializes field config', () => {
    expect(serializeGroupConfig({ type: 'field', field: 'status' })).toBe('field:status')
    expect(serializeGroupConfig({ type: 'field', field: 'priority' })).toBe('field:priority')
  })

  it('serializes label-prefix config', () => {
    expect(serializeGroupConfig({ type: 'label-prefix', prefix: 'openspec' })).toBe('label:openspec')
  })
})

describe('deserializeGroupConfig', () => {
  it('returns null for null/undefined/empty', () => {
    expect(deserializeGroupConfig(null)).toBe(null)
    expect(deserializeGroupConfig(undefined)).toBe(null)
    expect(deserializeGroupConfig('')).toBe(null)
  })

  it('deserializes field config', () => {
    expect(deserializeGroupConfig('field:status')).toEqual({ type: 'field', field: 'status' })
    expect(deserializeGroupConfig('field:priority')).toEqual({ type: 'field', field: 'priority' })
    expect(deserializeGroupConfig('field:assignee')).toEqual({ type: 'field', field: 'assignee' })
    expect(deserializeGroupConfig('field:task_type')).toEqual({ type: 'field', field: 'task_type' })
  })

  it('deserializes label-prefix config', () => {
    expect(deserializeGroupConfig('label:openspec')).toEqual({ type: 'label-prefix', prefix: 'openspec' })
  })

  it('returns null for unrecognized values (graceful degradation)', () => {
    expect(deserializeGroupConfig('xyz:unknown')).toBe(null)
    expect(deserializeGroupConfig('field:invalid_field')).toBe(null)
    expect(deserializeGroupConfig('label:')).toBe(null)
  })

  it('round-trips serialize/deserialize', () => {
    const configs: GroupConfig[] = [
      null,
      { type: 'field', field: 'status' },
      { type: 'field', field: 'priority' },
      { type: 'label-prefix', prefix: 'openspec' },
    ]
    for (const c of configs) {
      expect(deserializeGroupConfig(serializeGroupConfig(c))).toEqual(c)
    }
  })
})

// ─── applyFilters — workspace AND-filter ──────────────────────────────────────

const WS_LABELS = ['branch:main', 'worktree:BeadSpec', 'repo:BeadSpec']

function makeFilterTask(id: string, labels: string[]): Task {
  return makeTask({ id, title: `Task ${id}`, status: 'open', priority: 2, labels })
}

describe('applyFilters — workspace AND-filter', () => {
  const taskAllLabels = makeFilterTask('all', WS_LABELS)
  const taskMissingOne = makeFilterTask('missing', ['branch:main', 'worktree:BeadSpec'])
  const taskNoLabels = makeFilterTask('none', [])
  const taskExtraLabels = makeFilterTask('extra', [...WS_LABELS, 'openspec:foo'])

  it('scope-on: task with all three workspace labels passes', () => {
    const result = applyFilters(
      [taskAllLabels, taskMissingOne, taskNoLabels],
      {},
      { labels: WS_LABELS, enabled: true },
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('all')
  })

  it('scope-on: task missing one workspace label is excluded', () => {
    const result = applyFilters(
      [taskAllLabels, taskMissingOne],
      {},
      { labels: WS_LABELS, enabled: true },
    )
    expect(result.map(t => t.id)).toEqual(['all'])
    expect(result.find(t => t.id === 'missing')).toBeUndefined()
  })

  it('scope-on: task with all labels plus extras still passes', () => {
    const result = applyFilters(
      [taskExtraLabels, taskNoLabels],
      {},
      { labels: WS_LABELS, enabled: true },
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('extra')
  })

  it('scope-off: all tasks pass regardless of workspace labels', () => {
    const result = applyFilters(
      [taskAllLabels, taskMissingOne, taskNoLabels],
      {},
      { labels: WS_LABELS, enabled: false },
    )
    expect(result).toHaveLength(3)
  })

  it('scope-on with empty labels array: all tasks pass (skip filter)', () => {
    const result = applyFilters(
      [taskAllLabels, taskMissingOne, taskNoLabels],
      {},
      { labels: [], enabled: true },
    )
    expect(result).toHaveLength(3)
  })

  it('no workspaceFilter param: all tasks pass (backward compat)', () => {
    const result = applyFilters(
      [taskAllLabels, taskMissingOne, taskNoLabels],
      {},
    )
    expect(result).toHaveLength(3)
  })

  it('scope-on workspace filter applied before user filters', () => {
    // task has workspace labels AND status=open; user filter asks status=closed
    const result = applyFilters(
      [taskAllLabels, taskMissingOne],
      { status: ['closed'] },
      { labels: WS_LABELS, enabled: true },
    )
    // taskAllLabels passes workspace filter but fails user status filter
    expect(result).toHaveLength(0)
  })
})
