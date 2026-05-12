import { useState, useEffect, useRef } from 'react'
import { commands, unwrap } from '../../ipc'
import type { ProjectMeta } from '../../bindings'
import { useProjectStore, connectProjectWithContext } from '../../hooks/useProject'
import { usePendingEdits } from '../../hooks/usePendingEdits'
import { useAppState } from '../../contexts/HashStateContext'
import { useWorkspaceStore } from '../../stores/workspace'
import { writeGroupBy } from '../../stores/layoutStore'

function parseConnectError(e: unknown): string {
  const raw = typeof e === 'string' ? e : null
  if (raw) {
    if (raw.startsWith('port_not_configured')) {
      return 'No Dolt port configured — start the server with `bd dolt-start`'
    }
    if (raw.startsWith('server_not_running:')) {
      const port = raw.slice('server_not_running:'.length)
      return `Dolt server not running on port ${port} — run \`bd dolt-start\``
    }
    if (raw.startsWith('connection_failed:')) {
      const reason = raw.slice('connection_failed:'.length)
      return `Cannot connect to Dolt: ${reason}`
    }
    return raw
  }
  return 'Failed to connect to project'
}

export function ProjectSwitcher() {
  const { activeProject, setActiveProject } = useProjectStore()
  const { setState: setHashState } = useAppState()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [addingPath, setAddingPath] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasPendingEdits = usePendingEdits(s => s.hasPendingEdits)

  const activeName = projects.find(p => p.project_path === activeProject)?.name
    ?? (activeProject ? activeProject.split('/').pop() : 'No project')

  // Load projects on mount
  useEffect(() => {
    unwrap(commands.listProjects()).then(setProjects).catch(console.error)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const switchProject = async (path: string) => {
    if (hasPendingEdits) {
      const ok = window.confirm('You have unsaved changes. Discard and switch project?')
      if (!ok) return
      usePendingEdits.getState().setHasPendingEdits(false)
    }
    setConnectError(null)
    setConnecting(true)
    setOpen(false)

    // Clear active project and workspace context BEFORE awaiting connect so React Query
    // hooks stop firing queries against the old pool (prevents connection contention).
    const previous = activeProject
    setActiveProject(null)

    try {
      await connectProjectWithContext(path)
      // Reset all project-scoped UI state
      setHashState({
        view: undefined,
        taskId: undefined,
        filters: { status: ['open', 'in_progress'] },
        groupBy: null,
        healthTab: undefined,
        workspaceScope: undefined,
      })
      useWorkspaceStore.getState().resetAll()
      writeGroupBy(null)
      // Release the previous project's pool; fire-and-forget
      if (previous && previous !== path) {
        commands.disconnectProject(previous)
      }
    } catch (e) {
      console.error('Failed to connect:', e)
      setConnectError(parseConnectError(e))
      // Restore previous project so the user is not stranded
      setActiveProject(previous)
    } finally {
      setConnecting(false)
    }
  }

  const addProject = async () => {
    if (!addingPath.trim()) return
    setConnecting(true)
    try {
      const meta = await unwrap(commands.connectProject(addingPath.trim()))
      setProjects(prev => [...prev.filter(p => p.project_path !== meta.project_path), meta])
      // connectProjectWithContext also sets activeProject via the store
      await connectProjectWithContext(meta.project_path)
      setAddingPath('')
      setShowAdd(false)
      setOpen(false)
    } catch (e) {
      console.error('Failed to add project:', e)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-neutral-200 hover:bg-neutral-800 transition-colors"
        disabled={connecting}
      >
        <span className="font-medium">{connecting ? '…' : activeProject ? `Project: ${activeName}` : activeName}</span>
        <svg className="w-3 h-3 text-neutral-500" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L1 3h10L6 8z"/>
        </svg>
      </button>

      {connectError && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-400 bg-neutral-900 border border-red-800 rounded px-2 py-1.5 z-50 max-w-xs whitespace-pre-wrap">
          {connectError}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 py-1">
          {projects.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">No projects found</div>
          )}
          {projects.map(p => (
            <button
              key={p.project_path}
              onClick={() => switchProject(p.project_path)}
              className={[
                'w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors flex items-center justify-between',
                p.project_path === activeProject ? 'text-blue-400' : 'text-neutral-200',
              ].join(' ')}
            >
              <span>{p.name}</span>
              {p.project_path === activeProject && (
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-neutral-800 mt-1 pt-1">
            {showAdd ? (
              <div className="px-2 py-1.5 flex gap-1.5">
                <input
                  autoFocus
                  value={addingPath}
                  onChange={e => setAddingPath(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addProject()
                    if (e.key === 'Escape') setShowAdd(false)
                  }}
                  placeholder="/path/to/project"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
                />
                <button
                  onClick={addProject}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full text-left px-3 py-2 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                + Add project by path…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
