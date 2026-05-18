import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '../../hooks/useProject'
import { useWorkspaceStore } from '../../stores/workspace'
import { useAppState } from '../../contexts/HashStateContext'
import { commands, unwrap } from '../../ipc'
import { claimTask, getEpicReadySnapshot, runOpenspecValidate } from '../../ipc'
import type { Task } from '../../bindings'
import { labelChipClass, formatLabel, STATUS_BADGE } from '../task-list/TaskListItem'

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

  if (!project) return <div className="p-6 text-sm text-neutral-500">Connect a project.</div>

  return (
    <div className="h-full overflow-auto p-5 space-y-4">
      <header className="rounded-lg border border-neutral-800/60 bg-neutral-900/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-100">Epic: {epicId}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {(snapshot.data?.ready.length ?? 0)} ready · {snapshot.data?.total_in_progress ?? 0} in progress · via {snapshot.data?.source ?? 'loading'}
            </div>
          </div>
          <button onClick={() => snapshot.refetch()} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">Refresh</button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <EpicValidationPill project={project} change={change} />
          <div className="flex gap-1.5">
            {(['proposal.md', 'design.md', 'tasks.md'] as const).map(artifact => (
              <button key={artifact} onClick={() => openDocTab(change, artifact)} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300">{artifact}</button>
            ))}
          </div>
        </div>
      </header>

      {snapshot.data?.blocked.length ? (
        <div className="rounded border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-300">
          Currently blocked by: {snapshot.data.blocked.map(b => `${b.blocker_id} — ${b.blocker_title}`).join(' → ')}
          <button onClick={() => setState({ view: 'all', taskId: epicId })} className="ml-3 text-amber-200 underline">View full graph</button>
        </div>
      ) : null}

      {snapshot.error && <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">Snapshot error: {String(snapshot.error)}</div>}
      {children.length === 0 ? (
        <div className="rounded border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-500">No tasks imported yet. Run `openspec-beads-import`.</div>
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
  const claim = useMutation({
    mutationFn: () => claimTask(project, task.id),
    onSuccess: onClaimed,
  })
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <button onClick={() => setState({ view: 'all', taskId: task.id })} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[task.status] ?? 'bg-neutral-800 text-neutral-400'}`}>{task.status.replace('_', ' ')}</span>
          {paused && <span className="rounded bg-violet-950/40 px-1.5 py-0.5 text-[10px] text-violet-300">Paused</span>}
          <span className="truncate text-sm text-neutral-200">{task.title}</span>
        </div>
        <div className="mt-1 flex gap-1">
          {task.labels.slice(0, 3).map(label => <span key={label} className={`rounded px-1.5 py-0.5 text-[10px] ${labelChipClass(label)}`}>{formatLabel(label)}</span>)}
        </div>
      </button>
      {task.status === 'open' && !task.assignee && (
        <button onClick={() => claim.mutate()} disabled={claim.isPending} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40">Claim</button>
      )}
    </div>
  )
}

function EpicValidationPill({ project, change }: { project: string; change: string }) {
  const validate = useMutation({ mutationFn: () => runOpenspecValidate(project, change) })
  const result = validate.data
  return (
    <button onClick={() => validate.mutate()} className={`rounded border px-2 py-1 text-xs ${!result ? 'border-neutral-700 text-neutral-400' : result.valid ? 'border-green-800 bg-green-950/30 text-green-300' : 'border-red-800 bg-red-950/30 text-red-300'}`}>
      {validate.isPending ? 'validating…' : !result ? 'Validate' : result.valid ? 'Validation: pass' : `Validation: fail (${result.errors.length})`}
    </button>
  )
}
