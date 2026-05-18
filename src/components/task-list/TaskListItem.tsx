import type { Task } from '../../bindings'
import type { WorkerProvenance } from '../../lib/worker-findings'
import { parsePausedNote } from '../../lib/parsePausedNote'
import { PRIORITY_PALETTE, STATUS_PALETTE } from '../../lib/palettes'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

function classSet(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function statusDotClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return classSet(palette.bg, status === 'in_progress' ? 'shadow-[0_0_6px_rgba(59,130,246,0.45)]' : undefined)
}

export function statusBadgeClass(status: string) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  return classSet(palette.bg, palette.text, palette.border)
}

export function priorityTextClass(priority: number) {
  const palette = PRIORITY_PALETTE[String(priority)] ?? PRIORITY_PALETTE.low
  return classSet(palette.text, priority <= 2 ? 'font-semibold' : undefined)
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

  return (
    <Button
      variant="ghost"
      size="md"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{ fontSize: 'var(--font-size)' }}
      className={[
        'w-full h-full justify-start rounded-none border-0 border-b border-neutral-800/40 px-3 text-left font-normal transition-all',
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
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotClass(task.status)}`} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs truncate flex-1 ${isActive ? 'text-neutral-100' : 'text-neutral-300'}`}>
            {task.title}
          </span>
          <span title={pauseReason} className={`inline-flex items-center gap-1 border text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${isPaused ? statusBadgeClass('paused') : statusBadgeClass(task.status)}`}>
            {isPaused ? (
              <>
                <Icon name="Pause" size="sm" className="h-2.5 w-2.5" />
                paused
              </>
            ) : task.status.replace('_', ' ')}
          </span>
        </div>
        {hasMetadata && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-mono text-neutral-700">{task.id}</span>
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
              <span className="text-[10px] text-neutral-700">+{task.labels.length - 2}</span>
            )}
          </div>
        )}
        {!hasMetadata && (
          <div className="mt-0.5">
            <span className="text-[10px] font-mono text-neutral-700">{task.id}</span>
          </div>
        )}
      </div>

      {/* Priority */}
      <span className={`text-xs flex-shrink-0 tabular-nums ${priorityTextClass(task.priority)}`}>
        P{task.priority}
      </span>
    </Button>
  )
}
