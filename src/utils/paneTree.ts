// Pure pane-tree helpers for multi-tab workspace.
// All functions return new immutable trees — callers own mutation via the store.

// ── 2.1 Discriminated tab identifier ─────────────────────────────────────────

// Discriminated tab identifier — task tabs or OpenSpec doc tabs.
export type TaskTab = { kind: 'task'; id: string }
export type DocTab  = { kind: 'doc';  id: string; change: string; artifact: string }
export type TabId   = TaskTab | DocTab

export function docTabId(change: string, artifact: string): string {
  return `doc:${change}:${artifact}`
}

export type LeafPane = {
  kind: 'leaf'
  id: string
  tabs: TabId[]                     // tab objects in display order
  pinned: Record<string, boolean>   // tab id → true if pinned
  activeTabId: string | null
}

export type SplitPane = {
  kind: 'split'
  id: string
  direction: 'horizontal' | 'vertical'
  children: PaneNode[]              // always length 2
  sizes: number[]                   // percentages summing to 100
}

export type PaneNode = LeafPane | SplitPane

// ── 2.2 findLeaf / replaceLeaf ────────────────────────────────────────────────

export function findLeaf(root: PaneNode, paneId: string): LeafPane | null {
  if (root.kind === 'leaf') return root.id === paneId ? root : null
  for (const child of root.children) {
    const found = findLeaf(child, paneId)
    if (found) return found
  }
  return null
}

export function replaceLeaf(
  root: PaneNode,
  paneId: string,
  fn: (leaf: LeafPane) => LeafPane,
): PaneNode {
  if (root.kind === 'leaf') return root.id === paneId ? fn(root) : root
  const newChildren = root.children.map((c) => replaceLeaf(c, paneId, fn))
  // Referential equality short-circuit: avoid allocating new node if nothing changed.
  if (newChildren.every((c, i) => c === root.children[i])) return root
  return { ...root, children: newChildren }
}

// ── 2.3 splitLeaf ─────────────────────────────────────────────────────────────

export function splitLeaf(
  root: PaneNode,
  paneId: string,
  direction: 'horizontal' | 'vertical',
  newPaneId: string,
  position: 'before' | 'after' = 'after',
): PaneNode {
  if (root.kind === 'leaf') {
    if (root.id !== paneId) return root
    const sibling: LeafPane = {
      kind: 'leaf',
      id: newPaneId,
      tabs: [],
      pinned: {},
      activeTabId: null,
    }
    const children: PaneNode[] = position === 'after' ? [root, sibling] : [sibling, root]
    const split: SplitPane = {
      kind: 'split',
      id: crypto.randomUUID(),
      direction,
      children,
      sizes: [50, 50],
    }
    return split
  }
  const newChildren = root.children.map((c) => splitLeaf(c, paneId, direction, newPaneId, position))
  if (newChildren.every((c, i) => c === root.children[i])) return root
  return { ...root, children: newChildren }
}

// ── 2.4 collapseEmptyParents ──────────────────────────────────────────────────

// collapseHint is carried externally: the caller sets it on a specific leaf ID
// to signal "this leaf just emptied via a close-batch; collapse its parent".
export function collapseEmptyParents(
  root: PaneNode,
  collapseHintId: string,
): PaneNode {
  if (root.kind === 'leaf') return root

  const newChildren = root.children.map((c) =>
    collapseEmptyParents(c, collapseHintId),
  ) as PaneNode[]

  // Look for an empty leaf child that carries the hint.
  const emptyHintIdx = newChildren.findIndex(
    (c) => c.kind === 'leaf' && c.id === collapseHintId && c.tabs.length === 0,
  )

  if (emptyHintIdx !== -1) {
    // Unwrap: the surviving sibling replaces this split node.
    const survivingIdx = emptyHintIdx === 0 ? 1 : 0
    return newChildren[survivingIdx]
  }

  if (newChildren.every((c, i) => c === root.children[i])) return root
  return { ...root, children: newChildren }
}

// ── 2.5 nextTabAfterClose ─────────────────────────────────────────────────────

export function nextTabAfterClose(
  leaf: LeafPane,
  closedTabId: string,
): string | null {
  const idx = leaf.tabs.findIndex((t) => t.id === closedTabId)
  if (idx === -1) return leaf.activeTabId
  const remaining = leaf.tabs.filter((t) => t.id !== closedTabId)
  if (remaining.length === 0) return null
  // Prefer right neighbor, fall back to left.
  return remaining[Math.min(idx, remaining.length - 1)].id
}
