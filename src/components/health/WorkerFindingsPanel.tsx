import type { WorkerFinding } from '../../bindings'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkerFindings } from '../../hooks/useWorkerFindings'
import { formatSeverityBreakdown, formatWorkerFindingDate } from '../../lib/worker-findings'
import { useWorkspaceStore } from '../../stores/workspace'
import { formatLabel, labelChipClass, PRIORITY_STYLE } from '../task-list/TaskListItem'

type WorkerGroup = {
  worker: string
  findings: WorkerFinding[]
}

function groupFindings(findings: WorkerFinding[]): WorkerGroup[] {
  const groups = new Map<string, WorkerFinding[]>()
  for (const finding of findings) {
    const workerFindings = groups.get(finding.worker) ?? []
    workerFindings.push(finding)
    groups.set(finding.worker, workerFindings)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([worker, workerFindings]) => ({ worker, findings: workerFindings }))
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Failed to load worker findings.'
}

export function WorkerFindingsPanel() {
  const project = useActiveProject()
  const openPinned = useWorkspaceStore(state => state.openPinned)
  const { data: findings = [], isLoading, error } = useWorkerFindings(project)
  const groups = groupFindings(findings)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin block" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="max-w-md rounded border border-red-800/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {errorMessage(error)}
        </span>
      </div>
    )
  }

  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-neutral-600 text-sm text-center">
          No worker findings. Run /audit, /ruflo-loop testgaps, or /ruflo-cost to generate some.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total worker findings</span>
        <span className="text-xs tabular-nums text-neutral-300">{findings.length}</span>
      </div>

      {groups.map(group => {
        const severityBreakdown = formatSeverityBreakdown(group.findings.map(finding => finding.priority))

        return (
          <section key={group.worker} className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-48 truncate ${labelChipClass(`worker:${group.worker}`)}`}
                title={`worker:${group.worker}`}
              >
                {formatLabel(`worker:${group.worker}`)}
              </span>
              <span className="text-[10px] text-neutral-500 tabular-nums">
                {group.findings.length} total
              </span>
              {severityBreakdown && (
                <span className="text-[10px] text-neutral-600">
                  ({severityBreakdown})
                </span>
              )}
            </div>

            <div className="border border-neutral-800 rounded-lg overflow-hidden">
              {group.findings.map(finding => (
                <button
                  key={finding.issue_id}
                  type="button"
                  onClick={() => openPinned(finding.issue_id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left bg-neutral-950 hover:bg-neutral-900 border-b border-neutral-800/70 last:border-b-0 transition-colors"
                >
                  <span className="w-24 text-[10px] font-mono text-neutral-500 truncate">
                    {finding.issue_id}
                  </span>
                  <span className={`w-7 text-[10px] tabular-nums ${PRIORITY_STYLE[finding.priority] ?? 'text-neutral-600'}`}>
                    P{finding.priority}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-neutral-300 truncate">
                    {finding.title}
                  </span>
                  <span className="text-[10px] text-neutral-600 tabular-nums flex-shrink-0">
                    {formatWorkerFindingDate(finding.created_at)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
