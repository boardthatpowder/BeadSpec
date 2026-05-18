import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkspaceStore } from '../../stores/workspace'
import { useAppState } from '../../contexts/HashStateContext'
import { commands, unwrap } from '../../ipc'
import { claimTask, getEpicReadySnapshot, runOpenspecValidate } from '../../ipc'
import type { Task } from '../../bindings'
import { STATUS_PALETTE } from '../../lib/palettes'
import { labelChipClass, formatLabel } from '../task-list/TaskListItem'
import { PanelHeader } from '../shared/PanelHeader'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ErrorState } from '../ui/ErrorState'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { useToast } from '../ui/useToast'

function paletteClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return `${palette.bg} ${palette.text} ${palette.border}`
}

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

export function EpicDashboard({ change, epicId }: { change: string; epicId: string }) {
  const project = useActiveProject()
  const queryClient = useQueryClient()
  const openDocTab = useWorkspaceStore(s => s.openDocTab)
  const { setState } = useAppState()
  const snapshot = useQuery({
    queryKey: ['epicSnapshot', project, epicId],
    queryFn: () => getEpicReadySnapshot(project!, epicId),
    enabled: !!project,
  })
  const childQuery = useQuery({
    queryKey: ['epicChildren', project, change],
    queryFn: async () => {
      const response = await unwrap(commands.listTasks(project!, null, null, [`openspec:${change}`], null, null))
      return response.tasks
    },
    enabled: !!project,
  })
  const children = useMemo(() => (childQuery.data ?? []).filter(t => t.id !== epicId), [childQuery.data, epicId])
  const grouped = groupChildren(children, snapshot.data?.ready ?? [])

  if (!project) return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Epic Progress" />
      <EmptyState
        icon={<Icon name="FolderOpen" size="lg" />}
        title="No project connected"
        description="Connect a project to track epic progress."
      />
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader title="Epic Progress" />
      <div className="flex-1 overflow-auto p-5 space-y-4">
      <header className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-100">Epic: {epicId}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {(snapshot.data?.ready.length ?? 0)} ready · {snapshot.data?.total_in_progress ?? 0} in progress · via {snapshot.data?.source ?? 'loading'}
            </div>
          </div>
          <Button variant="secondary" size="xs" onClick={() => snapshot.refetch()}>Refresh</Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <EpicValidationPill project={project} change={change} />
          <div className="flex gap-1.5">
            {(['proposal.md', 'design.md', 'tasks.md'] as const).map(artifact => (
              <Button key={artifact} variant="secondary" size="xs" onClick={() => openDocTab(change, artifact)}>
                {artifact}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {snapshot.data?.blocked.length ? (
        <div className="rounded border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-300">
          Currently blocked by: {snapshot.data.blocked.map(b => `${b.blocker_id} — ${b.blocker_title}`).join(' → ')}
          <Button
            variant="link"
            size="xs"
            onClick={() => setState({ view: 'all', taskId: epicId })}
            className="ml-3 h-auto text-amber-200"
          >
            View full graph
          </Button>
        </div>
      ) : null}

      {snapshot.error ? (
        <ErrorState
          title="Could not load epic progress"
          description={messageFromError(snapshot.error, 'The epic snapshot could not be loaded.')}
          retry={() => snapshot.refetch()}
        />
      ) : childQuery.error ? (
        <ErrorState
          title="Could not load epic tasks"
          description={messageFromError(childQuery.error, 'The epic task list could not be loaded.')}
          retry={() => childQuery.refetch()}
        />
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Icon name="Inbox" size="lg" />}
          title="No tasks imported"
          description="Run openspec-beads-import to populate this epic dashboard."
        />
      ) : (
        Object.entries(grouped).map(([name, tasks]) => tasks.length > 0 && (
          <section key={name} className="rounded-lg border border-neutral-800/60 bg-neutral-900/30">
            <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-400">{name} ({tasks.length})</div>
            <div className="divide-y divide-neutral-800/50">
              {tasks.map(task => <EpicTaskRow key={task.id} task={task} paused={snapshot.data?.paused_task_ids.includes(task.id) ?? false} project={project} onClaimed={() => {
                queryClient.invalidateQueries({ queryKey: ['tasks'] })
                queryClient.invalidateQueries({ queryKey: ['epicChildren', project, change] })
                queryClient.invalidateQueries({ queryKey: ['epicSnapshot', project, epicId] })
              }} />)}
            </div>
          </section>
        ))
      )}
      </div>
    </div>
  )
}

function groupChildren(tasks: Task[], readyIds: string[]) {
  const ready = new Set(readyIds)
  return {
    Ready: tasks.filter(t => ready.has(t.id)),
    'In progress': tasks.filter(t => t.status === 'in_progress'),
    Blocked: tasks.filter(t => t.status === 'blocked'),
    'Open (not ready)': tasks.filter(t => t.status === 'open' && !ready.has(t.id)),
    Closed: tasks.filter(t => t.status === 'closed'),
  }
}

function EpicTaskRow({ task, paused, project, onClaimed }: { task: Task; paused: boolean; project: string; onClaimed: () => void }) {
  const { setState } = useAppState()
  const { toast } = useToast()
  const claim = useMutation({
    mutationFn: () => claimTask(project, task.id),
    onSuccess: () => {
      toast('Task claimed')
      onClaimed()
    },
    onError: (error) => toast(`Claim failed: ${messageFromError(error, 'Could not claim task.')}`),
  })
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <Button
        variant="ghost"
        size="md"
        onClick={() => setState({ view: 'all', taskId: task.id })}
        className="h-auto min-w-0 flex-1 justify-start border-0 bg-transparent p-0 text-left font-normal hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${paletteClass(task.status)}`}>{task.status.replace('_', ' ')}</span>
          {paused && <span className="rounded bg-violet-950/40 px-1.5 py-0.5 text-[10px] text-violet-300">Paused</span>}
          <span className="truncate text-sm text-neutral-200">{task.title}</span>
        </div>
        <div className="mt-1 flex gap-1">
          {task.labels.slice(0, 3).map(label => <span key={label} className={`rounded px-1.5 py-0.5 text-[10px] ${labelChipClass(label)}`}>{formatLabel(label)}</span>)}
        </div>
      </Button>
      {task.status === 'open' && !task.assignee && (
        <Button
          variant="primary"
          size="xs"
          onClick={() => claim.mutate()}
          disabled={claim.isPending}
        >
          Claim
        </Button>
      )}
    </div>
  )
}

function EpicValidationPill({ project, change }: { project: string; change: string }) {
  const validate = useMutation({ mutationFn: () => runOpenspecValidate(project, change) })
  const result = validate.data
  return (
    <Tooltip label="Validation state" description="Runs OpenSpec validation and shows whether the current change artifacts pass.">
      <Button
        variant="secondary"
        size="xs"
        onClick={() => validate.mutate()}
        className={!result ? 'border-neutral-700 text-neutral-400' : result.valid ? 'border-green-800 bg-green-950/30 text-green-300' : 'border-red-800 bg-red-950/30 text-red-300'}
      >
        {validate.isPending ? 'validating…' : !result ? 'Validate' : result.valid ? 'Validation: pass' : `Validation: fail (${result.errors.length})`}
      </Button>
    </Tooltip>
  )
}
