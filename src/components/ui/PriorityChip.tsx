import { cn } from '../../lib/cn'
import { PRIORITY_DOT } from '../../lib/palettes'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical',
  1: 'High',
  2: 'Medium',
  3: 'Low',
  4: 'Backlog',
}

// Bar heights as fraction of total, ascending left-to-right (shortest to tallest)
const BAR_HEIGHT_FRACTIONS = [0.35, 0.55, 0.75, 1.0]

// Number of filled bars per priority level (P0 = most urgent = all bars filled)
function filledBars(priority: number): number {
  return Math.max(0, 4 - priority)
}

interface PriorityChipProps {
  value: number
  size?: 'sm' | 'md'
  className?: string
}

export function PriorityChip({ value, size = 'sm', className }: PriorityChipProps) {
  const totalHeight = size === 'md' ? 14 : 11
  const barWidth = size === 'md' ? 3 : 2
  const filled = filledBars(value)
  const fillColor = PRIORITY_DOT[String(value)] ?? 'bg-neutral-600'
  const label = PRIORITY_LABELS[value] ?? `P${value}`

  return (
    <span
      role="img"
      aria-label={`Priority: ${label}`}
      className={cn('inline-flex items-end gap-[2px]', className)}
      style={{ height: totalHeight }}
    >
      {BAR_HEIGHT_FRACTIONS.map((fraction, i) => {
        const barHeight = Math.round(totalHeight * fraction)
        const isFilled = i < filled
        return (
          <span
            key={i}
            aria-hidden
            style={{ height: barHeight, width: barWidth }}
            className={cn('rounded-[1px] flex-shrink-0', isFilled ? fillColor : 'bg-current opacity-20')}
          />
        )
      })}
    </span>
  )
}
