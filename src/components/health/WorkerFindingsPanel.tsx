import type { ReactNode } from 'react'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkerFindings } from '../../hooks/useWorkerFindings'
import { formatAbsolute } from '../../lib/format/date'
import { PRIORITY_PALETTE } from '../../lib/palettes'
import { formatSeverityBreakdown } from '../../lib/worker-findings'
import { useWorkspaceStore } from '../../stores/workspace'
import { groupFindings } from './groupFindings'
import { formatLabel, labelChipClass } from '../task-list/TaskListItem'
import { PanelHeader } from '../shared/PanelHeader'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Failed to load worker findings.'
}

function priorityClass(priority: number) {
  const palette = PRIORITY_PALETTE[String(priority)] ?? PRIORITY_PALETTE.low
  return `${palette.text} ${priority <= 2 ? 'font-semibold' : ''}`
}

function WorkerFindingsFrame({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Worker Findings" />
      <div className="flex-1 overflow-auto px-5 py-4">
        {children}
      </div>
    </div>
  )
}

export function WorkerFindingsPanel() {
  const project = useActiveProject()
  const openPinned = useWorkspaceStore(state => state.openPinned)
  const { data: findings = [], isLoading, error } = useWorkerFindings(project)
  const groups = groupFindings(findings)

  if (isLoading) {
    return (
      <WorkerFindingsFrame>
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size="lg" className="animate-spin text-(--color-fg-subtle)" />
        </div>
      </WorkerFindingsFrame>
    )
  }

  if (error) {
    return (
      <WorkerFindingsFrame>
        <ErrorState title="Could not load worker findings" description={errorMessage(error)} />
      </WorkerFindingsFrame>
    )
  }

  if (findings.length === 0) {
    return (
      <WorkerFindingsFrame>
        <EmptyState
          icon={<Icon name="CheckCircle" size="lg" />}
          title="No findings"
          description="Run /audit, /ruflo-loop testgaps, or /ruflo-cost to generate findings."
        />
      </WorkerFindingsFrame>
    )
  }

  return (
    <WorkerFindingsFrame>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-(--color-fg-subtle)">Total worker findings</span>
        <span className="text-xs tabular-nums text-(--color-fg-muted)">{findings.length}</span>
      </div>

      {groups.map(group => {
        const severityBreakdown = formatSeverityBreakdown(group.findings.map(finding => finding.priority))

        return (
          <section key={group.worker} className="space-y-2">
            <div className="flex items-center gap-2">
              <Tooltip label={`worker:${group.worker}`}>
                <span
                  className={`text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-48 truncate ${labelChipClass(`worker:${group.worker}`)}`}
                >
                  {formatLabel(`worker:${group.worker}`)}
                </span>
              </Tooltip>
              <span className="text-[10px] text-(--color-fg-subtle) tabular-nums">
                {group.findings.length} total
              </span>
              {severityBreakdown && (
                <span className="text-[10px] text-(--color-fg-subtle)">
                  ({severityBreakdown})
                </span>
              )}
            </div>

            <div className="border border-(--color-border) rounded-lg overflow-hidden">
              {group.findings.map(finding => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={finding.issue_id}
                  onClick={() => openPinned(finding.issue_id)}
                  className="h-auto w-full justify-start gap-2 rounded-none border-0 border-b border-(--color-border)/70 bg-(--color-bg) px-3 py-2 text-left hover:bg-(--color-surface) last:border-b-0"
                >
                  <span className="w-24 text-[10px] font-mono text-(--color-fg-subtle) truncate">
                    {finding.issue_id}
                  </span>
                  <span className={`w-7 text-[10px] tabular-nums ${priorityClass(finding.priority)}`}>
                    P{finding.priority}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-(--color-fg-muted) truncate">
                    {finding.title}
                  </span>
                  <span className="text-[10px] text-(--color-fg-subtle) tabular-nums flex-shrink-0">
                    {formatAbsolute(finding.created_at, { includeTime: true })}
                  </span>
                </Button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
    </WorkerFindingsFrame>
  )
}
