// Workspace store — multi-tab IDE-style pane management.
// Actions 3.2–3.5 implemented here; persistence (3.4) deferred to boot hook.
import { create } from 'zustand'
import {
  findLeaf,
  replaceLeaf,
  splitLeaf,
  collapseEmptyParents,
  nextTabAfterClose,
  docTabId,
} from '../utils/paneTree'
import type { LeafPane, PaneNode, TabId, DocTab } from '../utils/paneTree'

export type { LeafPane, SplitPane, PaneNode } from '../utils/paneTree'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecentlyClosed = { taskId: string; paneId: string; index: number; pinned: boolean }

export interface WorkspaceState {
  root: PaneNode
  activePaneId: string
  recentlyClosed: RecentlyClosed[]
  innerSubTab: Record<string, 'details' | 'dependencies' | 'activity'> // key: `${paneId}:${taskId}`
  dirtyTabs: Record<string, boolean> // key: `${paneId}:${taskId}` → isDirty
  openspecExpanded: Record<string, boolean> // key: `${paneId}:${taskId}` → is expanded
}

export interface WorkspaceActions {
  // Tab open
  openPreview: (taskId: string) => void
  openPinned:  (taskId: string) => void
  promoteToPinned: (taskId: string) => void
  openDocTab:  (change: string, artifact: string) => void
  // Tab close
  closeTab:    (paneId: string, taskId: string) => void
  closeOthers: (paneId: string, taskId: string) => void
  closeToRight:(paneId: string, taskId: string) => void
  closeAll:    (paneId: string) => void
  // Reorder
  reorderTab:  (paneId: string, fromIndex: number, toIndex: number) => void
  // Cross-pane move / edge split
  moveTab:     (srcPaneId: string, taskId: string, destPaneId: string, destIndex?: number) => void
  splitWithTab:(srcPaneId: string, taskId: string, destLeafId: string, edge: 'left' | 'right' | 'top' | 'bottom') => void
  // Split
  splitPane:   (paneId: string, direction: 'horizontal' | 'vertical') => void
  closePane:   (paneId: string) => void
  // Focus
  setActivePane: (paneId: string) => void
  setActiveTab:  (paneId: string, taskId: string) => void
  // Recently closed
  reopenLast:  () => void
  // Splits
  updateSplitSizes: (splitId: string, sizes: number[]) => void
  // Inner sub-tab
  setInnerSubTab: (paneId: string, taskId: string, tab: 'details' | 'dependencies' | 'activity') => void
  // Dirty-tab registry (task 10.1)
  setTabDirty: (paneId: string, taskId: string, dirty: boolean) => void
  isTabDirty: (paneId: string, taskId: string) => boolean
  // OpenSpec section expanded state (persists across tab switches within session)
  setOpenspecExpanded: (paneId: string, taskId: string, open: boolean) => void
  // Reset all workspace state (called on project switch)
  resetAll: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

const RECENTLY_CLOSED_LIMIT = 20

function makeLeaf(): LeafPane {
  return { kind: 'leaf', id: crypto.randomUUID(), tabs: [], pinned: {}, activeTabId: null }
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, _get) => {
  const initialLeaf = makeLeaf()

  return {
    // State
    root: initialLeaf,
    activePaneId: initialLeaf.id,
    recentlyClosed: [],
    innerSubTab: {},
    dirtyTabs: {},
    openspecExpanded: {},

    // ── Open ────────────────────────────────────────────────────────────────

    openPreview(taskId) {
      set((s) => {
        const paneId = s.activePaneId
        const leaf = findLeaf(s.root, paneId)
        if (!leaf) return s

        // Remove any existing preview tab (unpinned) and insert the new one.
        const existingPreview = leaf.tabs.find((t) => !leaf.pinned[t.id])
        let tabs = leaf.tabs.filter((t) => t.id !== existingPreview?.id && t.id !== taskId)
        // Insert preview after the last pinned tab.
        const lastPinnedIdx = tabs.reduce((acc, t, i) => (leaf.pinned[t.id] ? i : acc), -1)
        tabs.splice(lastPinnedIdx + 1, 0, { kind: 'task', id: taskId })

        const newLeaf: LeafPane = { ...leaf, tabs, pinned: { ...leaf.pinned }, activeTabId: taskId }
        delete newLeaf.pinned[taskId] // ensure preview (not pinned)

        return { root: replaceLeaf(s.root, paneId, () => newLeaf) }
      })
    },

    openPinned(taskId) {
      set((s) => {
        const paneId = s.activePaneId
        const leaf = findLeaf(s.root, paneId)
        if (!leaf) return s

        if (leaf.tabs.some((t) => t.id === taskId)) {
          // Already open — just promote and activate.
          const newPinned = { ...leaf.pinned, [taskId]: true }
          return { root: replaceLeaf(s.root, paneId, (l) => ({ ...l, pinned: newPinned, activeTabId: taskId })) }
        }

        // Remove existing preview of the same task (if any) and append as pinned.
        const tabs = [...leaf.tabs.filter((t) => t.id !== taskId), { kind: 'task', id: taskId } as TabId]
        const newPinned = { ...leaf.pinned, [taskId]: true }
        return { root: replaceLeaf(s.root, paneId, (l) => ({ ...l, tabs, pinned: newPinned, activeTabId: taskId })) }
      })
    },

    promoteToPinned(taskId) {
      set((s) => {
        const paneId = s.activePaneId
        return {
          root: replaceLeaf(s.root, paneId, (l) => ({
            ...l,
            pinned: { ...l.pinned, [taskId]: true },
          })),
        }
      })
    },

    openDocTab(change, artifact) {
      set((s) => {
        const id = docTabId(change, artifact)
        const docTab: DocTab = { kind: 'doc', id, change, artifact }

        // Bring to focus if already open in any pane
        const existing = findTabInTree(s.root, id)
        if (existing) {
          return {
            root: replaceLeaf(s.root, existing.paneId, (l) => ({ ...l, activeTabId: id })),
            activePaneId: existing.paneId,
          }
        }

        // Open as pinned in active pane
        return {
          root: replaceLeaf(s.root, s.activePaneId, (l) => ({
            ...l,
            tabs: [...l.tabs, docTab],
            pinned: { ...l.pinned, [id]: true },
            activeTabId: id,
          })),
        }
      })
    },

    // ── Close ───────────────────────────────────────────────────────────────

    closeTab(paneId, taskId) {
      set((s) => {
        const leaf = findLeaf(s.root, paneId)
        if (!leaf || !leaf.tabs.some((t) => t.id === taskId)) return s

        const index = leaf.tabs.findIndex((t) => t.id === taskId)
        const nextActive = nextTabAfterClose(leaf, taskId)
        const tabs = leaf.tabs.filter((t) => t.id !== taskId)
        const pinned = { ...leaf.pinned }
        delete pinned[taskId]

        const newLeaf: LeafPane = { ...leaf, tabs, pinned, activeTabId: nextActive }
        const recentlyClosed = [
          { taskId, paneId, index, pinned: !!leaf.pinned[taskId] },
          ...s.recentlyClosed,
        ].slice(0, RECENTLY_CLOSED_LIMIT)

        return { root: replaceLeaf(s.root, paneId, () => newLeaf), recentlyClosed }
      })
    },

    closeOthers(paneId, taskId) {
      set((s) => {
        const leaf = findLeaf(s.root, paneId)
        if (!leaf) return s

        const closing = leaf.tabs.filter((t) => t.id !== taskId)
        const recentlyClosed = [
          ...closing.map((t, i) => ({ taskId: t.id, paneId, index: i, pinned: !!leaf.pinned[t.id] })),
          ...s.recentlyClosed,
        ].slice(0, RECENTLY_CLOSED_LIMIT)

        const newPinned = taskId in leaf.pinned ? { [taskId]: leaf.pinned[taskId] } : {}
        const newLeaf: LeafPane = {
          ...leaf,
          tabs: [{ kind: 'task', id: taskId }],
          pinned: newPinned,
          activeTabId: taskId,
        }

        return {
          root: collapseEmptyParents(replaceLeaf(s.root, paneId, () => newLeaf), ''),
          recentlyClosed,
        }
      })
    },

    closeToRight(paneId, taskId) {
      set((s) => {
        const leaf = findLeaf(s.root, paneId)
        if (!leaf) return s

        const idx = leaf.tabs.findIndex((t) => t.id === taskId)
        if (idx === -1) return s

        const closing = leaf.tabs.slice(idx + 1)
        const tabs = leaf.tabs.slice(0, idx + 1)
        const recentlyClosed = [
          ...closing.map((t, i) => ({ taskId: t.id, paneId, index: idx + 1 + i, pinned: !!leaf.pinned[t.id] })),
          ...s.recentlyClosed,
        ].slice(0, RECENTLY_CLOSED_LIMIT)

        const pinned: Record<string, boolean> = {}
        tabs.forEach((t) => { if (leaf.pinned[t.id]) pinned[t.id] = true })

        const newLeaf: LeafPane = {
          ...leaf,
          tabs,
          pinned,
          activeTabId: leaf.activeTabId && tabs.some((t) => t.id === leaf.activeTabId) ? leaf.activeTabId : taskId,
        }
        return {
          root: collapseEmptyParents(replaceLeaf(s.root, paneId, () => newLeaf), ''),
          recentlyClosed,
        }
      })
    },

    closeAll(paneId) {
      set((s) => {
        const leaf = findLeaf(s.root, paneId)
        if (!leaf) return s

        const recentlyClosed = [
          ...leaf.tabs.map((t, i) => ({ taskId: t.id, paneId, index: i, pinned: !!leaf.pinned[t.id] })),
          ...s.recentlyClosed,
        ].slice(0, RECENTLY_CLOSED_LIMIT)

        const newLeaf: LeafPane = { ...leaf, tabs: [], pinned: {}, activeTabId: null }
        return {
          root: replaceLeaf(s.root, paneId, () => newLeaf),
          recentlyClosed,
        }
      })
    },

    // ── Reorder ─────────────────────────────────────────────────────────────

    reorderTab(paneId, fromIndex, toIndex) {
      set((s) => ({
        root: replaceLeaf(s.root, paneId, (l) => {
          const tabs = [...l.tabs]
          const [moved] = tabs.splice(fromIndex, 1)
          tabs.splice(toIndex, 0, moved)
          return { ...l, tabs }
        }),
      }))
    },

    // ── Cross-pane move / edge split ─────────────────────────────────────────

    moveTab(srcPaneId, taskId, destPaneId, destIndex) {
      set((s) => {
        const srcLeaf = findLeaf(s.root, srcPaneId)
        const destLeaf = findLeaf(s.root, destPaneId)
        if (!srcLeaf || !destLeaf || !srcLeaf.tabs.some((t) => t.id === taskId)) return s

        // Remove from source
        const srcTabs = srcLeaf.tabs.filter((t) => t.id !== taskId)
        const srcPinned = { ...srcLeaf.pinned }
        delete srcPinned[taskId]
        const newSrcLeaf: LeafPane = {
          ...srcLeaf,
          tabs: srcTabs,
          pinned: srcPinned,
          activeTabId: nextTabAfterClose(srcLeaf, taskId),
        }

        let newRoot = replaceLeaf(s.root, srcPaneId, () => newSrcLeaf)
        if (srcTabs.length === 0) newRoot = collapseEmptyParents(newRoot, srcPaneId)

        // Insert into dest (re-find in case collapse shifted refs)
        const currentDest = findLeaf(newRoot, destPaneId)
        if (!currentDest) return s

        const destTabs = [...currentDest.tabs]
        const insertAt = destIndex !== undefined ? Math.min(destIndex, destTabs.length) : destTabs.length
        destTabs.splice(insertAt, 0, { kind: 'task', id: taskId })

        newRoot = replaceLeaf(newRoot, destPaneId, (l) => ({
          ...l,
          tabs: destTabs,
          pinned: { ...l.pinned, [taskId]: true }, // always pinned on arrival
          activeTabId: taskId,
        }))

        return { root: newRoot, activePaneId: destPaneId }
      })
    },

    splitWithTab(srcPaneId, taskId, destLeafId, edge) {
      set((s) => {
        const srcLeaf = findLeaf(s.root, srcPaneId)
        if (!srcLeaf || !srcLeaf.tabs.some((t) => t.id === taskId)) return s

        const direction: 'horizontal' | 'vertical' =
          edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical'
        const position: 'before' | 'after' =
          edge === 'left' || edge === 'top' ? 'before' : 'after'

        const newPaneId = crypto.randomUUID()
        const samePaneEdge = srcPaneId === destLeafId

        // Remove tab from source
        const srcTabs = srcLeaf.tabs.filter((t) => t.id !== taskId)
        const srcPinned = { ...srcLeaf.pinned }
        delete srcPinned[taskId]
        let newRoot = replaceLeaf(s.root, srcPaneId, (l) => ({
          ...l,
          tabs: srcTabs,
          pinned: srcPinned,
          activeTabId: nextTabAfterClose(srcLeaf, taskId),
        }))

        // Collapse empty source only if it's not the dest we're about to split
        if (srcTabs.length === 0 && !samePaneEdge) {
          newRoot = collapseEmptyParents(newRoot, srcPaneId)
        }

        // Split dest leaf and place tab in new pane
        newRoot = splitLeaf(newRoot, destLeafId, direction, newPaneId, position)
        newRoot = replaceLeaf(newRoot, newPaneId, (l) => ({
          ...l,
          tabs: [{ kind: 'task', id: taskId }],
          pinned: { [taskId]: true },
          activeTabId: taskId,
        }))

        // Collapse the now-empty source when it was the same pane as dest
        if (srcTabs.length === 0 && samePaneEdge) {
          newRoot = collapseEmptyParents(newRoot, srcPaneId)
        }

        return { root: newRoot, activePaneId: newPaneId }
      })
    },

    // ── Split ────────────────────────────────────────────────────────────────

    splitPane(paneId, direction) {
      const newPaneId = crypto.randomUUID()
      set((s) => ({
        root: splitLeaf(s.root, paneId, direction, newPaneId),
        activePaneId: newPaneId,
      }))
    },

    closePane(paneId) {
      set((s) => ({
        root: collapseEmptyParents(s.root, paneId),
        activePaneId: s.activePaneId === paneId ? findFirstLeafId(s.root, paneId) : s.activePaneId,
      }))
    },

    // ── Focus ────────────────────────────────────────────────────────────────

    setActivePane(paneId) {
      set({ activePaneId: paneId })
    },

    setActiveTab(paneId, taskId) {
      set((s) => ({
        root: replaceLeaf(s.root, paneId, (l) => ({ ...l, activeTabId: taskId })),
      }))
    },

    // ── Reopen ───────────────────────────────────────────────────────────────

    reopenLast() {
      set((s) => {
        if (s.recentlyClosed.length === 0) return s
        const [{ taskId, paneId, index, pinned }, ...rest] = s.recentlyClosed

        // Target the original pane if still alive, else the active pane.
        const targetId = findLeaf(s.root, paneId) ? paneId : s.activePaneId

        const root = replaceLeaf(s.root, targetId, (l) => {
          const tabs = [...l.tabs]
          tabs.splice(Math.min(index, tabs.length), 0, { kind: 'task', id: taskId })
          return { ...l, tabs, pinned: { ...l.pinned, ...(pinned ? { [taskId]: true } : {}) }, activeTabId: taskId }
        })

        return { root, recentlyClosed: rest }
      })
    },

    // ── Sizes ────────────────────────────────────────────────────────────────

    updateSplitSizes(splitId, sizes) {
      set((s) => ({ root: updateSizes(s.root, splitId, sizes) }))
    },

    // ── Inner sub-tab ────────────────────────────────────────────────────────

    setInnerSubTab(paneId, taskId, tab) {
      set((s) => ({
        innerSubTab: { ...s.innerSubTab, [`${paneId}:${taskId}`]: tab },
      }))
    },

    setTabDirty(paneId, taskId, dirty) {
      set((s) => ({
        dirtyTabs: { ...s.dirtyTabs, [`${paneId}:${taskId}`]: dirty },
      }))
    },

    isTabDirty(paneId, taskId): boolean {
      return (useWorkspaceStore.getState().dirtyTabs ?? {})[`${paneId}:${taskId}`] ?? false
    },

    setOpenspecExpanded(paneId, taskId, open) {
      set((s) => ({
        openspecExpanded: { ...s.openspecExpanded, [`${paneId}:${taskId}`]: open },
      }))
    },

    resetAll() {
      const leaf = makeLeaf()
      set({
        root: leaf,
        activePaneId: leaf.id,
        recentlyClosed: [],
        innerSubTab: {},
        dirtyTabs: {},
        openspecExpanded: {},
      })
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFirstLeafId(root: PaneNode, excludeId: string): string {
  if (root.kind === 'leaf') return root.id !== excludeId ? root.id : ''
  for (const child of root.children) {
    const id = findFirstLeafId(child, excludeId)
    if (id) return id
  }
  return ''
}

function updateSizes(root: PaneNode, splitId: string, sizes: number[]): PaneNode {
  if (root.kind === 'leaf') return root
  if (root.id === splitId) return { ...root, sizes }
  const newChildren = root.children.map((c) => updateSizes(c, splitId, sizes))
  if (newChildren.every((c, i) => c === root.children[i])) return root
  return { ...root, children: newChildren }
}

function findTabInTree(root: PaneNode, tabId: string): { paneId: string } | null {
  if (root.kind === 'leaf') {
    return root.tabs.some((t) => t.id === tabId) ? { paneId: root.id } : null
  }
  for (const child of root.children) {
    const found = findTabInTree(child, tabId)
    if (found) return found
  }
  return null
}
