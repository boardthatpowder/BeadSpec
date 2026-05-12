// Debounced persistence for the workspace store → Tauri plugin-store layout.json.
// Implements tasks 3.4 (persistence adapter) and 3.5 (boot-seed from hash).
import { load } from '@tauri-apps/plugin-store'
import { useWorkspaceStore } from './workspace'
import type { WorkspaceState } from './workspace'
import type { PaneNode, TabId } from '../utils/paneTree'

const STORE_FILE = 'layout.json'
const WORKSPACE_KEY = 'workspace'
const DEBOUNCE_MS = 250

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ── Task 3.4 — write (debounced) ─────────────────────────────────────────────

export function schedulePersist(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    await persistNow()
  }, DEBOUNCE_MS)
}

async function persistNow(): Promise<void> {
  try {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: false })
    const { root, activePaneId, recentlyClosed } = useWorkspaceStore.getState()
    await store.set(WORKSPACE_KEY, { root, activePaneId, recentlyClosed })
    await store.save()
  } catch (e) {
    console.warn('[workspace] persist failed:', e)
  }
}

// ── Migration: coerce legacy string tabs to TabId objects ────────────────────

function migrateTabIds(node: PaneNode): PaneNode {
  if (node.kind === 'leaf') {
    const tabs = (node.tabs as unknown[]).map((t): TabId =>
      typeof t === 'string' ? { kind: 'task', id: t } : (t as TabId)
    )
    return { ...node, tabs }
  }
  return { ...node, children: node.children.map(migrateTabIds) }
}

// ── Task 3.4 — read (cold boot) ───────────────────────────────────────────────

export async function loadWorkspace(): Promise<void> {
  try {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: false })
    const persisted = await store.get<Partial<WorkspaceState>>(WORKSPACE_KEY)
    if (persisted && persisted.root && persisted.activePaneId) {
      useWorkspaceStore.setState({
        root: migrateTabIds(persisted.root as PaneNode),
        activePaneId: persisted.activePaneId,
        recentlyClosed: persisted.recentlyClosed ?? [],
      })
    }
  } catch (e) {
    console.warn('[workspace] load failed — starting with empty workspace:', e)
  }
}

// ── Task 3.5 — boot-seed from URL hash ────────────────────────────────────────

export function seedFromHash(): void {
  try {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    const taskId = params.get('taskId')
    if (!taskId) return

    const { root } = useWorkspaceStore.getState()
    // Only seed if the root leaf is genuinely empty.
    if (root.kind === 'leaf' && root.tabs.length === 0) {
      useWorkspaceStore.getState().openPreview(taskId)
    }
  } catch {
    // Hash parsing failures are non-fatal.
  }
}

// ── Wire store subscriptions on init ─────────────────────────────────────────

export async function initWorkspacePersistence(): Promise<void> {
  await loadWorkspace()
  seedFromHash()

  // Subscribe to state changes — schedule a debounced write on each mutation.
  useWorkspaceStore.subscribe(() => schedulePersist())
}
