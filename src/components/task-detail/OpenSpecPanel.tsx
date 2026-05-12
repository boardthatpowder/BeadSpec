import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWorkspaceStore } from '../../stores/workspace'
import { useShallow } from 'zustand/react/shallow'
import { Tooltip } from '../ui/Tooltip'
import {
  listChanges,
  readChangeArtifact,
  getChangeProgress,
  runOpenspecValidate,
} from '../../ipc'
import type { ChangeInfo, ValidationResult } from '../../bindings'

type ContainerMode = 'section' | 'tab'

interface OpenSpecPanelProps {
  changeName: string
  containerMode?: ContainerMode
  projectRoot: string
  taskTitle: string
  taskStatus: string
  paneId?: string
  taskId?: string
}

// ---------------------------------------------------------------------------
// Drift detection helpers
// ---------------------------------------------------------------------------
type DriftType = 'CLOSED_BUT_UNCHECKED' | 'OPEN_BUT_CHECKED' | null

function detectDrift(
  tasksContent: string,
  taskTitle: string,
  taskStatus: string,
): DriftType {
  const titleLower = taskTitle.trim().toLowerCase()
  // Parse checkbox lines: - [ ] text  or  - [x] text
  const checkboxRe = /^\s*-\s+\[([ xX])\]\s+(.+)$/
  for (const line of tasksContent.split('\n')) {
    const m = checkboxRe.exec(line)
    if (!m) continue
    const checked = m[1].toLowerCase() === 'x'
    const text = m[2].trim().toLowerCase()
    // Fuzzy match: either substring of the other
    if (titleLower.includes(text) || text.includes(titleLower)) {
      const isClosed = taskStatus === 'closed'
      if (isClosed && !checked) return 'CLOSED_BUT_UNCHECKED'
      if (!isClosed && checked) return 'OPEN_BUT_CHECKED'
      return null
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Sub-section: Artifact links
// ---------------------------------------------------------------------------
const FIXED_ARTIFACTS = ['proposal.md', 'design.md', 'tasks.md'] as const

function ArtifactLink({
  label,
  artifact,
  changeName,
  projectRoot,
  archived,
}: {
  label: string
  artifact: string
  changeName: string
  projectRoot: string
  archived: boolean
}) {
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)
  const subdir = archived ? `archive/${changeName}` : changeName
  const filePath = `${projectRoot}/openspec/changes/${subdir}/${artifact}`

  // Check if file is readable by fetching it
  const { data: content, isError } = useQuery<string>({
    queryKey: ['openspec-artifact', projectRoot, changeName, artifact],
    queryFn: () => readChangeArtifact(projectRoot, changeName, artifact),
    retry: false,
    staleTime: 60_000,
  })

  const exists = !isError && content !== undefined

  if (!exists) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-not-allowed">
        <span className="text-neutral-700">○</span>
        <span className={archived ? 'opacity-50' : ''}>{label}</span>
      </span>
    )
  }

  return (
    <Tooltip label="Open document" description={filePath}>
      <button
        onClick={() => openDocTab(changeName, artifact)}
        className={[
          'flex items-center gap-1.5 text-xs text-left transition-colors',
          archived
            ? 'text-neutral-500 opacity-50 hover:opacity-75 hover:text-neutral-400'
            : 'text-blue-400 hover:text-blue-300',
        ].join(' ')}
      >
        <span className="text-neutral-500">↗</span>
        {label}
      </button>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Sub-section: Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({
  done,
  total,
}: {
  done: number
  total: number
}) {
  if (total === 0) return null

  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">Progress</span>
        <span className={allDone ? 'text-green-400' : 'text-neutral-400'}>
          {done} / {total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-all',
            allDone ? 'bg-green-500' : 'bg-blue-500',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-section: Validate
// ---------------------------------------------------------------------------
function ValidateSection({
  projectRoot,
  changeName,
  archived,
}: {
  projectRoot: string
  changeName: string
  archived: boolean
}) {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleValidate() {
    setLoading(true)
    setErr(null)
    try {
      const r = await runOpenspecValidate(projectRoot, changeName)
      setResult(r)
      setTimestamp(new Date().toLocaleTimeString())
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">Validate</span>
        {!archived && (
          <button
            onClick={handleValidate}
            disabled={loading}
            className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Validating…' : 'Re-validate'}
          </button>
        )}
      </div>

      {err && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded px-2 py-1">
          {err}
        </div>
      )}

      {result === null && !err && (
        <span className="text-xs text-neutral-600">Not yet validated</span>
      )}

      {result !== null && (
        <div className="text-xs flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span
              className={result.valid ? 'text-green-400' : 'text-red-400'}
            >
              {result.valid ? '✓ Valid' : '✗ Invalid'}
            </span>
            {timestamp && (
              <span className="text-neutral-600">as of {timestamp}</span>
            )}
          </div>
          {!result.valid && result.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 pl-3 text-red-300">
              {result.errors.map((e, i) => (
                <li key={i} className="list-disc list-outside">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drift warning
// ---------------------------------------------------------------------------
function DriftWarning({ drift }: { drift: DriftType }) {
  if (!drift) return null

  const msg =
    drift === 'CLOSED_BUT_UNCHECKED'
      ? 'Issue is closed but the matching tasks.md checkbox is still unchecked.'
      : 'Issue is open but the matching tasks.md checkbox is already checked.'

  return (
    <div className="flex items-start gap-2 text-xs rounded px-2 py-1.5 bg-yellow-950/40 border border-yellow-800/40 text-yellow-300">
      <span className="flex-shrink-0">⚠</span>
      <span>Drift detected: {msg}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel body
// ---------------------------------------------------------------------------
function OpenSpecPanelBody({
  changeName,
  projectRoot,
  taskTitle,
  taskStatus,
}: {
  changeName: string
  projectRoot: string
  taskTitle: string
  taskStatus: string
}) {
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)

  // Fetch the change info to know if it is archived
  const { data: changes } = useQuery<ChangeInfo[]>({
    queryKey: ['openspec-changes', projectRoot],
    queryFn: () => listChanges(projectRoot),
    staleTime: 60_000,
  })
  const changeInfo = changes?.find((c) => c.name === changeName)
  const archived = changeInfo?.is_archived ?? false

  // Progress
  const { data: progress } = useQuery({
    queryKey: ['openspec-progress', projectRoot, changeName],
    queryFn: () => getChangeProgress(projectRoot, changeName),
    staleTime: 60_000,
  })

  // tasks.md content for drift detection
  const { data: tasksContent } = useQuery<string>({
    queryKey: ['openspec-artifact', projectRoot, changeName, 'tasks.md'],
    queryFn: () => readChangeArtifact(projectRoot, changeName, 'tasks.md'),
    retry: false,
    staleTime: 60_000,
  })

  const drift: DriftType =
    tasksContent != null
      ? detectDrift(tasksContent, taskTitle, taskStatus)
      : null

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Change name / archived badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-neutral-300">{changeName}</span>
        {archived && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-700 text-neutral-400 uppercase tracking-wide">
            archived
          </span>
        )}
      </div>

      {/* Drift warning */}
      <DriftWarning drift={drift} />

      {/* Progress */}
      {progress && (
        <ProgressBar done={progress.done} total={progress.total} />
      )}
      {progress?.total === 0 && (
        <span className="text-xs text-neutral-600">Tasks not created yet</span>
      )}

      {/* Artifact links */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400 mb-0.5">Artifacts</span>
        {FIXED_ARTIFACTS.map((artifact) => (
          <ArtifactLink
            key={artifact}
            label={artifact}
            artifact={artifact}
            changeName={changeName}
            projectRoot={projectRoot}
            archived={archived}
          />
        ))}
      </div>

      {/* Spec links */}
      {changeInfo?.specs && changeInfo.specs.length > 0 && (
        <div>
          <div className="text-xs text-neutral-500 mb-1">Specs</div>
          {changeInfo.specs.map((specId) => (
            <button
              key={specId}
              onClick={() => openDocTab(changeName, `specs/${specId}/spec.md`)}
              className="block text-xs text-purple-400 hover:text-purple-200 truncate transition-colors"
            >
              {specId}/spec.md
            </button>
          ))}
        </div>
      )}

      {/* Validate */}
      <ValidateSection
        projectRoot={projectRoot}
        changeName={changeName}
        archived={archived}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------
export function OpenSpecPanel({
  changeName,
  containerMode = 'section',
  projectRoot,
  taskTitle,
  taskStatus,
  paneId,
  taskId,
}: OpenSpecPanelProps) {
  const { openspecExpanded, setOpenspecExpanded } = useWorkspaceStore(
    useShallow(s => ({ openspecExpanded: s.openspecExpanded, setOpenspecExpanded: s.setOpenspecExpanded }))
  )

  const storeKey = paneId && taskId ? `${paneId}:${taskId}` : null
  const isExpanded = storeKey != null ? (openspecExpanded[storeKey] ?? false) : false
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // Sync DOM open state from store (handles remounts and external resets)
  useEffect(() => {
    if (detailsRef.current && storeKey != null) {
      detailsRef.current.open = isExpanded
    }
  }, [isExpanded, storeKey])

  if (containerMode === 'tab') {
    return (
      <div className="h-full overflow-y-auto p-4">
        <OpenSpecPanelBody
          changeName={changeName}
          projectRoot={projectRoot}
          taskTitle={taskTitle}
          taskStatus={taskStatus}
        />
      </div>
    )
  }

  // Default: collapsible section. Use ref+onToggle to persist open state across tab switches.
  return (
    <details
      ref={detailsRef}
      onToggle={(e) => {
        if (storeKey) setOpenspecExpanded(paneId!, taskId!, e.currentTarget.open)
      }}
      className="group rounded-lg border border-neutral-800/60 bg-neutral-900/30"
    >
      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
        <span className="text-xs text-neutral-500 group-open:rotate-90 transition-transform inline-block">
          ▶
        </span>
        <span className="text-xs font-medium text-neutral-300">OpenSpec</span>
        <span className="text-xs text-neutral-600 font-mono ml-1">{changeName}</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-neutral-800/40">
        <OpenSpecPanelBody
          changeName={changeName}
          projectRoot={projectRoot}
          taskTitle={taskTitle}
          taskStatus={taskStatus}
        />
      </div>
    </details>
  )
}
