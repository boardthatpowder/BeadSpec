import { useEffect, useState } from 'react'
import { getChangeProgress } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { useWorkspaceStore } from '../../stores/workspace'
import { Tooltip } from '../ui/Tooltip'
import { ImportModal } from './ImportModal'
import type { ChangeInfo, ChangeProgress, Task } from '../../bindings'

type ChangeStatus = 'draft' | 'not_started' | 'in_progress' | 'complete' | 'archived'

const STATUS_CONFIG: Record<ChangeStatus, { label: string; className: string }> = {
  draft:       { label: 'Draft',       className: 'bg-neutral-800/60 text-neutral-500' },
  not_started: { label: 'Not started', className: 'bg-neutral-800/60 text-neutral-400' },
  in_progress: { label: 'In progress', className: 'bg-amber-900/30 text-amber-400 border border-amber-900/50' },
  complete:    { label: 'Complete',    className: 'bg-green-900/30 text-green-400 border border-green-900/50' },
  archived:    { label: 'Archived',    className: 'bg-neutral-800/60 text-neutral-500' },
}

interface ChangeCardProps {
  change: ChangeInfo
  isReadOnly?: boolean
  allTasks: Task[]
}

function relativeTime(lastModified: string | null): string {
  if (!lastModified) return 'unknown'
  const secs = parseInt(lastModified, 10)
  if (isNaN(secs)) return 'unknown'
  const ms = secs * 1000
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ProgressBar({ done, total, color = 'blue', label }: { done: number; total: number; color?: 'blue' | 'green'; label?: string }) {
  const barColor = color === 'green' ? 'bg-green-600' : 'bg-blue-500'
  if (total === 0) {
    return <span className="text-xs text-neutral-600">No tasks yet</span>
  }
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[10px] text-neutral-600 font-medium w-8 flex-shrink-0">{label}</span>
      )}
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0">
        {done}/{total}
      </span>
    </div>
  )
}

interface ArtifactLinkProps {
  label: string
  present: boolean
  change: string
  artifact: string
}

function ArtifactLink({ label, present, change, artifact }: ArtifactLinkProps) {
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)
  const { setState } = useAppState()
  function handleClick() {
    if (!present) return
    openDocTab(change, artifact)
    setState({ view: undefined })
  }
  return (
    <Tooltip label={present ? `Open ${label}` : `${label} not present`}>
    <button
      onClick={handleClick}
      disabled={!present}
      className={[
        'px-2 py-0.5 text-[10px] font-mono rounded border transition-colors',
        present
          ? 'border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 cursor-pointer'
          : 'border-neutral-800 text-neutral-700 cursor-not-allowed opacity-40',
      ].join(' ')}
    >
      {label}
    </button>
    </Tooltip>
  )
}

export function ChangeCard({ change, isReadOnly = false, allTasks }: ChangeCardProps) {
  const project = useActiveProject()
  const { setState } = useAppState()
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)
  const [progress, setProgress] = useState<ChangeProgress | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    if (!project) return
    getChangeProgress(project, change.name)
      .then(setProgress)
      .catch(() => setProgress({ done: 0, total: 0 }))
  }, [project, change.name, change.last_modified])

  const changeStatus: ChangeStatus = change.is_archived
    ? 'archived'
    : !progress || progress.total === 0
    ? 'draft'
    : progress.done === progress.total
    ? 'complete'
    : progress.done > 0
    ? 'in_progress'
    : 'not_started'

  // Detect "already imported": find the feature/epic tracker for this change.
  // Use change.slug so archived changes (whose dir gains a YYYY-MM-DD- prefix)
  // still match the label written at import time: openspec:<original-slug>.
  const importedEpic = allTasks.find(
    t =>
      (t.task_type === 'feature' || t.task_type === 'epic') &&
      t.labels.some(l => l === `openspec:${change.slug}`)
  )

  // Beads task progress: non-feature/epic tasks tagged openspec:<slug>
  const beadsTasks = allTasks.filter(
    t =>
      t.task_type !== 'feature' &&
      t.task_type !== 'epic' &&
      t.labels.some(l => l === `openspec:${change.slug}`)
  )
  const beadsDone = beadsTasks.filter(t => t.status === 'closed').length
  const beadsTotal = beadsTasks.length

  return (
    <div
      className={[
        'border rounded-xl px-4 py-3 flex flex-col gap-2.5 transition-colors',
        change.is_archived
          ? 'border-neutral-800 bg-neutral-900/40 opacity-70'
          : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-200 truncate font-mono">
            {change.name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_CONFIG[changeStatus].className}`}>
            {STATUS_CONFIG[changeStatus].label}
          </span>
          {importedEpic ? (
            <button
              onClick={() => setState({ view: 'all', taskId: importedEpic.id })}
              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-400 border border-blue-900/50 flex-shrink-0 hover:bg-blue-950/70 transition-colors"
            >
              imported → {importedEpic.id}
            </button>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800/60 text-neutral-600 flex-shrink-0">
              not imported
            </span>
          )}
        </div>
        <span className="text-[11px] text-neutral-600 flex-shrink-0">
          {relativeTime(change.last_modified)}
        </span>
      </div>

      {/* Progress bars */}
      <div className="flex flex-col gap-1.5">
        {progress ? (
          <ProgressBar done={progress.done} total={progress.total} label={beadsTotal > 0 ? 'spec' : undefined} />
        ) : (
          <div className="h-1.5 bg-neutral-800 rounded-full animate-pulse" />
        )}
        {beadsTotal > 0 && (
          <ProgressBar done={beadsDone} total={beadsTotal} color="green" label="beads" />
        )}
      </div>

      {/* Artifact links + action row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ArtifactLink
            label="proposal"
            present={change.has_proposal}
            change={change.name}
            artifact="proposal.md"
          />
          <ArtifactLink
            label="design"
            present={change.has_design}
            change={change.name}
            artifact="design.md"
          />
          <ArtifactLink
            label="tasks"
            present={change.has_tasks}
            change={change.name}
            artifact="tasks.md"
          />
          {change.specs?.map((specId) => (
            <button
              key={specId}
              onClick={() => { openDocTab(change.name, `specs/${specId}/spec.md`); setState({ view: undefined }) }}
              className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 transition-colors"
            >
              spec: {specId}
            </button>
          ))}
        </div>

        {!isReadOnly && !importedEpic && (
          <button
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-1 text-xs font-medium text-neutral-300 border border-neutral-700 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            Import to beads
          </button>
        )}
      </div>

      {showImportModal && (
        <ImportModal
          changeName={change.name}
          changeSlug={change.slug}
          allTasks={allTasks}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}
