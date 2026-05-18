import { describe, expect, it } from 'vitest'
import { parseMemoryKey } from './parseMemoryKey'

describe('parseMemoryKey', () => {
  it('parses canonical keys and unknown facets', () => {
    const parsed = parseMemoryKey('branch:x|worktree:y|repo:z|openspec:c|issue:i|type:trajectory|outcome:done|ts:1700000000|extra:v')
    expect(parsed.branch).toBe('x')
    expect(parsed.ts).toBe(1700000000)
    expect(parsed.rest.extra).toBe('v')
  })

  it('keeps nonnumeric ts in rest', () => {
    const parsed = parseMemoryKey('ts:soon')
    expect(parsed.ts).toBeUndefined()
    expect(parsed.rest.ts).toBe('soon')
  })
})
