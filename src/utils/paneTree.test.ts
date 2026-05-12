import { describe, it, expect } from 'vitest'
import {
  findLeaf,
  replaceLeaf,
  splitLeaf,
  collapseEmptyParents,
  nextTabAfterClose,
} from './paneTree'
import type { LeafPane, PaneNode, TabId } from './paneTree'

function leaf(id: string, tabs: string[] = []): LeafPane {
  const tabIds: TabId[] = tabs.map((t) => ({ kind: 'task' as const, id: t }))
  return { kind: 'leaf', id, tabs: tabIds, pinned: {}, activeTabId: tabs[0] ?? null }
}

describe('findLeaf', () => {
  it('finds a leaf at the root', () => {
    const root = leaf('a')
    expect(findLeaf(root, 'a')).toBe(root)
  })

  it('finds a nested leaf', () => {
    const b = leaf('b')
    const root: PaneNode = {
      kind: 'split', id: 's1', direction: 'horizontal',
      children: [leaf('a'), b], sizes: [50, 50],
    }
    expect(findLeaf(root, 'b')).toBe(b)
  })

  it('returns null when not found', () => {
    expect(findLeaf(leaf('a'), 'z')).toBeNull()
  })
})

describe('replaceLeaf', () => {
  it('returns new tree with the leaf replaced', () => {
    const original = leaf('a', ['task-1'])
    const updated = replaceLeaf(original, 'a', (l) => ({
      ...l,
      tabs: [{ kind: 'task' as const, id: 'task-2' }],
    }))
    expect((updated as LeafPane).tabs.map((t) => t.id)).toEqual(['task-2'])
    // Original must be unchanged — immutability.
    expect(original.tabs.map((t) => t.id)).toEqual(['task-1'])
  })

  it('returns the same reference when paneId not found (short-circuit)', () => {
    const root = leaf('a')
    const result = replaceLeaf(root, 'z', (l) => ({ ...l, tabs: [{ kind: 'task' as const, id: 'x' }] }))
    expect(result).toBe(root)
  })

  it('replaces a nested leaf', () => {
    const a = leaf('a', ['t1'])
    const b = leaf('b')
    const root: PaneNode = {
      kind: 'split', id: 's1', direction: 'horizontal',
      children: [a, b], sizes: [50, 50],
    }
    const result = replaceLeaf(root, 'a', (l) => ({
      ...l,
      tabs: [{ kind: 'task' as const, id: 't2' }],
    }))
    expect(findLeaf(result, 'a')?.tabs.map((t) => t.id)).toEqual(['t2'])
    // b untouched.
    expect(findLeaf(result, 'b')).toBe(b)
  })
})

describe('splitLeaf', () => {
  it('wraps a root leaf in a SplitPane with an empty sibling', () => {
    const root = leaf('a', ['t1'])
    const result = splitLeaf(root, 'a', 'horizontal', 'new-id')
    expect(result.kind).toBe('split')
    if (result.kind !== 'split') return
    expect(result.direction).toBe('horizontal')
    expect(result.children).toHaveLength(2)
    expect(result.children[0]).toStrictEqual(root)
    expect(result.children[1]).toMatchObject({ kind: 'leaf', id: 'new-id', tabs: [] })
    expect(result.sizes).toEqual([50, 50])
  })

  it('splits a nested leaf', () => {
    const a = leaf('a')
    const b = leaf('b')
    const root: PaneNode = { kind: 'split', id: 's1', direction: 'horizontal', children: [a, b], sizes: [50, 50] }
    const result = splitLeaf(root, 'b', 'vertical', 'new-b')
    if (result.kind !== 'split') return
    expect(result.children[0]).toBe(a)
    expect(result.children[1].kind).toBe('split')
  })

  it('positions new sibling before existing leaf when position=before', () => {
    const root = leaf('a', ['t1'])
    const result = splitLeaf(root, 'a', 'horizontal', 'new-id', 'before')
    expect(result.kind).toBe('split')
    if (result.kind !== 'split') return
    expect(result.children[0]).toMatchObject({ kind: 'leaf', id: 'new-id', tabs: [] })
    expect(result.children[1]).toStrictEqual(root)
  })

  it('defaults to after (backward compat)', () => {
    const root = leaf('a', ['t1'])
    const result = splitLeaf(root, 'a', 'vertical', 'new-id')
    if (result.kind !== 'split') return
    expect(result.children[0]).toStrictEqual(root)
    expect(result.children[1]).toMatchObject({ id: 'new-id' })
  })
})

describe('collapseEmptyParents', () => {
  it('collapses when the hinted leaf empties via close-batch', () => {
    const a = leaf('a', ['t1'])
    const emptyHinted = leaf('b') // tabs: []
    const root: PaneNode = { kind: 'split', id: 's1', direction: 'horizontal', children: [a, emptyHinted], sizes: [50, 50] }
    const result = collapseEmptyParents(root, 'b')
    // Surviving sibling replaces the split.
    expect(result).toBe(a)
  })

  it('does NOT collapse when hint ID does not match any empty leaf', () => {
    const a = leaf('a', ['t1'])
    const b = leaf('b', ['t2'])
    const root: PaneNode = { kind: 'split', id: 's1', direction: 'horizontal', children: [a, b], sizes: [50, 50] }
    const result = collapseEmptyParents(root, 'nonexistent')
    expect(result).toBe(root)
  })

  it('root leaf is never removed', () => {
    const root = leaf('root') // empty, but it IS the root
    const result = collapseEmptyParents(root, 'root')
    // Root leaf is never collapsed — the fn only acts on split parents.
    expect(result).toBe(root)
  })
})

describe('nextTabAfterClose', () => {
  it('returns right neighbor when one exists', () => {
    const l = leaf('p', ['a', 'b', 'c'])
    expect(nextTabAfterClose(l, 'a')).toBe('b')
  })

  it('falls back to left neighbor when closed tab is last', () => {
    const l = leaf('p', ['a', 'b', 'c'])
    expect(nextTabAfterClose(l, 'c')).toBe('b')
  })

  it('returns null when the closed tab was the only one', () => {
    const l = leaf('p', ['a'])
    expect(nextTabAfterClose(l, 'a')).toBeNull()
  })

  it('returns current activeTabId when closedTabId is not in tabs', () => {
    const l = { ...leaf('p', ['a', 'b']), activeTabId: 'a' }
    expect(nextTabAfterClose(l, 'z')).toBe('a')
  })
})
