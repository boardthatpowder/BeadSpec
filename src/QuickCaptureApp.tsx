import { useEffect, useRef, useState, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emitTo, listen } from '@tauri-apps/api/event'
import { load } from '@tauri-apps/plugin-store'
import { commands } from './bindings'
import type { WorkspaceContext } from './bindings'
import { ACTIVE_PROJECT_EVENT } from './hooks/useProject'
import type { ActiveProjectChangedPayload } from './hooks/useProject'
import './index.css'

// Helper: unwrap tauri-specta typed Result
async function unwrap<T>(
  result: Promise<{ status: 'ok'; data: T } | { status: 'error'; error: string }>
): Promise<T> {
  const r = await result
  if (r.status === 'error') throw new Error(r.error)
  return r.data
}

// Derive label chips from WorkspaceContext (omit empty/unknown values)
function contextToChips(ctx: WorkspaceContext): string[] {
  const chips: string[] = []
  if (ctx.label_branch && ctx.branch && ctx.branch !== 'unknown') {
    chips.push(ctx.label_branch)
  }
  if (ctx.label_worktree && ctx.label_worktree !== 'worktree:unknown') {
    chips.push(ctx.label_worktree)
  }
  if (ctx.label_repo && ctx.label_repo !== 'repo:unknown') {
    chips.push(ctx.label_repo)
  }
  return chips
}

export default function QuickCaptureApp() {
  const [title, setTitle] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [loadingProject, setLoadingProject] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const appWindow = getCurrentWindow()

  const loadActiveProject = useCallback(async (pathOverride?: string | null) => {
    try {
      let path = pathOverride
      if (path === undefined) {
        const store = await load('app.json')
        path = await store.get<string>('last-active-project') ?? null
      }
      setProjectPath(path)
      if (path) {
        const ctx = await unwrap(commands.getWorkspaceContext(path))
        setChips(contextToChips(ctx))
      } else {
        setChips([])
      }
    } catch {
      setProjectPath(null)
      setChips([])
    } finally {
      setLoadingProject(false)
    }
  }, [])

  // Load on mount and keep in sync when main window changes the active project
  useEffect(() => {
    loadActiveProject()
    const unlisten = listen<ActiveProjectChangedPayload>(
      ACTIVE_PROJECT_EVENT,
      (e) => loadActiveProject(e.payload.path),
    )
    return () => { unlisten.then(fn => fn()) }
  }, [loadActiveProject])

  // Auto-focus input when window becomes visible
  useEffect(() => {
    const focusInput = () => {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
    // Focus immediately on mount (window was just shown)
    focusInput()

    // Also listen for future window focus events
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) focusInput()
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const hide = useCallback(() => {
    setTitle('')
    setError(null)
    setSubmitError(null)
    appWindow.hide().catch(e => console.error('[QuickCapture] hide failed:', e))
  }, [appWindow])

  // Blur-to-close: hide when window loses focus
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) appWindow.hide().catch(() => {})
    })
    return () => { unlisten.then(fn => fn()) }
  }, [appWindow])

  const handleSubmit = useCallback(async () => {
    if (submitting || !projectPath) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title required')
      return
    }
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      // Create the issue
      const result = await unwrap(commands.createTask(projectPath, trimmedTitle, null, null, null))

      // Parse the issue ID from the output (bd create prints "Created issue: BEADSPEC-xxxx")
      const idMatch = result.output.match(/([A-Z]+-[a-z0-9]+)/i)
      const issueId = idMatch ? idMatch[1] : result.optimistic_id

      // Add workspace context labels to the new issue
      for (const chip of chips) {
        try {
          await unwrap(commands.addLabel(projectPath, issueId, chip))
        } catch {
          // Label failures are non-fatal
        }
      }

      // Notify main window
      await emitTo('main', 'quick-capture://issue-created', { id: issueId })

      hide()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [title, chips, submitting, projectPath, hide])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        hide()
      }
    },
    [handleSubmit, hide]
  )

  const removeChip = (chip: string) => {
    setChips(cs => cs.filter(c => c !== chip))
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-0 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl h-full overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-neutral-800">
        <span className="text-sm font-semibold text-neutral-100">Quick Capture</span>
        <button
          onClick={hide}
          aria-label="Close"
          className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 rounded"
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      {loadingProject ? (
        <div className="flex flex-col flex-1 items-center justify-center px-5 py-4">
          <span className="text-neutral-500 text-sm">Loading…</span>
        </div>
      ) : !projectPath ? (
        <div className="flex flex-col flex-1 items-center justify-center gap-1.5 px-5 py-4 text-center">
          <span className="text-neutral-300 text-sm font-medium">No active project</span>
          <span className="text-neutral-500 text-xs">Open a project in BeadSpec to use Quick Capture.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4 flex-1">
          {/* Title input */}
          <div className="flex flex-col gap-1">
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                if (error) setError(null)
              }}
              placeholder="Issue title…"
              className={[
                'w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-neutral-100 text-sm',
                'placeholder-neutral-500 outline-none transition-all',
                'focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60',
                error ? 'border-red-500' : 'border-neutral-700',
              ].join(' ')}
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <span className="text-red-400 text-xs">{error}</span>
            )}
          </div>

          {/* Label chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map(chip => (
                <span
                  key={chip}
                  className="flex items-center gap-1 bg-neutral-800 text-neutral-300 text-xs px-2 py-0.5 rounded-full border border-neutral-700"
                >
                  {chip}
                  <button
                    type="button"
                    aria-label={`Remove ${chip}`}
                    onClick={() => removeChip(chip)}
                    className="text-neutral-500 hover:text-neutral-200 leading-none transition-colors"
                    tabIndex={-1}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="border border-red-900/50 bg-red-950/30 text-red-300 text-xs px-3 py-2 rounded-md break-words">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Footer / actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800">
        <span className="text-neutral-600 text-xs">
          <kbd className="font-sans">Esc</kbd> to cancel
        </span>
        {projectPath && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={[
              'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all',
              submitting
                ? 'bg-blue-600 text-white opacity-50 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/30',
            ].join(' ')}
          >
            {submitting ? 'Creating…' : 'Create Issue'}
          </button>
        )}
      </div>
    </div>
  )
}
