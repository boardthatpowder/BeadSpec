import { describe, expect, it } from 'vitest'
import { viewSelectionState } from './viewSelection'

describe('viewSelectionState', () => {
  it('clears stale memory namespace when Memory is selected from top navigation', () => {
    expect(viewSelectionState('memory')).toEqual({
      view: 'memory',
      memoryNamespace: undefined,
    })
  })

  it('keeps non-memory view selections scoped to the selected view only', () => {
    expect(viewSelectionState('activity')).toEqual({ view: 'activity' })
  })
})
