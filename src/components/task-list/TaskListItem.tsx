import type { Task } from '../../bindings'
import type { WorkerProvenance } from '../../lib/worker-findings'
import { parsePausedNote } from '../../lib/parsePausedNote'
import { STATUS_PALETTE } from '../../lib/palettes'
import { Button } from '../ui/Button'
import { PriorityChip } from '../ui/PriorityChip'
import { StatusPill } from '../ui/StatusPill'

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
  return LABEL_CHIP_COLORS[prefix] ?? 'bg-(--color-surface-hi)/60 text-(--color-fg-subtle) border border-(--color-border-strong)/30'
}

// Kept for external consumers that import these helpers
export function statusDotClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return [palette.dot, status === 'in_progress' ? 'shadow-[0_0_6px_rgba(59,130,246,0.45)]' : ''].filter(Boolean).join(' ')
}

export function statusBadgeClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return [palette.bg, palette.text, palette.border].join(' ')
}

interface TaskListItemProps {
  task: Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'labels'> & { notes?: string | null; description?: string | null }
  provenance?: WorkerProvenance | null
  isActive?: boolean
  isFocused?: boolean
  isSelected?: boolean
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
}

export function TaskListItem({ task, provenance, isActive, isFocused, isSelected, onClick, onDoubleClick }: TaskListItemProps) {
  const visibleLabels = task.labels.slice(0, 2)
  const hasMetadata = Boolean(provenance) || visibleLabels.length > 0
  const isPaused = task.labels.includes('openspec:paused')
  const pauseReason = parsePausedNote(task.notes ?? task.description ?? null) ?? undefined
  const palette = STATUS_PALETTE[isPaused ? 'paused' : task.status] ?? STATUS_PALETTE.open

  return (
    <Button
      variant="ghost"
      size="md"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ fontSize: 'var(--font-size)' }}
      className={[
        'relative w-full h-full justify-start rounded-none border-0 border-b border-(--color-border)/40 pl-4 pr-3 text-left font-normal transition-all overflow-hidden',
        isActive
          ? 'bg-blue-950/30 ring-1 ring-inset ring-blue-500/20'
          : isSelected
            ? 'bg-(--color-surface-hi)/50'
            : isFocused
              ? 'bg-(--color-surface-hi)/20'
              : 'hover:bg-(--color-surface-hi)/20',
      ].join(' ')}
    >
      {/* Status stripe — 3px left edge, colored by status */}
      <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] flex-shrink-0 ${palette.dot}`} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs truncate flex-1 ${isActive ? 'text-(--color-fg)' : 'text-(--color-fg-muted)'}`}>
            {task.title}
          </span>
          <StatusPill status={isPaused ? 'paused' : task.status} title={pauseReason} />
        </div>
        {hasMetadata && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-mono text-(--color-fg-subtle)">{task.id}</span>
            {provenance && (
              <span
                className={`text-[10px] px-1.5 py-0 rounded font-mono leading-4 max-w-24 truncate ${labelChipClass(`worker:${provenance.worker}`)}`}
                title={provenance.firstLine}
                aria-label={`Filed by ruflo-${provenance.worker}`}
              >
                {formatLabel(`worker:${provenance.worker}`)}
              </span>
            )}
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
              <span className="text-[10px] text-(--color-fg-subtle)">+{task.labels.length - 2}</span>
            )}
          </div>
        )}
        {!hasMetadata && (
          <div className="mt-0.5">
            <span className="text-[10px] font-mono text-(--color-fg-subtle)">{task.id}</span>
          </div>
        )}
      </div>

      {/* Priority chip */}
      <span className="flex-shrink-0 text-(--color-fg-subtle) ml-2">
        <PriorityChip value={task.priority} size="sm" />
      </span>
    </Button>
  )
}
