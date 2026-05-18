import { forwardRef } from 'react'
import { cn } from '../../lib/cn'
import type { PaletteClassSet } from '../../lib/palettes'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const BADGE_PALETTE: Record<BadgeVariant, PaletteClassSet> = {
  default: { bg: 'bg-[--color-surface-hi]', text: 'text-[--color-fg]', border: 'border-[--color-border]' },
  success: { bg: 'bg-green-950/40', text: 'text-green-300', border: 'border-green-800/50' },
  warning: { bg: 'bg-amber-950/40', text: 'text-amber-300', border: 'border-amber-800/50' },
  danger: { bg: 'bg-red-950/40', text: 'text-red-300', border: 'border-red-800/50' },
  info: { bg: 'bg-blue-950/40', text: 'text-blue-300', border: 'border-blue-800/50' },
  muted: { bg: 'bg-[--color-surface-hi]/60', text: 'text-[--color-fg-muted]', border: 'border-[--color-border-strong]/50' },
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    const palette = BADGE_PALETTE[variant]

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5',
          palette.bg,
          palette.text,
          palette.border,
          className,
        )}
        {...props}
      />
    )
  },
)

Badge.displayName = 'Badge'
