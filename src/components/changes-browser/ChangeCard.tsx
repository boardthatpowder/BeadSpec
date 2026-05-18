import { useEffect, useMemo, useState } from 'react'
import { getChangeProgress, getChangeBeadsProgress, getChangeDependencies } from '../../ipc'
import { useActiveProject } from '../../hooks/useProject'
import { useAppState } from '../../contexts/HashStateContext'
import { useWorkspaceStore } from '../../stores/workspace'
import { Tooltip } from '../ui/Tooltip'
import { ImportModal } from './ImportModal'
import type { ChangeBeadsProgress, ChangeDependencies, ChangeDepLink, ChangeInfo, ChangeProgress, Task } from '../../bindings'

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
  allChanges: ChangeInfo[]
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
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
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

export function ChangeCard({ change, isReadOnly = false, allTasks, allChanges }: ChangeCardProps) {
  const project = useActiveProject()
  const { setState } = useAppState()
  const openDocTab = useWorkspaceStore((s) => s.openDocTab)
  const openEpicTab = useWorkspaceStore((s) => s.openEpicTab)
  const [progress, setProgress] = useState<ChangeProgress | null>(null)
  const [beadsProgress, setBeadsProgress] = useState<ChangeBeadsProgress | null>(null)
  const [deps, setDeps] = useState<ChangeDependencies | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const changesBySlug = useMemo(() => {
    const map = new Map<string, ChangeInfo>()
    for (const c of allChanges) map.set(c.slug, c)
    return map
  }, [allChanges])

  useEffect(() => {
    if (!project) return
    getChangeProgress(project, change.name)
      .then(setProgress)
      .catch(() => setProgress({ done: 0, total: 0 }))
  }, [project, change.name, change.last_modified])

  // Beads progress is computed server-side from the project's Dolt DB so it
  // stays correct regardless of the UI's global status filter (which would
  // otherwise hide deferred/blocked/closed issues from `allTasks`).
  // Cross-reference: tasks fetched via useTasks() are status-filtered by
  // src/hooks/useHashState.ts DEFAULT_STATE → ['open', 'in_progress'].
  useEffect(() => {
    if (!project) return
    let cancelled = false
    getChangeBeadsProgress(project, change.slug)
      .then(p => { if (!cancelled) setBeadsProgress(p) })
      .catch(() => { if (!cancelled) setBeadsProgress({ done: 0, total: 0, epic_id: null }) })
    return () => { cancelled = true }
  }, [project, change.slug, allTasks])

  // Inter-change dependency chips. Only fetch once we know the change has
  // an imported epic — cards without an epic make no extra IPC call.
  // Keying on allTasks lets `bd dep add/remove` (which mutates the
  // dependencies table) trigger a refresh through the existing task-cache
  // invalidation event.
  useEffect(() => {
    if (!project || !beadsProgress?.epic_id) {
      setDeps(null)
      return
    }
    let cancelled = false
    getChangeDependencies(project, change.slug)
      .then(d => { if (!cancelled) setDeps(d) })
      .catch(() => { if (!cancelled) setDeps({ upstream: [], downstream: [] }) })
    return () => { cancelled = true }
  }, [project, change.slug, beadsProgress?.epic_id, allTasks])

  const changeStatus: ChangeStatus = change.is_archived
    ? 'archived'
    : !progress || progress.total === 0
    ? 'draft'
    : progress.done === progress.total
    ? 'complete'
    : progress.done > 0
    ? 'in_progress'
    : 'not_started'

  // Use the server-computed epic_id so the "imported" pill is immune to the
  // UI's global status filter. The pill only needs the ID — TaskDetailPanel
  // fetches its own data when navigated to.
  const importedEpicId = beadsProgress?.epic_id ?? null

  const beadsDone = beadsProgress?.done ?? 0
  const beadsTotal = beadsProgress?.total ?? 0

  return (
    <div
      role={importedEpicId ? 'button' : undefined}
      tabIndex={importedEpicId ? 0 : undefined}
      aria-label={importedEpicId ? `Open ${change.name} dashboard` : undefined}
      onClick={() => { if (importedEpicId) openEpicTab(change.name, importedEpicId) }}
      className={[
        'border rounded-xl px-4 py-3 flex flex-col gap-2.5 transition-colors',
        importedEpicId ? 'cursor-pointer' : '',
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
          {importedEpicId ? (
            <button
              onClick={(e) => { e.stopPropagation(); setState({ view: 'all', taskId: importedEpicId }) }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-400 border border-blue-900/50 flex-shrink-0 hover:bg-blue-950/70 transition-colors"
            >
              imported → {importedEpicId}
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
              onClick={(e) => { e.stopPropagation(); openDocTab(change.name, `specs/${specId}/spec.md`); setState({ view: undefined }) }}
              className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 transition-colors"
            >
              spec: {specId}
            </button>
          ))}
        </div>

        {!isReadOnly && !importedEpicId && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowImportModal(true) }}
            className="px-2.5 py-1 text-xs font-medium text-neutral-300 border border-neutral-700 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors whitespace-nowrap"
          >
            Import to beads
          </button>
        )}
      </div>

      {deps && (deps.upstream.length > 0 || deps.downstream.length > 0) && (
        <div className="flex flex-col gap-1 pt-1 border-t border-neutral-800/60">
          {deps.upstream.length > 0 && (
            <DependencyChipRow
              label="Blocked by"
              links={deps.upstream}
              direction="upstream"
              changesBySlug={changesBySlug}
              onOpenEpic={(epicId) => setState({ view: 'all', taskId: epicId })}
            />
          )}
          {deps.downstream.length > 0 && (
            <DependencyChipRow
              label="Blocking"
              links={deps.downstream}
              direction="downstream"
              changesBySlug={changesBySlug}
              onOpenEpic={(epicId) => setState({ view: 'all', taskId: epicId })}
            />
          )}
        </div>
      )}

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

interface DependencyChipRowProps {
  label: string
  links: ChangeDepLink[]
  direction: 'upstream' | 'downstream'
  changesBySlug: Map<string, ChangeInfo>
  onOpenEpic: (epicId: string) => void
}

function DependencyChipRow({ label, links, direction, changesBySlug, onOpenEpic }: DependencyChipRowProps) {
  const chipPalette =
    direction === 'upstream'
      ? 'bg-rose-950/30 text-rose-300 border border-rose-900/40 hover:bg-rose-950/60'
      : 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/40 hover:bg-emerald-950/60'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-neutral-600 font-medium w-14 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-wrap">
        {links.map(link => {
          const target = changesBySlug.get(link.slug)
          const archived = target?.is_archived ?? false
          return (
            <button
              key={link.epic_id}
              onClick={() => onOpenEpic(link.epic_id)}
              aria-label={`${label} ${link.slug} — open epic ${link.epic_id}`}
              className={[
                'text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors',
                chipPalette,
                archived ? 'opacity-60' : '',
              ].join(' ')}
            >
              {link.slug}
            </button>
          )
        })}
      </div>
    </div>
  )
}
