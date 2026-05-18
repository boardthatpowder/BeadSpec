import { cn } from '../../lib/cn'
import { STATUS_PALETTE } from '../../lib/palettes'
import { Icon } from './Icon'

const STATUS_ICONS: Record<string, 'Circle' | 'Loader2' | 'Ban' | 'CheckCircle2' | 'Pause'> = {
  open: 'Circle',
  in_progress: 'Loader2',
  blocked: 'Ban',
  closed: 'CheckCircle2',
  done: 'CheckCircle2',
  paused: 'Pause',
}

interface StatusPillProps {
  status: string
  size?: 'xs' | 'sm'
  icon?: boolean
  title?: string
  className?: string
}

export function StatusPill({ status, size = 'xs', icon = false, title, className }: StatusPillProps) {
  const palette = STATUS_PALETTE[status] ?? STATUS_PALETTE.open
  const label = status.replace('_', ' ')
  const iconName = STATUS_ICONS[status] ?? 'Circle'
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium flex-shrink-0',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5',
        palette.bg, palette.text, palette.border,
        className,
      )}
    >
      {icon && <Icon name={iconName} size="sm" className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}
