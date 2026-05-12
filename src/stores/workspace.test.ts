import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from './workspace'
import type { LeafPane, PaneNode } from './workspace'
import { findLeaf } from '../utils/paneTree'

function getStore() {
  return useWorkspaceStore.getState()
}

function reset() {
  const id = crypto.randomUUID()
  useWorkspaceStore.setState({
    root: { kind: 'leaf', id, tabs: [], pinned: {}, activeTabId: null },
    activePaneId: id,
    recentlyClosed: [],
    innerSubTab: {},
  })
}

beforeEach(reset)

function activeLeaf(): LeafPane {
  const s = getStore()
  const root = s.root
  if (root.kind === 'leaf') return root
  throw new Error('root is not a leaf in this test')
}

// ── openPreview ──────────────────────────────────────────────────────────────

describe('openPreview', () => {
  it('opens a preview tab (tab count = 1)', () => {
    getStore().openPreview('task-a')
    const leaf = activeLeaf()
    expect(leaf.tabs).toHaveLength(1)
    expect(leaf.tabs[0]?.id).toBe('task-a')
    expect(leaf.pinned['task-a']).toBeFalsy()
    expect(leaf.activeTabId).toBe('task-a')
  })

  it('openPreview twice keeps tab count at 1 (replaces existing preview)', () => {
    getStore().openPreview('task-a')
    getStore().openPreview('task-b')
    const leaf = activeLeaf()
    expect(leaf.tabs).toHaveLength(1)
    expect(leaf.tabs[0]?.id).toBe('task-b')
  })

  it('does NOT replace a pinned tab when opening a new preview', () => {
    getStore().openPinned('task-a')
    getStore().openPreview('task-b')
    const leaf = activeLeaf()
    expect(leaf.tabs).toHaveLength(2)
    expect(leaf.tabs.map((t) => t.id).includes('task-a')).toBe(true)
    expect(leaf.tabs.map((t) => t.id).includes('task-b')).toBe(true)
    expect(leaf.pinned['task-a']).toBe(true)
    expect(leaf.pinned['task-b']).toBeFalsy()
  })
})

// ── promoteToPinned / openPinned ─────────────────────────────────────────────

describe('promoteToPinned', () => {
  it('openPreview + promoteToPinned + openPreview yields 2 tabs', () => {
    getStore().openPreview('task-a')
    getStore().promoteToPinned('task-a')
    getStore().openPreview('task-b')
    const leaf = activeLeaf()
    expect(leaf.tabs).toHaveLength(2)
    expect(leaf.pinned['task-a']).toBe(true)
    expect(leaf.pinned['task-b']).toBeFalsy()
  })
})

describe('openPinned', () => {
  it('opens a new tab as pinned', () => {
    getStore().openPinned('task-a')
    const leaf = activeLeaf()
    expect(leaf.tabs.map((t) => t.id)).toContain('task-a')
    expect(leaf.pinned['task-a']).toBe(true)
  })

  it('promotes an existing preview tab when called on it', () => {
    getStore().openPreview('task-a')
    getStore().openPinned('task-a')
    const leaf = activeLeaf()
    expect(leaf.tabs).toHaveLength(1)
    expect(leaf.pinned['task-a']).toBe(true)
  })
})

// ── closeTab ─────────────────────────────────────────────────────────────────

describe('closeTab', () => {
  it('removes the tab and pushes to recentlyClosed', () => {
    const s = getStore()
    s.openPinned('task-a')
    s.openPinned('task-b')
    const paneId = s.activePaneId
    getStore().closeTab(paneId, 'task-a')
    const leaf = activeLeaf()
    expect(leaf.tabs.map((t) => t.id)).not.toContain('task-a')
    expect(getStore().recentlyClosed[0].taskId).toBe('task-a')
  })

  it('advances activeTabId to right neighbor on close', () => {
    const s = getStore()
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.openPinned('task-c')
    const paneId = s.activePaneId
    // Make task-b active.
    getStore().setActiveTab(paneId, 'task-b')
    getStore().closeTab(paneId, 'task-a')
    // task-a was at idx 0; right neighbor (task-b) should stay active.
    expect(activeLeaf().activeTabId).toBe('task-b')
  })
})

// ── closeOthers ──────────────────────────────────────────────────────────────

