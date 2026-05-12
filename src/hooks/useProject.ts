import { create } from 'zustand'
import { load } from '@tauri-apps/plugin-store'
import { commands, unwrap } from '../ipc'
import type { WorkspaceContext } from '../bindings'

const STORE_KEY = 'last-active-project'
const STORE_FILE = 'app.json'

async function saveActiveProject(path: string | null) {
  try {
    const store = await load(STORE_FILE)
    await store.set(STORE_KEY, path)
  } catch { /* ignore if store not available */ }
}

interface ProjectState {
  activeProject: string | null
  activeProjectId: string | null
  workspaceContext: WorkspaceContext | null
  setActiveProject: (path: string | null, projectId?: string | null) => void
  setWorkspaceContext: (ctx: WorkspaceContext | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  activeProjectId: null,
  workspaceContext: null,
  setActiveProject: (path, projectId = null) => {
    set({ activeProject: path, activeProjectId: projectId })
    saveActiveProject(path)
  },
  setWorkspaceContext: (ctx) => set({ workspaceContext: ctx }),
}))

export function useActiveProject() {
  return useProjectStore(s => s.activeProject)
}

/** Returns the opaque project_id (SHA-256 hex) for the active project, or null. */
export function useActiveProjectId() {
  return useProjectStore(s => s.activeProjectId)
}

export function useWorkspaceContext() {
  return useProjectStore(s => s.workspaceContext)
}

/** Call once on app init to restore last project */
export async function restoreLastProject(): Promise<string | null> {
  try {
    const store = await load(STORE_FILE)
    return await store.get<string>(STORE_KEY) ?? null
  } catch {
    return null
  }
}

/**
 * Connect to a project: call connect_project, fetch workspace context,
 * and populate the store synchronously before any render sees "connected".
 */
export async function connectProjectWithContext(path: string): Promise<void> {
  // Fetch workspace context in parallel with connect_project
  const [meta, ctx] = await Promise.all([
    unwrap(commands.connectProject(path)),
    unwrap(commands.getWorkspaceContext(path)).catch(() => null),
  ])
  useProjectStore.getState().setWorkspaceContext(ctx)
  useProjectStore.getState().setActiveProject(meta.project_path, meta.project_id)
}
