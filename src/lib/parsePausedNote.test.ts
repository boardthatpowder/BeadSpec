import { describe, expect, it } from 'vitest'
import { parsePausedNote } from './parsePausedNote'

describe('parsePausedNote', () => {
  it('handles missing and unmatched notes', () => {
    expect(parsePausedNote(null)).toBeNull()
    expect(parsePausedNote('No pause here')).toBeNull()
  })

  it('returns the last matching pause reason', () => {
    expect(parsePausedNote('Paused: first\nother\nPaused: second  ')).toBe('second')
  })

  it('requires exact casing and a reason', () => {
    expect(parsePausedNote('paused: lower')).toBeNull()
    expect(parsePausedNote('Paused:   ')).toBeNull()
  })
})
