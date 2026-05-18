import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '../../stores/workspace'
import { useShallow } from 'zustand/react/shallow'
import { Tooltip } from '../ui/Tooltip'
import { useAppState } from '../../contexts/HashStateContext'
import { parsePausedNote } from '../../lib/parsePausedNote'
import {
  listChanges,
  readChangeArtifact,
  getChangeProgress,
  runOpenspecValidate,
  recordOpenspecValidation,
  listOpenspecValidations,
} from '../../ipc'
import { commands, unwrap } from '../../ipc'
import type { ChangeInfo, ValidationHistoryEntry, ValidationResult } from '../../bindings'

type ContainerMode = 'section' | 'tab'

interface OpenSpecPanelProps {
  changeName: string
  containerMode?: ContainerMode
  projectRoot: string
  taskTitle: string
  taskStatus: string
  taskLabels?: string[]
  taskNotes?: string | null
  scopeChangeChild?: { id: string; title: string } | null
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
  const queryClient = useQueryClient()

  async function handleValidate() {
    setLoading(true)
    setErr(null)
    try {
      const r = await runOpenspecValidate(projectRoot, changeName)
      setResult(r)
      setTimestamp(new Date().toLocaleTimeString())
      recordOpenspecValidation(projectRoot, changeName, JSON.stringify(r))
        .then(() => queryClient.invalidateQueries({ queryKey: ['validation-history', projectRoot, changeName] }))
        .catch(e => console.warn('[openspec] validation history record failed', e))
    } catch (e) {
      setErr(String(e))
      recordOpenspecValidation(projectRoot, changeName, JSON.stringify({ valid: false, errors: [String(e)] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ['validation-history', projectRoot, changeName] }))
        .catch(err => console.warn('[openspec] validation history record failed', err))
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

function ValidationHistory({ projectRoot, changeName }: { projectRoot: string; changeName: string }) {
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const { data: rufloAvailable = false } = useQuery({
    queryKey: ['ruflo-version'],
    queryFn: async () => { await unwrap(commands.rufloVersionProbe()); return true },
    staleTime: Infinity,
    retry: false,
  })
  const history = useQuery<ValidationHistoryEntry[]>({
    queryKey: ['validation-history', projectRoot, changeName],
    queryFn: () => listOpenspecValidations(projectRoot, changeName),
    enabled: rufloAvailable,
    staleTime: 30_000,
    retry: false,
  })
  if (!rufloAvailable) {
    return <div className="text-xs text-neutral-600">Validation history requires the ruflo CLI.</div>
  }
  const entries = history.data ?? []
  const visible = showAll ? entries : entries.slice(0, 5)
  return (
    <details className="rounded border border-neutral-800/60 bg-neutral-950/30">
      <summary className="cursor-pointer px-2 py-1.5 text-xs text-neutral-400">Validation history ({entries.length})</summary>
      <div className="border-t border-neutral-800/60">
        {entries.length === 0 ? (
          <div className="px-2 py-2 text-xs text-neutral-600">No validations recorded yet — click Re-validate above.</div>
        ) : visible.map((entry, idx) => {
          const open = expanded.has(idx)
          return (
            <button key={`${entry.ts_epoch}-${idx}`} onClick={() => setExpanded(prev => {
              const next = new Set(prev)
              if (next.has(idx)) next.delete(idx)
              else next.add(idx)
              return next
            })} className="block w-full border-b border-neutral-800/40 px-2 py-2 text-left text-xs">
              <div className="flex items-center gap-2">
                <span title={entry.ts_iso} className="text-neutral-500">{new Date(entry.ts_iso).toLocaleString()}</span>
                <span className={entry.valid ? 'text-green-400' : 'text-red-400'}>{entry.valid ? 'pass' : 'fail'}</span>
                <span className="truncate text-neutral-600">{entry.valid ? 'No errors' : entry.errors[0]}</span>
              </div>
              {open && !entry.valid && <ul className="mt-1 list-disc pl-4 text-red-300">{entry.errors.map(e => <li key={e}>{e}</li>)}</ul>}
            </button>
          )
        })}
        {entries.length > 5 && (
          <button onClick={() => setShowAll(v => !v)} className="px-2 py-2 text-xs text-blue-400">{showAll ? 'Show fewer' : `Showing 5 of ${entries.length} · Show all`}</button>
        )}
      </div>
    </details>
  )
}

function PausedBanner({ labels, notes, scopeChangeChild }: { labels: string[]; notes?: string | null; scopeChangeChild?: { id: string; title: string } | null }) {
  const { setState } = useAppState()
  if (!labels.includes('openspec:paused')) return null
  const reason = parsePausedNote(notes) ?? '(no reason recorded)'
  return (
    <div className="rounded border border-violet-800/40 bg-violet-950/30 px-2 py-1.5 text-xs text-violet-300">
      <div>Paused: {reason}</div>
      {scopeChangeChild ? (
        <button
          onClick={() => setState({ view: 'all', taskId: scopeChangeChild.id })}
          className="mt-1 text-left text-violet-200 underline decoration-violet-600 underline-offset-2"
        >
          Resolves: {scopeChangeChild.id} — {scopeChangeChild.title}
        </button>
      ) : (
        <div className="mt-1 text-violet-400/60">No scope-change child detected yet</div>
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
  taskLabels = [],
  taskNotes,
  scopeChangeChild,
}: {
  changeName: string
  projectRoot: string
  taskTitle: string
  taskStatus: string
  taskLabels?: string[]
  taskNotes?: string | null
  scopeChangeChild?: { id: string; title: string } | null
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
      <PausedBanner labels={taskLabels} notes={taskNotes} scopeChangeChild={scopeChangeChild} />
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
      <ValidationHistory projectRoot={projectRoot} changeName={changeName} />
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
  taskLabels,
  taskNotes,
  scopeChangeChild,
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
          taskLabels={taskLabels}
          taskNotes={taskNotes}
          scopeChangeChild={scopeChangeChild}
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
          taskLabels={taskLabels}
          taskNotes={taskNotes}
          scopeChangeChild={scopeChangeChild}
        />
      </div>
    </details>
  )
}