describe('closeOthers', () => {
  it('keeps only the named tab', () => {
    const s = getStore()
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.openPinned('task-c')
    const paneId = s.activePaneId
    getStore().closeOthers(paneId, 'task-b')
    expect(activeLeaf().tabs.map((t) => t.id)).toEqual(['task-b'])
    expect(getStore().recentlyClosed).toHaveLength(2)
  })
})

// ── reopenLast ───────────────────────────────────────────────────────────────

describe('reopenLast', () => {
  it('restores closed tab at its original index', () => {
    const s = getStore()
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.openPinned('task-c')
    const paneId = s.activePaneId
    // Close task-b (was at index 1).
    getStore().closeTab(paneId, 'task-b')
    expect(activeLeaf().tabs.map((t) => t.id)).toEqual(['task-a', 'task-c'])
    // Reopen — should restore at index 1.
    getStore().reopenLast()
    expect(activeLeaf().tabs.map((t) => t.id)).toEqual(['task-a', 'task-b', 'task-c'])
    expect(activeLeaf().activeTabId).toBe('task-b')
  })

  it('restores into active pane when original pane no longer exists', () => {
    const s = getStore()
    s.openPinned('task-a')
    const paneId = s.activePaneId
    getStore().closeTab(paneId, 'task-a')
    // Stack has task-a. Now closePane to nuke the pane (already empty).
    // Just reopen — active pane is the same leaf.
    getStore().reopenLast()
    expect(activeLeaf().tabs.map((t) => t.id)).toContain('task-a')
  })

  it('is a no-op when stack is empty', () => {
    getStore().reopenLast()
    expect(activeLeaf().tabs).toHaveLength(0)
  })
})

// ── recentlyClosed capacity ───────────────────────────────────────────────────

describe('recentlyClosed capacity', () => {
  it('caps at 20 entries (FIFO)', () => {
    const s = getStore()
    const paneId = s.activePaneId
    for (let i = 0; i < 22; i++) {
      s.openPinned(`task-${i}`)
      getStore().closeTab(paneId, `task-${i}`)
    }
    expect(getStore().recentlyClosed).toHaveLength(20)
    // Oldest entries (task-0, task-1) should be evicted.
    expect(getStore().recentlyClosed.some((r) => r.taskId === 'task-0')).toBe(false)
    expect(getStore().recentlyClosed.some((r) => r.taskId === 'task-21')).toBe(true)
  })
})

// ── splitPane ────────────────────────────────────────────────────────────────

describe('splitPane', () => {
  it('creates a SplitPane and makes the sibling active', () => {
    const s = getStore()
    const originalPaneId = s.activePaneId
    getStore().splitPane(originalPaneId, 'horizontal')
    const state = getStore()
    expect(state.root.kind).toBe('split')
    expect(state.activePaneId).not.toBe(originalPaneId)
  })
})

// ── moveTab ──────────────────────────────────────────────────────────────────

describe('moveTab', () => {
  it('moves a tab from pane A to pane B, arriving as pinned and active', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().moveTab(paneA, 'task-a', paneB)

    const root = getStore().root as PaneNode
    const leafA = findLeaf(root, paneA)!
    const leafB = findLeaf(root, paneB)!
    expect(leafA.tabs.map((t) => t.id)).not.toContain('task-a')
    expect(leafB.tabs.map((t) => t.id)).toContain('task-a')
    expect(leafB.pinned['task-a']).toBe(true)
    expect(leafB.activeTabId).toBe('task-a')
    expect(getStore().activePaneId).toBe(paneB)
  })

  it('inserts at destIndex when provided', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId
    s.openPinned('task-x')
    s.openPinned('task-y')

    getStore().moveTab(paneA, 'task-a', paneB, 0)

    const leafB = findLeaf(getStore().root, paneB)!
    expect(leafB.tabs[0]?.id).toBe('task-a')
  })

  it('promotes a preview tab to pinned on cross-pane move', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPreview('task-a') // preview (not pinned)
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().moveTab(paneA, 'task-a', paneB)

    const leafB = findLeaf(getStore().root, paneB)!
    expect(leafB.pinned['task-a']).toBe(true)
  })

  it('collapses source pane when its last tab is moved out', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a') // only tab in pane A
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().moveTab(paneA, 'task-a', paneB)

    // pane A should be gone — root collapses to just pane B
    expect(getStore().root.kind).toBe('leaf')
    expect((getStore().root as LeafPane).id).toBe(paneB)
  })

  it('is a no-op when taskId is not in srcPane', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    const stateBefore = getStore().root
    getStore().moveTab(paneA, 'nonexistent', paneA)
    expect(getStore().root).toBe(stateBefore)
  })
})

