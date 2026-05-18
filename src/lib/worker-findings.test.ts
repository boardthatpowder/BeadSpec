import { describe, expect, it } from 'vitest'
import {
  formatSeverityBreakdown,
  formatWorkerFindingDate,
  parseWorkerProvenance,
  priorityToSeverity,
} from './worker-findings'

describe('parseWorkerProvenance', () => {
  it('accepts the canonical worker prefix', () => {
    const notes = 'Auto-filed by ruflo-security-audit on 2026-05-17T10:00Z. Branch: main\nDetails'

    expect(parseWorkerProvenance(notes)).toEqual({
      worker: 'security-audit',
      firstLine: 'Auto-filed by ruflo-security-audit on 2026-05-17T10:00Z. Branch: main',
    })
  })

  it('accepts hyphenated worker names', () => {
    const notes = 'Auto-filed by ruflo-test-gap-detector on 2026-05-17T10:00Z'

    expect(parseWorkerProvenance(notes)).toEqual({
      worker: 'test-gap-detector',
      firstLine: notes,
    })
  })

  it('rejects mid-string occurrences', () => {
    expect(parseWorkerProvenance('Note: Auto-filed by ruflo-security-audit on 2026-05-17T10:00Z')).toBeNull()
  })

  it('rejects malformed delimiters', () => {
    expect(parseWorkerProvenance('Auto-filed by ruflo-security-audit on2026-05-17T10:00Z')).toBeNull()
  })

  it('rejects null, undefined, and empty notes', () => {
    expect(parseWorkerProvenance(null)).toBeNull()
    expect(parseWorkerProvenance(undefined)).toBeNull()
    expect(parseWorkerProvenance('')).toBeNull()
  })

  it('rejects invalid worker tokens', () => {
    expect(parseWorkerProvenance('Auto-filed by ruflo-SecurityAudit on 2026-05-17T10:00Z')).toBeNull()
  })
})

describe('worker finding formatting', () => {
  it('maps priorities to severity labels', () => {
    expect(priorityToSeverity(1)).toBe('critical')
    expect(priorityToSeverity(2)).toBe('high')
    expect(priorityToSeverity(3)).toBe('medium')
    expect(priorityToSeverity(4)).toBe('low')
    expect(priorityToSeverity(99)).toBe('low')
  })

  it('formats nonzero severity breakdowns in priority order', () => {
    expect(formatSeverityBreakdown([2, 1, 2, 3])).toBe('1 critical, 2 high, 1 medium')
    expect(formatSeverityBreakdown([])).toBe('')
  })

  it('formats finding dates stably', () => {
    expect(formatWorkerFindingDate('2026-05-17T10:00:00Z')).toBe('2026-05-17')
    expect(formatWorkerFindingDate('not-a-date')).toBe('')
  })
})
