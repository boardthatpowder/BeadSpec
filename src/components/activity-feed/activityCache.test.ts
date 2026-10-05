import { expect, it } from 'vitest'
import type { ActivityEvent } from '../../bindings'
import { appendActivityEvent, activityChannel } from './activityCache'
const event = (id: string): ActivityEvent => ({ id, ts: '2026-10-04T00:00:00Z', kind: 'create', source: 'beads', summary: id, detail: '{}', correlation_id: null })
it('uses distinct workspace channels and keeps replayed events unique within the cache bound', () => {
  expect(activityChannel('/one')).not.toBe(activityChannel('/two'))
  const previous = Array.from({ length: 500 }, (_, i) => event(String(i)))
  const next = appendActivityEvent(previous, event('200'))
  expect(next).toHaveLength(500)
  expect(next.filter(item => item.id === '200')).toHaveLength(1)
  expect(next[0].id).toBe('200')
  expect(appendActivityEvent(next, event('new'))).toHaveLength(500)
})
it('encodes project paths into valid Tauri event names', () => {
  expect(activityChannel('/work/my project/.worktrees/test')).toMatch(/^[A-Za-z0-9_:/-]+$/)
})
