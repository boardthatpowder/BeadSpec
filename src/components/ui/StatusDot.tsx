import { cn } from '../../lib/cn'
import { STATUS_PALETTE } from '../../lib/palettes'

interface StatusDotProps {
  status: string
  size?: 'sm' | 'md'
  glow?: boolean
  className?: string
}

export function StatusDot({ status, size = 'sm', glow, className }: StatusDotProps) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  const sizeClass = size === 'md' ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'
  const glowClass = (glow ?? status === 'in_progress')
    ? 'shadow-[0_0_6px_rgba(59,130,246,0.45)]'
    : undefined
  return (
    <span
      aria-hidden
      className={cn('rounded-full flex-shrink-0', palette.dot, sizeClass, glowClass, className)}
    />
  )
}
