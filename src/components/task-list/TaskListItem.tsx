import type { Task } from '../../bindings'
import { parsePausedNote } from '../../lib/parsePausedNote'

export const STATUS_DOT: Record<string, string> = {
  open:        'bg-neutral-500',
  in_progress: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]',
  blocked:     'bg-amber-500',
  closed:      'bg-green-500',
}

export const STATUS_BADGE: Record<string, string> = {
  open:        'bg-neutral-800/80 text-neutral-400',
  in_progress: 'bg-blue-900/50 text-blue-300',
  blocked:     'bg-amber-900/50 text-amber-300',
  closed:      'bg-green-900/50 text-green-300',
}

export const STATUS_BADGE_PAUSED = 'bg-violet-900/40 text-violet-300 border border-violet-800/40'

export const PRIORITY_STYLE: Record<number, string> = {
  1: 'text-red-400 font-bold',
  2: 'text-orange-400 font-semibold',
  3: 'text-yellow-500/80',
  4: 'text-neutral-600',
}

const COMPACT_PREFIXES = new Set(['branch', 'repo', 'worktree', 'worker'])

export function formatLabel(label: string): string {
  const idx = label.indexOf(':')
  if (idx > 0) {
    const prefix = label.slice(0, idx)
    if (COMPACT_PREFIXES.has(prefix)) return label.slice(idx + 1)
  }
  return label
}

const LABEL_CHIP_COLORS: Record<string, string> = {
  branch:   'bg-violet-900/30 text-violet-400/80 border border-violet-800/30',
  repo:     'bg-violet-900/30 text-violet-400/80 border border-violet-800/30',
  worktree: 'bg-violet-900/30 text-violet-400/80 border border-violet-800/30',
  openspec: 'bg-blue-900/30 text-blue-400/80 border border-blue-800/30',
  area:     'bg-blue-900/30 text-blue-400/80 border border-blue-800/30',
  worker:   'bg-teal-900/30 text-teal-400/80 border border-teal-800/30',
  ruflo:    'bg-teal-900/30 text-teal-400/80 border border-teal-800/30',
}

export function labelChipClass(label: string): string {
  const prefix = label.split(':')[0]
  return LABEL_CHIP_COLORS[prefix] ?? 'bg-neutral-800/60 text-neutral-500 border border-neutral-700/30'
}

interface TaskListItemProps {
  task: Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'labels'> & { notes?: string | null; description?: string | null }
  isActive?: boolean
  isFocused?: boolean
  isSelected?: boolean
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
}

export function TaskListItem({ task, isActive, isFocused, isSelected, onClick, onDoubleClick }: TaskListItemProps) {
  const visibleLabels = task.labels.slice(0, 2)
  const isPaused = task.labels.includes('openspec:paused')
  const pauseReason = parsePausedNote(task.notes ?? task.description ?? null) ?? undefined

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ fontSize: 'var(--font-size)' }}
      className={[
        'w-full h-full text-left px-3 flex items-center gap-2.5 transition-all border-b border-neutral-800/40',
        isActive
          ? 'bg-blue-950/30 border-l-2 border-l-blue-500'
          : isSelected
            ? 'bg-neutral-800/50'
            : isFocused
              ? 'bg-neutral-800/20 border-l-2 border-l-neutral-600'
              : 'hover:bg-neutral-800/20 hover:border-l-2 hover:border-l-neutral-700/50',
      ].join(' ')}
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? 'bg-neutral-600'}`} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs truncate flex-1 ${isActive ? 'text-neutral-100' : 'text-neutral-300'}`}>
            {task.title}
          </span>
          <span title={pauseReason} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${isPaused ? STATUS_BADGE_PAUSED : STATUS_BADGE[task.status] ?? 'bg-neutral-800 text-neutral-400'}`}>
            {isPaused ? '⏸ paused' : task.status.replace('_', ' ')}
          </span>
        </div>
        {visibleLabels.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-mono text-neutral-700">{task.id}</span>
            {visibleLabels.map(l => (
              <span
                key={l}
                className={`text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-24 truncate ${labelChipClass(l)}`}
                title={l}
              >
                {formatLabel(l)}
              </span>
            ))}
            {task.labels.length > 2 && (
              <span className="text-[10px] text-neutral-700">+{task.labels.length - 2}</span>
            )}
          </div>
        )}
        {visibleLabels.length === 0 && (
          <div className="mt-0.5">
            <span className="text-[10px] font-mono text-neutral-700">{task.id}</span>
          </div>
        )}
      </div>

      {/* Priority */}
      <span className={`text-xs flex-shrink-0 tabular-nums ${PRIORITY_STYLE[task.priority] ?? 'text-neutral-600'}`}>
        P{task.priority}
      </span>
    </button>
  )
}
