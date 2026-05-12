import { describe, it, expect } from 'vitest'
import { buildTaskQueryKey } from './useTasks'

describe('buildTaskQueryKey', () => {
  it('returns a stable key for the same params', () => {
    const key1 = buildTaskQueryKey('proj-1', { statusFilter: ['open'] })
    const key2 = buildTaskQueryKey('proj-1', { statusFilter: ['open'] })
    expect(key1).toEqual(key2)
  })

  it('produces different keys for different statusFilter values', () => {
    const key1 = buildTaskQueryKey('proj-1', { statusFilter: ['open'] })
    const key2 = buildTaskQueryKey('proj-1', { statusFilter: ['closed'] })
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys when statusFilter is present vs absent', () => {
    const key1 = buildTaskQueryKey('proj-1', {})
    const key2 = buildTaskQueryKey('proj-1', { statusFilter: ['open'] })
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys for different labelFilter values', () => {
    const key1 = buildTaskQueryKey('proj-1', { labelFilter: ['bug'] })
    const key2 = buildTaskQueryKey('proj-1', { labelFilter: ['feature'] })
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys for different projects', () => {
    const key1 = buildTaskQueryKey('proj-1', { statusFilter: ['open'] })
    const key2 = buildTaskQueryKey('proj-2', { statusFilter: ['open'] })
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys for different sortCol values', () => {
    const key1 = buildTaskQueryKey('proj-1', { sortCol: 'priority' })
    const key2 = buildTaskQueryKey('proj-1', { sortCol: 'updated_at' })
    expect(key1).not.toEqual(key2)
  })

  it('produces different keys for different sortDir values', () => {
    const key1 = buildTaskQueryKey('proj-1', { sortDir: 'asc' })
    const key2 = buildTaskQueryKey('proj-1', { sortDir: 'desc' })
    expect(key1).not.toEqual(key2)
  })

  it('uses 200 as the default limit', () => {
    const key = buildTaskQueryKey('proj-1', {})
    const params = key[2] as Record<string, unknown>
    expect(params.limit).toBe(200)
  })

  it('respects an explicit limit override', () => {
    const key = buildTaskQueryKey('proj-1', { limit: 50 })
    const params = key[2] as Record<string, unknown>
    expect(params.limit).toBe(50)
  })

  it('key starts with "tasks" discriminator', () => {
    const key = buildTaskQueryKey('proj-1', {})
    expect(key[0]).toBe('tasks')
  })
})
