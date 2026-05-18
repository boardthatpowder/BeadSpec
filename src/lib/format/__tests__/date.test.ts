import { describe, expect, it } from 'vitest'
import { formatAbsolute, formatRelative } from '../date'

describe('date formatting helpers', () => {
  it('formats relative timestamps with a suffix', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000

    expect(formatRelative(twoHoursAgo)).toMatch(/2 hours ago/)
  })

  it('formats absolute dates without time by default', () => {
    expect(formatAbsolute(new Date(2025, 0, 15, 9, 30, 0))).toBe('Jan 15, 2025')
  })

  it('formats absolute dates with time when requested', () => {
    expect(formatAbsolute(new Date(2025, 0, 15, 9, 30, 0), { includeTime: true })).toBe(
      'Jan 15, 2025 9:30 AM',
    )
  })

  it('accepts ISO string input', () => {
    expect(formatAbsolute('2025-01-15T12:00:00.000Z')).not.toHaveLength(0)
    expect(formatRelative(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())).toMatch(/ago/)
  })

  it('accepts numeric timestamp input', () => {
    expect(formatAbsolute(new Date(2025, 0, 15).getTime())).toBe('Jan 15, 2025')
  })
})
