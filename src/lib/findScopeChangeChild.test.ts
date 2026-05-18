import { describe, expect, it } from 'vitest'
import { findScopeChangeChild } from './findScopeChangeChild'

const base = {
  title: 'Task',
  status: 'open',
  priority: 2,
  task_type: 'task',
  assignee: null,
  updated_at: '2026-01-01T00:00:00Z',
}

function task(id: string, labels = ['openspec:demo'], created_at = '2026-01-01T00:00:00Z') {
  return { ...base, id, labels, created_at }
}

describe('findScopeChangeChild', () => {
  it('uses explicit Resolves note first', () => {
    const child = task('BEADSPEC-child')
    expect(findScopeChangeChild({ id: 'BEADSPEC-parent', labels: ['openspec:demo'], description: 'Resolves: BEADSPEC-child' }, [child], [])?.id).toBe(child.id)
  })

  it('falls back to shared openspec blocking candidates newest first', () => {
    const older = task('BEADSPEC-old', ['openspec:demo'], '2026-01-01T00:00:00Z')
    const newer = task('BEADSPEC-new', ['openspec:demo'], '2026-02-01T00:00:00Z')
    expect(findScopeChangeChild({ id: 'BEADSPEC-parent', labels: ['openspec:demo'] }, [older, newer], [older.id, newer.id])?.id).toBe(newer.id)
  })

  it('excludes wrong openspec labels and returns null when no signal matches', () => {
    const child = task('BEADSPEC-child', ['openspec:other'])
    expect(findScopeChangeChild({ id: 'BEADSPEC-parent', labels: ['openspec:demo'] }, [child], [child.id])).toBeNull()
  })
})