// ── splitWithTab ─────────────────────────────────────────────────────────────

describe('splitWithTab', () => {
  it('splits dest pane to the right and places tab in new pane', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().splitWithTab(paneA, 'task-a', paneB, 'right')

    const root = getStore().root
    const newPaneId = getStore().activePaneId
    expect(newPaneId).not.toBe(paneA)
    expect(newPaneId).not.toBe(paneB)
    const newLeaf = findLeaf(root, newPaneId)!
    expect(newLeaf.tabs.map((t) => t.id)).toContain('task-a')
    expect(newLeaf.pinned['task-a']).toBe(true)
    expect(newLeaf.activeTabId).toBe('task-a')
    // task-a removed from pane A
    const leafA = findLeaf(root, paneA)!
    expect(leafA.tabs.map((t) => t.id)).not.toContain('task-a')
  })

  it('places new pane before dest for left edge', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    s.openPinned('task-b')
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().splitWithTab(paneA, 'task-a', paneB, 'left')

    const root = getStore().root
    const newPaneId = getStore().activePaneId
    // New pane has task-a and paneB still exists
    const newLeaf = findLeaf(root, newPaneId)!
    expect(newLeaf.tabs.map((t) => t.id)).toContain('task-a')
    expect(findLeaf(root, paneB)).not.toBeNull()
    // The split wrapping paneB should have new pane as its first child (left)
    const innerSplit = (() => {
      if (root.kind !== 'split') return null
      for (const child of root.children) {
        if (child.kind === 'split') {
          const hasNew = child.children.some((c) => c.kind === 'leaf' && (c as LeafPane).id === newPaneId)
          if (hasNew) return child
        }
      }
      return null
    })()
    expect(innerSplit).not.toBeNull()
    if (innerSplit?.kind === 'split') {
      expect((innerSplit.children[0] as LeafPane).id).toBe(newPaneId)
    }
  })

  it('collapses source pane when only tab is dragged to another pane edge', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-only')
    s.splitPane(paneA, 'horizontal')
    const paneB = getStore().activePaneId

    getStore().splitWithTab(paneA, 'task-only', paneB, 'bottom')

    // pane A was emptied — tree should not contain it
    expect(findLeaf(getStore().root, paneA)).toBeNull()
    const newPaneId = getStore().activePaneId
    const newLeaf = findLeaf(getStore().root, newPaneId)!
    expect(newLeaf.tabs.map((t) => t.id)).toContain('task-only')
  })

  it('handles src === dest (drag tab to own pane edge)', () => {
    const s = getStore()
    const paneA = s.activePaneId
    s.openPinned('task-a')
    s.openPinned('task-b')

    getStore().splitWithTab(paneA, 'task-a', paneA, 'right')

    const root = getStore().root
    const newPaneId = getStore().activePaneId
    const newLeaf = findLeaf(root, newPaneId)!
    expect(newLeaf.tabs.map((t) => t.id)).toContain('task-a')
    // pane A still exists with task-b
    const leafA = findLeaf(root, paneA)!
    expect(leafA.tabs.map((t) => t.id)).toContain('task-b')
    expect(leafA.tabs.map((t) => t.id)).not.toContain('task-a')
  })
})

// ── setInnerSubTab ────────────────────────────────────────────────────────────

describe('setInnerSubTab', () => {
  it('stores inner sub-tab per pane+task key', () => {
    getStore().setInnerSubTab('pane-1', 'task-a', 'activity')
    expect(getStore().innerSubTab['pane-1:task-a']).toBe('activity')
    getStore().setInnerSubTab('pane-1', 'task-a', 'details')
    expect(getStore().innerSubTab['pane-1:task-a']).toBe('details')
  })

  it('keeps different pane+task keys independent', () => {
    getStore().setInnerSubTab('pane-1', 'task-a', 'activity')
    getStore().setInnerSubTab('pane-2', 'task-a', 'dependencies')
    expect(getStore().innerSubTab['pane-1:task-a']).toBe('activity')
    expect(getStore().innerSubTab['pane-2:task-a']).toBe('dependencies')
  })
})
