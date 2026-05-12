import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, unwrap } from '../../ipc'
import type { HistoryEntry, DoltRevision } from '../../bindings'
import { listen } from '@tauri-apps/api/event'
import { IconButton } from '../ui/IconButton'
import { interleaveByTimestamp } from '../../lib/interleave'
import { DoltRevisionEntry } from './DoltRevisionEntry'

interface Props { taskId: string; project: string; activeTab?: string }

type ActivityItem =
  | { type: 'beads'; entry: HistoryEntry }
  | { type: 'dolt'; revision: DoltRevision }

function DiffPanel({ entryA, entryB, onClose }: {
  entryA: HistoryEntry; entryB: HistoryEntry; onClose: () => void
}) {
  return (
    <div className="mx-4 mb-4 p-3 bg-neutral-800 border border-neutral-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-400">Changes between selected entries</span>
        <IconButton label="Close" onClick={onClose} className="text-xs text-neutral-600 hover:text-neutral-300">✕</IconButton>
      </div>
      <div className="space-y-2">
        {[entryA, entryB].map((entry, i) => (
          <div key={entry.id} className={`text-xs p-2 rounded ${i === 0 ? 'bg-red-900/20 border border-red-900/40' : 'bg-green-900/20 border border-green-900/40'}`}>
            <div className="text-neutral-400 mb-1">{i === 0 ? 'Before' : 'After'} · {new Date(entry.timestamp).toLocaleString()}</div>
            {entry.entry_type === 'comment' ? (
              <div className="text-neutral-300">{entry.body}</div>
            ) : (
              <div>
                <span className="text-neutral-400">{entry.field}: </span>
                <span className={i === 0 ? 'text-red-300 line-through' : 'text-green-300'}>
                  {i === 0 ? entry.old_value : entry.new_value}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Stable fallback date for DoltRevision rows which have no commit_date. */
function doltRevisionDate(_revision: DoltRevision): Date {
  // The backend does not expose a commit_date yet; use epoch so Dolt entries
  // sort to the front (oldest), or swap to Date.now() to push them to the end.
  return new Date(0)
}

export function ActivityTimeline({ taskId, project, activeTab }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const queryClient = useQueryClient()

  useEffect(() => {
    const unlisten = listen<{ task_ids: string[] }>('tasks_changed', (e) => {
      if (e.payload.task_ids.includes(taskId)) {
        queryClient.invalidateQueries({ queryKey: ['task-history', project, taskId] })
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [taskId, project, queryClient])

  const { data: history = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ['task-history', project, taskId],
    queryFn: () => unwrap(commands.getTaskHistory(project, taskId)),
    enabled: !!project && !!taskId,
    staleTime: 30_000,
  })

  // Dolt revision history — only fetched when activity tab is active
  const { data: doltRevisions = [] } = useQuery<DoltRevision[]>({
    queryKey: ['doltHistory', project, taskId],
    queryFn: async () => {
      try {
        return await unwrap(commands.getDoltHistoryForIssue(project, taskId))
      } catch {
        // Gracefully degrade: Dolt unavailable or query error
        return []
      }
    },
    enabled: !!project && !!taskId && activeTab === 'activity',
    staleTime: 60_000,
    retry: false,
  })

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  // Build merged activity feed
  const beadsItems: ActivityItem[] = history.map(entry => ({ type: 'beads', entry }))
  const doltItems: ActivityItem[] = doltRevisions.map(revision => ({ type: 'dolt', revision }))

  const feed = interleaveByTimestamp<ActivityItem, ActivityItem>(
    beadsItems,
    doltItems,
    (item) => {
      if (item.type === 'beads') return new Date(item.entry.timestamp)
      return doltRevisionDate(item.revision)
    },
  )

  if (isLoading) return <div className="p-6 text-sm text-neutral-600">Loading…</div>
  if (!feed.length) return <div className="p-6 text-sm text-neutral-600 italic">No activity yet</div>

  const entryA = selectedIds.length === 2 ? history.find(e => e.id === selectedIds[0]) : undefined
  const entryB = selectedIds.length === 2 ? history.find(e => e.id === selectedIds[1]) : undefined

  return (
    <div className="space-y-0">
      <div className="p-6 space-y-4">
        {feed.map((item, idx) => {
          if (item.type === 'dolt') {
            return <DoltRevisionEntry key={`dolt-${idx}`} revision={item.revision} />
          }

          const entry = item.entry
          const isSelected = selectedIds.includes(entry.id)
          return (
            <div key={entry.id} className="flex gap-3">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs text-neutral-400 font-medium flex-shrink-0">
                  {entry.actor?.[0]?.toUpperCase() ?? '?'}
                </div>
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-neutral-300">{entry.actor}</span>
                  <span className="text-xs text-neutral-600">
                    {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => toggleSelect(entry.id)}
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'text-neutral-600 hover:text-neutral-400 hover:bg-neutral-700'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Compare'}
                  </button>
                </div>
                {entry.entry_type === 'comment' ? (
                  <div className="mt-1 text-sm text-neutral-300 whitespace-pre-wrap">{entry.body}</div>
                ) : (
                  <div className="mt-0.5 text-xs text-neutral-500">
                    changed <span className="text-neutral-400">{entry.field}</span>
                    {entry.old_value && <> from <span className="line-through text-neutral-500">{entry.old_value}</span></>}
                    {entry.new_value && <> → <span className="text-neutral-300">{entry.new_value}</span></>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {entryA && entryB && (
        <DiffPanel
          entryA={entryA}
          entryB={entryB}
          onClose={() => setSelectedIds([])}
        />
      )}
    </div>
  )
}
